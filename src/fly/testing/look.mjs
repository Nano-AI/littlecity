#!/usr/bin/env node
/* global process, console, window, document, localStorage, Image, Buffer, performance, requestAnimationFrame */
// Fly mode, looked at (design section 7, "Fly mode"). Opens the real app on an
// island, grows a town on it, and records contact sheets of: taking off from
// the builder's view, flying down a street, bumping into a house, and gliding
// back; and, with --bench, the frame rate flying through the town against the
// builder's view.
//
//   node src/fly/testing/look.mjs [options]
//
//   --seed 3                 the island (gen 1, as the browser tests use)
//   --time day,night         the times of day to record (held)
//   --only enter,street,bump,out   which sheets
//   --bench                  frame times flying (W held) and from the builder's view, 4 s each
//   --size 960x600 --cols 4
//
// Output: .context/fly/<seed>-<sheet>-<time>.png (a contact sheet) and each frame beside it.
// Drives window.__lc (ui.fly's test hooks) and the keyboard only.

import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../../../tools/lib/browser.mjs';
import { parseArgs, ROOT, startServer } from '../../../tools/lib/vite.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const seed = Number(flags.seed ?? 3);
const [width, height] = String(flags.size ?? '960x600').split('x').map(Number);
const cols = Number(flags.cols ?? 4);
const times = String(flags.time ?? 'day,night').split(',');
const only = flags.only && flags.only !== true ? String(flags.only).split(',') : ['enter', 'street', 'bump', 'out'];
const outDir = path.resolve(ROOT, '.context/fly');

const server = await startServer();
const browser = await launchBrowser();
let failed = false;
try {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript(() => localStorage.setItem('lc:welcomed', '1'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.stack ?? e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${server.url}/?seed=${seed}&gen=1&season=summer&weather=clear`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lc !== undefined);
  // Grow a town and finish it at once.
  await page.click('[data-ui="menu-button"]');
  await page.click('[data-menu="grow"]');
  await page.click('[data-menu="grow-here"]');
  await page.waitForFunction(() => window.__lc.ui.growth.active);
  await page.keyboard.press('x');
  await page.waitForFunction(() => !window.__lc.ui.growth.active && window.__lc.world().blocks.size > 100);
  await page.waitForTimeout(2500);
  fs.mkdirSync(outDir, { recursive: true });

  /** A street: the floor cell with the longest straight run of open floor ahead, and the way along it. */
  const street = await page.evaluate(() => {
    const w = window.__lc.world();
    const kinds = window.__lc.shape().kinds;
    const floors = new Set(w.floors.keys());
    const open = (k) => floors.has(k) && !kinds.has(k) && !kinds.has(k + 4096);
    const dirs = [[0, -1, 0], [1, 0, -90], [0, 1, 180], [-1, 0, 90]];
    let best = null;
    for (const k of floors) {
      if (!open(k)) continue;
      for (const [dx, dz, yaw] of dirs) {
        let n = 0;
        let c = k;
        for (;;) {
          const x = (c & 63) + dx, z = ((c >> 6) & 63) + dz;
          if (x < 0 || z < 0 || x > 47 || z > 47) break;
          c = (c & ~4095) | x | (z << 6);
          if (!open(c)) break;
          n++;
        }
        if (!best || n > best.n) best = { k, n, yaw };
      }
    }
    const k = best.k;
    return { eye: [(k & 63) + 0.5, (k >> 12) * 0.8 + 0.35, ((k >> 6) & 63) + 0.5], yaw: best.yaw, run: best.n };
  });
  /**
   * A wall to fly at: the upper storey of a house of two or more, with three open cells in front of it at
   * that height and the one below (props stand on the ground, so up there the way is clear).
   */
  const wall = await page.evaluate(() => {
    const kinds = window.__lc.shape().kinds;
    const at = (x, y, z) => (x < 0 || z < 0 || x > 47 || z > 47 ? -1 : x | (z << 6) | (y << 12));
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (const [k, kind] of kinds) {
      if (kind !== 'house') continue;
      const x = k & 63, z = (k >> 6) & 63, y = k >> 12;
      if (kinds.get(at(x, y - 1, z)) !== 'house') continue;
      for (const [dx, dz] of dirs) {
        // The eye comes from four cells off and flies at the house.
        let open = true;
        for (let i = 1; i <= 4 && open; i++) for (const ly of [y - 1, y, y + 1]) {
          const c = at(x - dx * i, ly, z - dz * i);
          if (c < 0 || kinds.has(c)) open = false;
        }
        if (!open) continue;
        // Facing the house: the eye looks along +d.
        const face = dx === 0 ? (dz > 0 ? 180 : 0) : dx > 0 ? -90 : 90;
        return { eye: [x - dx * 3.5 + 0.5, y * 0.8 + 0.4, z - dz * 3.5 + 0.5], yaw: face, house: [x, y, z], dir: [dx, dz] };
      }
    }
    return null;
  });
  console.log(`street ${JSON.stringify(street)}\nwall ${JSON.stringify(wall)}`);

  const shot = async (name, frames) => {
    const file = path.join(outDir, `${seed}-${name}.png`);
    // A contact sheet: the frames side by side, drawn into a canvas in the page.
    const datas = frames.map((f) => fs.readFileSync(f).toString('base64'));
    const sheet = await page.evaluate(
      async ({ datas, cols, w, h }) => {
        const rows = Math.ceil(datas.length / cols);
        const c = document.createElement('canvas');
        const s = 0.5;
        c.width = cols * w * s;
        c.height = rows * h * s;
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < datas.length; i++) {
          const img = new Image();
          img.src = `data:image/png;base64,${datas[i]}`;
          await img.decode();
          g.drawImage(img, (i % cols) * w * s, Math.floor(i / cols) * h * s, w * s, h * s);
        }
        return c.toDataURL('image/png').split(',')[1];
      },
      { datas, cols, w: width, h: height },
    );
    fs.writeFileSync(file, Buffer.from(sheet, 'base64'));
    console.log(path.relative(ROOT, file));
  };
  const grab = async (name, i) => {
    const file = path.join(outDir, `${seed}-${name}-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    return file;
  };
  const fly = (fn, arg) => page.evaluate(fn, arg);
  const waitPhase = (p) => page.waitForFunction((p) => window.__lc.ui.fly.phase === p, p, { timeout: 20_000 });

  for (const time of times) {
    await page.evaluate((t) => window.__lc.signals.hold(t), time);
    await page.waitForTimeout(800);
    const from = await page.evaluate(() => window.__lc.view.getCamera());
    if (only.includes('enter')) {
      // Taking off, held at points along the dolly zoom.
      const frames = [await grab(`enter-${time}`, 0)];
      await fly(() => window.__lc.ui.fly.testHold(0));
      await page.keyboard.press('f');
      await waitPhase('in');
      const steps = [0, 0.1, 0.2, 0.35, 0.5, 0.7, 1];
      for (let i = 0; i < steps.length; i++) {
        await fly((t) => window.__lc.ui.fly.testHold(t), steps[i]);
        await page.waitForTimeout(250);
        frames.push(await grab(`enter-${time}`, i + 1));
      }
      await fly(() => window.__lc.ui.fly.testHold(null));
      await waitPhase('flying');
      await shot(`enter-${time}`, frames);
    } else {
      await page.keyboard.press('f');
      await waitPhase('flying');
    }
    if (only.includes('street') && street) {
      await fly((s) => window.__lc.ui.fly.testPlace(s.eye, s.yaw, -4), street);
      await page.waitForTimeout(500);
      const frames = [await grab(`street-${time}`, 0)];
      await fly(() => window.__lc.ui.fly.testKey('KeyW', true));
      for (let i = 1; i < 8; i++) {
        await page.waitForTimeout(220);
        frames.push(await grab(`street-${time}`, i));
      }
      await fly(() => window.__lc.ui.fly.testKey('KeyW', false));
      await shot(`street-${time}`, frames);
      console.log(`street end ${JSON.stringify(await fly(() => window.__lc.ui.fly.debug()))}`);
    }
    if (only.includes('bump') && wall) {
      await fly((s) => window.__lc.ui.fly.testPlace(s.eye, s.yaw, 0), wall);
      await page.waitForTimeout(500);
      const frames = [await grab(`bump-${time}`, 0)];
      await fly(() => window.__lc.ui.fly.testKey('KeyW', true));
      for (let i = 1; i < 6; i++) {
        await page.waitForTimeout(200);
        frames.push(await grab(`bump-${time}`, i));
      }
      // And slide along it.
      await fly(() => window.__lc.ui.fly.testKey('KeyD', true));
      for (let i = 6; i < 8; i++) {
        await page.waitForTimeout(250);
        frames.push(await grab(`bump-${time}`, i));
      }
      await fly(() => window.__lc.ui.fly.testKey('KeyW', false));
      await fly(() => window.__lc.ui.fly.testKey('KeyD', false));
      await shot(`bump-${time}`, frames);
      console.log(`bump end ${JSON.stringify(await fly(() => window.__lc.ui.fly.debug()))} house ${JSON.stringify(wall.house)}`);
    }
    if (flags.bench) {
      if (street) await fly((s) => window.__lc.ui.fly.testPlace(s.eye, s.yaw, -4), street);
      await fly(() => window.__lc.ui.fly.testKey('KeyW', true));
      const gaps = async () =>
        page.evaluate(async () => {
          const out = [];
          let last = performance.now();
          const t0 = last;
          while (performance.now() - t0 < 4000) {
            await new Promise((r) => requestAnimationFrame(r));
            const now = performance.now();
            out.push(now - last);
            last = now;
          }
          out.sort((a, b) => a - b);
          return { frames: out.length, median: +out[out.length >> 1].toFixed(1), p95: +out[Math.floor(out.length * 0.95)].toFixed(1) };
        });
      const flying = await gaps();
      await fly(() => window.__lc.ui.fly.testKey('KeyW', false));
      await fly(() => window.__lc.ui.fly.exit({ instant: true }));
      await page.waitForTimeout(500);
      const builder = await gaps();
      console.log(`bench ${time} ${width}x${height}: flying ${JSON.stringify(flying)} builder ${JSON.stringify(builder)}`);
      await page.keyboard.press('f');
      await waitPhase('flying');
    }
    if (only.includes('out')) {
      // From the street, back to the builder's view.
      if (street) await fly((s) => window.__lc.ui.fly.testPlace(s.eye, s.yaw + 40, -4), street);
      await page.waitForTimeout(400);
      const frames = [await grab(`out-${time}`, 0)];
      await fly(() => window.__lc.ui.fly.testHold(0));
      await page.keyboard.press('Escape');
      await waitPhase('out');
      const steps = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
      for (let i = 0; i < steps.length; i++) {
        await fly((t) => window.__lc.ui.fly.testHold(t), steps[i]);
        await page.waitForTimeout(250);
        frames.push(await grab(`out-${time}`, i + 1));
      }
      await fly(() => window.__lc.ui.fly.testHold(null));
      await waitPhase('off');
      await page.waitForTimeout(300);
      frames.push(await grab(`out-${time}`, 9));
      await shot(`out-${time}`, frames);
      const back = await page.evaluate(() => window.__lc.view.getCamera());
      console.log(`back where it was: ${JSON.stringify(back) === JSON.stringify(from)} ${JSON.stringify(back)}`);
    } else {
      await fly(() => window.__lc.ui.fly.exit({ instant: true }));
    }
  }
  if (errors.length > 0) {
    console.error(`\nThe page reported ${errors.length} error(s):\n${errors.slice(0, 10).join('\n')}`);
    failed = true;
  }
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
