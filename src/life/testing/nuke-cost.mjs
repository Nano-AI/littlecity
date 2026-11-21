#!/usr/bin/env node
/* global console, window, performance, process */
// Frame cost of a nuke in a grown town, with people blown about and without
// (window.__lcStill keeps everybody on their feet): the app's whole frame
// (life, then drawing), timed over the second of the bang and the three
// seconds of flights after it. Each run opens the town afresh.
//
//   node src/life/testing/nuke-cost.mjs [scenario] [--warm 20000] [--runs 2]

import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { parseArgs, startServer } from '../../../tools/lib/vite.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const scenario = positional[0] ?? 'grown-town-1';
const runs = Number(flags.runs ?? 2);
const FRAME = 1000 / 60;
const server = await startServer();
const browser = await launchBrowser();
const stats = (out) => {
  const s = [...out].sort((a, b) => a - b);
  return `median ${s[s.length >> 1].toFixed(1)} ms, p95 ${s[Math.floor(s.length * 0.95)].toFixed(1)} ms`;
};
try {
  for (let run = 0; run < runs; run++) {
    for (const still of [true, false]) {
      const { page } = await openPage(browser, `${server.url}/?scenario=${encodeURIComponent(scenario)}`, { width: 1280, height: 800 });
      await page.waitForFunction(() => window.__lc !== undefined, null, { timeout: 60_000 });
      await page.clock.install({ time: 0 });
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
      await page.evaluate((s) => { window.__lc.signals.hold('day'); window.__lcStill = s; }, still);
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
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
