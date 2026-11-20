#!/usr/bin/env node
/* global console, process, window, Buffer */
// Flicker under camera motion (Look). Draws towns from runs of camera poses very close together
// (src/render/testing/flicker.ts) and prints, per case, how much of the picture blinks or pops in a
// way the motion does not explain. Writes the worst regions as magnified crops (frames A | B | C |
// mask: red blinked, orange popped) and a heat map per case to .context/flicker/<label>/.
//
//   node src/render/testing/flicker.mjs [--label before] [--only substring] [--frames 40] [--quick]
//
// --quick runs only the day cases at pixel ratio 1. --against <label> uses that run's thresholds, so
// two versions of the view are scored on exactly the same terms (the threshold is otherwise set from
// each sweep's first frame, which the change under test may itself have moved).

import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { parseArgs, ROOT, startServer } from '../../../tools/lib/vite.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const label = String(flags.label ?? 'run');
const frames = Number(flags.frames ?? 40);
const outDir = path.join(ROOT, '.context/flicker', label);
const against = flags.against ? Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, '.context/flicker', String(flags.against), 'scores.json'), 'utf8')).map((r) => [r.name, r.threshold])) : {};

const E = { overview: { yaw: 45, pitch: 35, zoom: 1.6, target: [23.5, 1, 24.5] }, playing: { yaw: 45, pitch: 33, zoom: 3.4, target: [24, 1.5, 32] }, close: { yaw: 45, pitch: 28, zoom: 7.5, target: [24.5, 1.8, 31.5] } };
const G = { overview: { yaw: 135, pitch: 35, zoom: 1.6, target: [24, 1, 24] }, playing: { yaw: 135, pitch: 32, zoom: 3.6, target: [24, 2, 24] }, close: { yaw: 135, pitch: 26, zoom: 8, target: [24, 2, 24] } };
const desk = { width: 1280, height: 800 };
const phone = { width: 390, height: 844 };

/** scenario, camera, view (size, pixel ratio, ink), time of day, motion */
const cases = [];
const add = (scenario, cams, zoom, view, time, motion) => cases.push({ scenario, pose: cams[zoom], zoom, ...view, time, motion });
for (const [scn, cams] of [['everything', E], ['grown-town-1', G]]) {
  for (const zoom of ['overview', 'playing', 'close']) {
    for (const motion of ['yaw', 'pitch', 'zoom', 'pan']) add(scn, cams, zoom, { ...desk, ratio: 1, ink: 'full' }, 'day', motion);
    add(scn, cams, zoom, { ...desk, ratio: 1, ink: 'full' }, 'night', 'yaw');
    add(scn, cams, zoom, { ...desk, ratio: 2, ink: 'full' }, 'day', 'yaw');
    add(scn, cams, zoom, { ...phone, ratio: 2, ink: 'half' }, 'day', 'yaw');
  }
}
// Fly mode's eye (design section 7): down the longest street of the grown town at a person's height,
// and over the roofs; turning, tilting and flying forward. Against the builder's view turning (above).
for (const ratio of [1, 2]) {
  for (const motion of ['turn', 'tilt', 'forward']) cases.push({ scenario: 'grown-town-1', eye: 'street', zoom: 'street', ...desk, ratio, ink: 'full', time: 'day', motion });
  cases.push({ scenario: 'grown-town-1', eye: 'street', zoom: 'street', ...desk, ratio, ink: 'full', time: 'night', motion: 'turn' });
  cases.push({ scenario: 'grown-town-1', eye: 'roofs', zoom: 'roofs', ...desk, ratio, ink: 'full', time: 'day', motion: 'turn' });
}
// Open sea, close: nothing but water and its wave marks, which used to slide over the sea as the view turned.
add('everything', { sea: { yaw: 45, pitch: 32, zoom: 9, target: [39, 0, 39] } }, 'sea', { ...desk, ratio: 1, ink: 'full' }, 'day', 'yaw');
const nameOf = (c) => `${c.scenario}-${c.eye ? 'fly-' : ''}${c.zoom}-${c.motion}-${c.time}-${c.ink === 'half' ? 'phone' : `${c.ratio}x`}`;
let wanted = cases;
if (flags.quick) wanted = wanted.filter((c) => c.time === 'day' && c.ratio === 1);
if (flags.only) wanted = wanted.filter((c) => nameOf(c).includes(String(flags.only)));

// --style look.inkSeam=0,look.wobble=0: style values to hold for the run (for finding causes).
const styles = flags.style ? String(flags.style).split(',').map((s) => { const [mk, v] = s.split('='); const [m, k] = mk.split('.'); return [m, k, Number(v)]; }) : [];
const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));

fs.mkdirSync(outDir, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
const rows = [];
try {
  const { page, errors } = await openPage(browser, `${server.url}/tools/shot/index.html`, { width: 1280, height: 900 });
  await page.addScriptTag({ type: 'module', url: `${server.url}/src/render/testing/probe.ts` });
  await page.addScriptTag({ type: 'module', url: `${server.url}/src/render/testing/flicker.ts` });
  await page.waitForFunction('window.__look !== undefined && window.__flicker !== undefined', null, { timeout: 60_000 });
  let opened = '';
  for (const c of wanted) {
    const key = `${c.scenario}|${c.width}|${c.ratio}|${c.ink}`;
    if (key !== opened) {
      await page.evaluate((c) => window.__look.open(c.scenario, { ink: c.ink, pixelRatio: c.ratio, width: c.width, height: c.height }), c);
      opened = key;
    }
    await page.evaluate((t) => window.__look.time(t), c.time);
    // --season winter --weather snow: judge a season and weather (Seasons); life's clock is held still,
    // so falling things hang where they are and only the camera moves.
    if (flags.season || flags.weather) await page.evaluate(([s, w]) => window.__look.season(s ?? 'summer', w ?? 'clear'), [flags.season, flags.weather]);
    for (const kv of styles) await page.evaluate(([m, k, v]) => window.__look.style(m, k, v), kv);
    const t0 = Date.now();
    const name = nameOf(c);
    const r = await page.evaluate(([c, n, t]) => {
      if (!c.eye) return window.__flicker.sweep(c.pose, c.motion, n, c.width, c.height, undefined, t ?? undefined);
      const st = window.__look.street();
      const pose = c.eye === 'street' ? { eye: st.eye, yaw: st.yaw, pitch: -2, fov: 62 } : { eye: [st.eye[0] + 3, st.eye[1] + 3.5, st.eye[2] + 3], yaw: st.yaw + 30, pitch: -14, fov: 62 };
      return window.__flicker.sweepEye(pose, c.motion, n, c.width, c.height, undefined, t ?? undefined);
    }, [c, frames, against[name] ?? null]);
    for (const old of fs.readdirSync(outDir)) if (old.startsWith(`${name}-`)) fs.rmSync(path.join(outDir, old));
    save(path.join(outDir, `${name}-heat.png`), r.heat);
    r.crops.forEach((cr, i) => save(path.join(outDir, `${name}-crop${i}-f${cr.frame}-x${cr.x}-y${cr.y}.png`), cr.png));
    rows.push({ name, blink: r.blink, pop: r.pop, area: r.area, change: r.change, dark: r.dark, threshold: r.threshold });
    console.log(`${name.padEnd(44)} blink ${r.blink.toFixed(3).padStart(7)}‰  pop ${r.pop.toFixed(3).padStart(7)}‰  area ${r.area.toFixed(2).padStart(6)}‰  change ${r.change.toFixed(3)}  ink ${(r.dark * 100).toFixed(1)}%  T ${r.threshold}  (${Date.now() - t0} ms)`);
  }
  fs.writeFileSync(path.join(outDir, 'scores.json'), JSON.stringify(rows, null, 1));
  if (errors.length) console.log('page errors:', errors.slice(0, 3));
} finally {
  await browser.close();
  await server.close();
}
