#!/usr/bin/env node
/* global console, window, performance, process */
// Frame cost with the town's scenes on (L57 and L63–L66): opens a scenario in
// the real app with a season held, plays life until scenes are going, and
// times frames (the app's whole frame: life, then drawing), against the same
// town with the scenes' chains idle (before any has begun).
//
//   node src/life/testing/scene-cost.mjs [scenario] [--season summer] [--weather clear] [--settle] [--warm 120000] [--frames 240]

import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { parseArgs, startServer } from '../../../tools/lib/vite.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const scenario = positional[0] ?? 'grown-town-4';
const frames = Number(flags.frames ?? 240);
const FRAME = 1000 / 60;
const server = await startServer();
const browser = await launchBrowser();
try {
  let q = `scenario=${encodeURIComponent(scenario)}&season=${flags.season ?? 'summer'}&weather=${flags.weather ?? 'clear'}`;
  if (flags.settle) q += '&settle=1';
  const { page } = await openPage(browser, `${server.url}/?${q}`, { width: 1280, height: 800 });
  await page.waitForFunction(() => window.__lc !== undefined, null, { timeout: 60_000 });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.evaluate(() => window.__lc.signals.hold('day'));
  const time = async (n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      await page.clock.runFor(FRAME);
      out.push(performance.now() - t0);
    }
    out.sort((a, b) => a - b);
    return { median: out[n >> 1], p95: out[Math.floor(n * 0.95)] };
  };
  const scenes = () => page.evaluate(() => (window.__lcTown?.board.chains ?? []).map((c) => c.id + ':' + (c.on?.length ?? c.phase ?? (c.on ? 1 : 0))).filter((s) => /beach|snow|supper|picnic|wedding/.test(s)).join(' '));
  const before = await time(frames);
  console.log(`before scenes: median ${before.median.toFixed(2)} ms, p95 ${before.p95.toFixed(2)} ms  [${await scenes()}]`);
  const warm = Number(flags.warm ?? 120000);
  for (let i = 0; i < warm / FRAME; i++) await page.clock.runFor(FRAME);
  const during = await time(frames);
  console.log(`scenes on:     median ${during.median.toFixed(2)} ms, p95 ${during.p95.toFixed(2)} ms  [${await scenes()}]`);
} finally {
  await browser.close();
  await server.close?.();
  process.exit(0);
}
