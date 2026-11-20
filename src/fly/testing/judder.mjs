#!/usr/bin/env node
/* global process, console, window, performance, localStorage, setInterval, setTimeout, clearInterval */
// Frame pacing, flying and from the builder's view (fly mode, design section 7). Opens the real app
// on an island, grows a town, and for each run records every frame: the gap between frames (rAF
// timestamps), the main thread's time in the frame (and of it: the view's render, fly mode's frame),
// and with --passes the GPU time of each render pass (the view's profiler: each pass is finished
// before the next starts, so the frame itself is slower than real; read it for the split, not the total).
//
//   node src/fly/testing/judder.mjs [--seed 3] [--size 1500x950] [--scale 2] [--seconds 10]
//                                   [--runs orbit,street,turn] [--passes] [--time day]
//
//   orbit    the builder's view turning, as a mouse drag would (many small uneven moves a frame)
//   street   flying down the longest street with W held, looking about a little
//   turn     turning on the spot, the mouse moving left and right
//
// The mouse is a stream of small, uneven moves at about 500 Hz from a timer in the page, not one step
// a frame, so what is measured is what a hand on a mouse gives.

import { launchBrowser } from '../../../tools/lib/browser.mjs';
import { parseArgs, startServer } from '../../../tools/lib/vite.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const seed = Number(flags.seed ?? 3);
const [width, height] = String(flags.size ?? '1500x950').split('x').map(Number);
const scale = Number(flags.scale ?? 2);
const seconds = Number(flags.seconds ?? 10);
const runs = String(flags.runs ?? 'orbit,street,turn').split(',');
const time = String(flags.time ?? 'day');
const extra = flags.query && flags.query !== true ? `&${flags.query}` : '';

const server = await startServer();
const browser = await launchBrowser();
let failed = false;
try {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  await ctx.addInitScript(() => {
    localStorage.setItem('lc:welcomed', '1');
    // Every frame: when it started (the rAF timestamp) and how long its callbacks took.
    const raf = window.requestAnimationFrame.bind(window);
    const rec = { on: false, frames: [], cur: null };
    window.__judder = rec;
    window.requestAnimationFrame = (cb) =>
      raf((ts) => {
        const t0 = performance.now();
        if (rec.on && (!rec.cur || rec.cur.ts !== ts)) {
          rec.cur = { ts, js: 0, render: 0, fly: 0, start: t0, eye: null };
          rec.frames.push(rec.cur);
        }
        cb(ts);
        if (rec.on && rec.cur) rec.cur.js += performance.now() - t0;
      });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.stack ?? e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${server.url}/?seed=${seed}&gen=1&season=summer&weather=clear${extra}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lc?.ui?.fly !== undefined);
  await page.click('[data-ui="menu-button"]');
  await page.click('[data-menu="grow"]');
  await page.click('[data-menu="grow-here"]');
  await page.waitForFunction(() => window.__lc.ui.growth.active);
  await page.keyboard.press('x');
  await page.waitForFunction(() => !window.__lc.ui.growth.active && window.__lc.world().blocks.size > 100);
  await page.evaluate((t) => window.__lc.signals.hold(t), time);
  await page.waitForTimeout(3000);
  // Time the view's render and fly mode's frame inside each frame.
  await page.evaluate(() => {
    const rec = window.__judder;
    const view = window.__lc.view;
    const render = view.render.bind(view);
    view.render = (s) => {
      const t = performance.now();
      render(s);
      if (rec.on && rec.cur) rec.cur.render += performance.now() - t;
    };
    const fly = window.__lc.ui.fly;
    const frame = fly.frame.bind(fly);
    fly.frame = (dt) => {
      const t = performance.now();
      frame(dt);
      if (rec.on && rec.cur) {
        rec.cur.fly += performance.now() - t;
        rec.cur.eye = window.__lc.view.getEyeCamera()?.eye ?? null;
      }
    };
  });
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
    return { eye: [(best.k & 63) + 0.5, (best.k >> 12) * 0.8 + 0.45, ((best.k >> 6) & 63) + 0.5], yaw: best.yaw };
  });

  /** Runs `seconds` of a motion with the mouse stream going, and returns the frame records. */
  const record = (motion, secs) =>
    page.evaluate(
      async ({ motion, secs }) => {
        const rec = window.__judder;
        const lc = window.__lc;
        let n = 0;
        // About 500 mouse moves a second, uneven: a hand, not a metronome.
        const timer = setInterval(() => {
          n++;
          const swing = Math.sin(n / 180) * 3 + (Math.random() - 0.5) * 1.5;
          if (motion === 'orbit') lc.view.orbit(-swing * 0.35, 0);
          else if (motion === 'turn') lc.ui.fly.testLook(swing, (Math.random() - 0.5) * 0.4);
          else lc.ui.fly.testLook(swing * 0.15, Math.sin(n / 90) * 0.12);
        }, 2);
        rec.frames = [];
        rec.cur = null;
        rec.on = true;
        await new Promise((r) => setTimeout(r, secs * 1000));
        rec.on = false;
        clearInterval(timer);
        return rec.frames.map((f, i) => ({ gap: i === 0 ? 0 : f.ts - rec.frames[i - 1].ts, js: f.js, render: f.render, fly: f.fly, eye: f.eye }));
      },
      { motion, secs },
    );

  const stats = (frames) => {
    const gaps = frames.slice(1).map((f) => f.gap).sort((a, b) => a - b);
    const q = (p) => +gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))].toFixed(1);
    const mean = (k) => +(frames.reduce((s, f) => s + f[k], 0) / frames.length).toFixed(2);
    const max = (k) => +Math.max(...frames.map((f) => f[k])).toFixed(1);
    // Evenness of motion (flying straight at a steady speed): how far the eye moved in a frame, against
    // the frame's own length. 1 everywhere is perfectly even; the spread is judder the eye can see.
    const rates = [];
    for (let i = 2; i < frames.length; i++) {
      const a = frames[i - 1].eye, b = frames[i].eye;
      if (!a || !b || frames[i].gap <= 0) continue;
      const r = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / frames[i].gap;
      // Only while it moves (a street ends; the eye then rests against what is there).
      if (r > 1e-4) rates.push(r);
    }
    rates.sort((a, b) => a - b);
    const mid = rates[rates.length >> 1] || 0;
    const even = mid > 1e-6 ? { p5: +(rates[Math.floor(rates.length * 0.05)] / mid).toFixed(2), p95: +(rates[Math.floor(rates.length * 0.95)] / mid).toFixed(2), min: +(rates[0] / mid).toFixed(2), max: +(rates[rates.length - 1] / mid).toFixed(2) } : null;
    return {
      frames: frames.length,
      even,
      gap: { median: q(0.5), p95: q(0.95), p99: q(0.99), worst: +gaps[gaps.length - 1].toFixed(1), over16_7: gaps.filter((g) => g > 16.7 * 1.25).length, over33: gaps.filter((g) => g > 33.4).length },
      js: { mean: mean('js'), max: max('js') },
      render: { mean: mean('render'), max: max('render') },
      fly: { mean: mean('fly'), max: max('fly') },
    };
  };

  if (flags.ab) {
    // The renderer alone, A/B: the builder's view and the flying eye down the street, alternated so
    // the shared GPU's ups and downs fall on both alike; the middle of nine rounds per pass.
    const ab = await page.evaluate((s) => {
      const lc = window.__lc;
      const view = lc.view;
      const eye = { eye: s.eye, yaw: s.yaw, pitch: -2, fov: 62 };
      const res = { builder: [], flying: [] };
      for (let i = 0; i < 9; i++) {
        view.setEyeCamera(null);
        res.builder.push(view.profilePasses(10, lc.signals));
        view.setEyeCamera(eye);
        res.flying.push(view.profilePasses(10, lc.signals));
      }
      view.setEyeCamera(null);
      const mid = (list) => {
        const out = {};
        for (const k of new Set(list.flatMap((r) => Object.keys(r)))) out[k] = list.map((r) => r[k] ?? 0).sort((a, b) => a - b)[4];
        return out;
      };
      return { builder: mid(res.builder), flying: mid(res.flying) };
    }, street);
    console.log(`ab ${width}x${height}@${scale}: ${JSON.stringify(ab)}`);
  }
  for (const run of runs) {
    if (run === 'none') continue;
    if (run === 'enter') {
      // Taking off and landing, from a fresh page's first flight: frames across both glides.
      const frames = await page.evaluate(async () => {
        const rec = window.__judder;
        rec.frames = [];
        rec.cur = null;
        rec.on = true;
        window.__lc.ui.fly.enter();
        await new Promise((r) => setTimeout(r, 1500));
        window.__lc.ui.fly.exit();
        await new Promise((r) => setTimeout(r, 1500));
        rec.on = false;
        return rec.frames.map((f, i) => ({ gap: i === 0 ? 0 : f.ts - rec.frames[i - 1].ts, js: f.js, render: f.render, fly: f.fly, eye: null }));
      });
      console.log(`enter ${width}x${height}@${scale} ${time}: ${JSON.stringify(stats(frames))}`);
      continue;
    }
    if (run === 'orbit') {
      if (await page.evaluate(() => window.__lc.ui.fly.active)) {
        await page.evaluate(() => window.__lc.ui.fly.exit({ instant: true }));
      }
    } else {
      if (!(await page.evaluate(() => window.__lc.ui.fly.active))) {
        await page.keyboard.press('f');
        await page.waitForFunction(() => window.__lc.ui.fly.phase === 'flying');
      }
      await page.evaluate((s) => window.__lc.ui.fly.testPlace(s.eye, s.yaw, -2), street);
      if (run === 'street') await page.evaluate(() => window.__lc.ui.fly.testKey('KeyW', true));
      if (run === 'street') await page.evaluate(() => window.__lc.ui.fly.testKey('ShiftLeft', false));
    }
    await page.waitForTimeout(500);
    const frames = await record(run, seconds);
    if (run === 'street') await page.evaluate(() => window.__lc.ui.fly.testKey('KeyW', false));
    console.log(`${run} ${width}x${height}@${scale} ${time}: ${JSON.stringify(stats(frames))}`);
    if (flags.debug) console.log(JSON.stringify(frames.slice(0, 12).map((f) => [f.gap.toFixed(2), f.eye?.map((v) => v.toFixed(3))])));
    if (flags.passes) {
      // Three rounds, the middle of each pass kept (the GPU is shared with whatever else runs).
      const passes = await page.evaluate(() => {
        const rounds = [0, 1, 2].map(() => window.__lc.view.profilePasses?.(20, window.__lc.signals) ?? {});
        const out = {};
        for (const k of Object.keys(rounds[0])) out[k] = rounds.map((r) => r[k] ?? 0).sort((a, b) => a - b)[1];
        out.clipControl = !!window.__lc.view.canvas.getContext('webgl2').getExtension('EXT_clip_control');
        return out;
      });
      console.log(`  passes (ms, each finished on its own): ${JSON.stringify(passes)}`);
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
