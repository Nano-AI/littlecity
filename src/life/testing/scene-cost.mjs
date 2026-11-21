#!/usr/bin/env node
/* global console, window, performance, process */
// Frame cost with the town's scenes on (L57 and L63–L66): opens a scenario in
// the real app with a season held, plays life until scenes are going, and
// times frames (the app's whole frame: life, then drawing), against the same
// town with the scenes' chains idle (before any has begun).
//
//   node src/life/testing/scene-cost.mjs [scenario] [--season summer] [--weather clear] [--settle] [--warm 120000] [--frames 240]
//   --raid landing|boats   instead of the scenes: a raid summoned after the first timing, and timed again once
//                          the band is ashore with fires burning (--warm is then counted from the summons)
//   --fires 18             the same fires with no raid: that many houses set alight, spread through the town

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
  if (flags.fires) {
    // The same fire without a raid: that many of the town's houses set alight, spread through it (to tell the
    // raid's own cost from the fire's).
    console.log(`fires: ${await page.evaluate((n) => {
      const lc = window.__lc;
      const shape = lc.shape();
      const houses = [...shape.structures.values()].filter((s) => s.kind === 'house');
      let lit = 0;
      for (let i = 0; i < houses.length && lit < n; i += Math.max(1, Math.floor(houses.length / n))) if (lc.mischief.ignite(houses[i].cells[0])) lit++;
      return lit;
    }, Number(flags.fires))} lit`);
  }
  if (flags.raid) console.log(`raid: ${await page.evaluate((kind) => window.__lc.raids.summon({ at: null, kind }) ?? window.__lc.raids.current.kind, String(flags.raid))}`);
  const warm = Number(flags.warm ?? (flags.raid || flags.fires ? 45000 : 120000));
  for (let i = 0; i < warm / FRAME; i++) await page.clock.runFor(FRAME);
  console.log(`burning: ${await page.evaluate(() => window.__lc.mischief.engine.burning().length)} cells`);
  if (flags.raid) console.log(`raid now: ${await page.evaluate(() => { const r = window.__lc.raids.current; return r ? `${r.beat}, ${r.raiders.filter((x) => x.person).length} ashore, ${window.__lc.mischief.engine.burning().length} cells burning` : 'over'; })}`);
  const during = await time(frames);
  console.log(`scenes on:     median ${during.median.toFixed(2)} ms, p95 ${during.p95.toFixed(2)} ms  [${await scenes()}]`);
} finally {
  await browser.close();
  await server.close?.();
  process.exit(0);
}
