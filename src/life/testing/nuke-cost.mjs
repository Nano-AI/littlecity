#!/usr/bin/env node
/* global console, window, performance, process */
// Frame cost of a nuke in a grown town, with people blown about and without
// (window.__lcStill keeps everybody on their feet): the app's whole frame
// (life, then drawing), timed over the second of the bang and the three
// seconds of flights after it. Each run opens the town afresh.
//
//   node src/life/testing/nuke-cost.mjs [scenario] [--warm 20000] [--runs 2] [--fly 60]
//
// --fly: how many times a second people in the air are moved (window.__lcFlyRate; the game's own is 30).
// Each line is one run; the summary at the end is the median, over the runs, of each figure.

import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { parseArgs, startServer } from '../../../tools/lib/vite.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const scenario = positional[0] ?? 'grown-town-1';
const runs = Number(flags.runs ?? 2);
const FRAME = 1000 / 60;
const server = await startServer();
const browser = await launchBrowser();
const q = (out, k) => [...out].sort((a, b) => a - b)[Math.floor((out.length - 1) * k)];
const stats = (out) => `median ${q(out, 0.5).toFixed(1)} ms, p95 ${q(out, 0.95).toFixed(1)} ms`;
const summary = { still: [], thrown: [] };
try {
  for (let run = 0; run < runs; run++) {
    for (const still of [true, false]) {
      const { page } = await openPage(browser, `${server.url}/?scenario=${encodeURIComponent(scenario)}`, { width: 1280, height: 800 });
      await page.waitForFunction(() => window.__lc !== undefined, null, { timeout: 60_000 });
      await page.clock.install({ time: 0 });
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
      await page.evaluate(([s, f]) => { window.__lc.signals.hold('day'); window.__lcStill = s; if (f) window.__lcFlyRate = f; }, [still, flags.fly ? Number(flags.fly) : 0]);
      await page.clock.runFor(Number(flags.warm ?? 20000));
      const out = await page.evaluate(() => (window.__lcPeople?.people ?? []).filter((p) => p.visible).length);
      await page.evaluate(() => window.__lc.mischief.dropNuke([24.5, 0.8, 24.5]));
      // The fall (NUKE.fall), then the bang.
      await page.clock.runFor(2400);
      const time = async (n) => {
        const t = [];
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          await page.clock.runFor(FRAME);
          t.push(performance.now() - t0);
        }
        return t;
      };
      const bang = await time(60);
      const flight = await time(180);
      const thrown = await page.evaluate(() => (window.__lcPeople?.people ?? []).filter((p) => p.mode === 'thrown').length);
      console.log(`${still ? 'still  ' : 'thrown '} ${out} out: bang ${stats(bang)}; after ${stats(flight)}; thrown at the end ${thrown}`);
      summary[still ? 'still' : 'thrown'].push([q(bang, 0.5), q(bang, 0.95), q(flight, 0.5), q(flight, 0.95)]);
      await page.close();
    }
  }
  for (const k of ['still', 'thrown']) {
    const m = [0, 1, 2, 3].map((i) => q(summary[k].map((r) => r[i]), 0.5).toFixed(1));
    console.log(`${k}: medians over ${summary[k].length} runs: bang median ${m[0]}, p95 ${m[1]}; after median ${m[2]}, p95 ${m[3]} (ms)`);
  }
} finally {
  await browser.close();
  await server.close();
}
