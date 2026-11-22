#!/usr/bin/env node
/* global console, window, process */
// The raid's ships, looked at (design section 13b): a contact sheet of the longship under sail and beached,
// from the four quarters, close; the boats raid's rowing boats coming in, waiting and rowing off; a galleon at
// its quay at the same zoom to stand it beside. For judging the drawing, not the raid.
//
//   node src/life/testing/longship-sheet.mjs [--zoom 9] [--time day|dusk] [--name sheet]
//
// Output: .context/shots/seq/longship-<name>.png

import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { parseArgs, ROOT, startServer } from '../../../tools/lib/vite.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const FRAME = 1000 / 60;
const zoom = Number(flags.zoom ?? 9);
let zoomNow = zoom;
const time = String(flags.time ?? 'day');
const W = 640, H = 420;
const server = await startServer();
const browser = await launchBrowser();
const shots = [];
try {
  const open = async (scenario) => {
    const { page } = await openPage(browser, `${server.url}/?scenario=${scenario}`, { width: W, height: H });
    await page.waitForFunction(() => window.__lc !== undefined, null, { timeout: 60_000 });
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
    await page.evaluate((t) => window.__lc.signals.hold(t), time);
    // The game's buttons and notes off the picture.
    await page.addStyleTag({ content: '.lc-ui { display: none !important; }' });
    for (let i = 0; i < 90; i++) await page.clock.runFor(FRAME);
    return page;
  };
  const play = async (page, until, most = 60 * 90) => {
    for (let i = 0; i < most; i++) {
      await page.clock.runFor(FRAME);
      if (await page.evaluate(until)) return true;
    }
    return false;
  };
  const shoot = async (page, label, at, yaw) => {
    const p = await page.evaluate(at);
    await page.evaluate(([x, y, z, yw, zm]) => window.__lc.view.setCamera({ target: [x, y, z], yaw: yw, zoom: zm, pitch: 32 }), [p[0], p[1], p[2], yaw, zoomNow]);
    await page.clock.runFor(FRAME * 2);
    shots.push({ png: await page.locator('#town').screenshot(), label });
  };
  const shipAt = () => {
    const s = window.__lc.raids.current.ship;
    return [s.x, 0.9, s.z];
  };

  // The landing longship: under sail, then up on the beach.
  let page = await open('raid-landing');
  console.log('landing:', await page.evaluate(() => window.__lc.raids.summon({ at: null, kind: 'landing' }) ?? 'on its way'));
  await play(page, () => window.__lc.raids.current?.shipState === 'beached');
  for (let i = 0; i < 60 * 8; i++) await page.clock.runFor(FRAME);
  for (const yaw of [45, 135, 225, 315]) await shoot(page, `beached, yaw ${yaw}`, shipAt, yaw);
  const z0 = zoom;
  await page.evaluate(() => 0);
  zoomNow = 17;
  await shoot(page, 'beached, close (the planking)', shipAt, 60);
  await shoot(page, 'the prow, close', () => {
    const s = window.__lc.raids.current.ship;
    return [s.x + Math.sin(s.yaw) * 2.6, 1.6, s.z + Math.cos(s.yaw) * 2.6];
  }, 100);
  zoomNow = z0;
  await page.close();

  // The boats raid: no ship; the rowing boats come in one behind another, wait at their landings, row off laden.
  page = await open('raid-boats');
  await page.evaluate(() => window.__lc.raids.summon({ at: null, kind: 'boats' }));
  const boatAt = (k) => () => {
    const b = window.__lc.raids.current.boats[k] ?? window.__lc.raids.current.boats[0];
    return [b.x, 0.6, b.z];
  };
  await play(page, () => {
    const r = window.__lc.raids.current;
    return r && r.boats.every((b) => !b.edgeCut) && r.boatState.every((s) => s === 'row-in');
  });
  for (const yaw of [45, 225]) await shoot(page, `rowing boats coming in, yaw ${yaw}`, boatAt(1), yaw);
  zoomNow = 17;
  await shoot(page, 'a boat under oars, close (the bow)', boatAt(0), 20);
  zoomNow = zoom;
  await play(page, () => window.__lc.raids.current?.boatState.every((s) => s === 'wait'));
  await shoot(page, 'boats waiting at their landings', boatAt(0), 45);
  await play(page, () => window.__lc.raids.current?.boatState.some((s) => s === 'row-out'), 60 * 240);
  for (let i = 0; i < 60 * 3; i++) await page.clock.runFor(FRAME);
  zoomNow = 17;
  await shoot(page, 'rowing off with the loot (chest in the stern)', () => {
    const r = window.__lc.raids.current;
    const b = r.boats[Math.max(0, r.boatState.indexOf('row-out'))];
    return [b.x, 0.6, b.z];
  }, 135);
  zoomNow = zoom;
  await page.close();

  // A galleon at its quay, the same zoom.
  page = await open('grown-harbour');
  await play(page, () => !!window.__lcHarbour?.ships.find((s) => s.phase === 'moored'), 60 * 240);
  await shoot(page, 'galleon (for scale and standard)', () => {
    const s = window.__lcHarbour.ships.find((q) => q.phase === 'moored');
    return [s.pose.x, 0.9, s.pose.z];
  }, 45);
  await page.close();

  const ctx = await browser.newContext({ viewport: { width: 4 * W + 30, height: Math.ceil(shots.length / 4) * (H + 22) + 6 } });
  const sheet = await ctx.newPage();
  await sheet.setContent(
    `<body style="margin:0;background:#2b2622;font:13px/16px system-ui;color:#f2ede3"><div style="display:grid;grid-template-columns:repeat(4,${W}px);gap:6px;padding:6px">${shots
      .map((s) => `<div><img width="${W}" height="${H}" style="display:block" src="data:image/png;base64,${s.png.toString('base64')}"><div style="height:16px">${s.label}</div></div>`)
      .join('')}</div></body>`,
  );
  const out = path.join(ROOT, '.context/shots/seq', `longship-${flags.name ?? 'sheet'}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sheet.screenshot({ path: out });
  console.log(path.relative(ROOT, out));
} finally {
  await browser.close();
  await server.close?.();
  process.exit(0);
}
