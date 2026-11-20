#!/usr/bin/env node
/* global process, console, window, performance, requestAnimationFrame */
// Shaping the land, measured (design section 14 budgets):
//
//   node src/render/testing/land-bench.mjs [--runs 30] [--no-browser]
//
// In Node: town logic after one raise or dig (one column) on the 2,000-block
// town, warm as the app runs it, and the terrain chunks that edit rebuilds;
// the slowest terrain chunk of a steep island. In the browser: the view's
// whole geometry rebuild after one land edit on the same town, and after a
// stroke's frame of 20 columns.

import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { loadModule, parseArgs, startServer } from '../../../tools/lib/vite.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const runs = Number(flags.runs ?? 30);
const sorted = (xs) => [...xs].sort((a, b) => a - b);
const median = (xs) => (xs.length ? sorted(xs)[Math.floor(xs.length / 2)] : NaN);
const p95 = (xs) => (xs.length ? sorted(xs)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] : NaN);
const ms = (x) => `${x.toFixed(2)} ms`;
const row = (label, value, budget) => console.log(`  ${label.padEnd(46)} ${String(value).padEnd(26)} ${budget ?? ''}`);

{
  const { mod, close } = await loadModule('/src/render/testing/land-bench.main.ts');
  try {
    const r = mod.main(runs);
    console.log(`\nShaping the land: bench-2000 (${r.blocks} blocks), ${r.shapeMs.length} single-column edits\n`);
    row('resolveShape() after one raise or dig', `${ms(median(r.shapeMs))} / ${ms(p95(r.shapeMs))}`, 'budget ≤ 8 ms');
    row('resolveDressing() after it', `${ms(median(r.dressingMs))} / ${ms(p95(r.dressingMs))}`, 'budget ≤ 30 ms');
    console.log('  slowest shape rules: ' + r.slowest.join(', '));
    row('terrain chunks rebuilt per edit', `${median(r.chunks)} (max ${Math.max(...r.chunks)})`);
    row('their build time (Node)', `${ms(median(r.chunkMs))} / ${ms(p95(r.chunkMs))}`);
    row(`steep island (seed ${r.steepSeed}): slowest chunk`, `${ms(Math.max(...r.steepChunkMs))} (median ${ms(median(r.steepChunkMs))})`);
  } finally {
    await close();
  }
}

if (!flags['no-browser']) {
  const server = await startServer();
  const browser = await launchBrowser();
  try {
    const { page } = await openPage(browser, `${server.url}/?scenario=bench-2000`, { width: 1280, height: 800 });
    await page.waitForFunction('window.__lc !== undefined && window.__lc.ui !== null', null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const out = await page.evaluate(async (n) => {
      const lc = window.__lc;
      const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const one = [];
      const strokes = [];
      const town = [...lc.world().blocks.keys()];
      for (let i = 0; i < n; i++) {
        const c = town[(i * 7919) % town.length];
        const col = (c & 63) + ((c >> 6) & 63) * 48;
        const e = { type: 'land', up: i % 2 ? [col] : [], down: i % 2 ? [] : [col] };
        if (!lc.game.can(e).ok) continue;
        const t0 = performance.now();
        lc.game.edit(e);
        const logic = performance.now() - t0;
        one.push({ total: logic, rebuild: lc.view.stats().rebuildMs });
        await frame();
        await frame();
      }
      // A stroke's frame: 20 columns in a row, one edit (the interface gathers a frame's columns into one).
      for (let i = 0; i < 6; i++) {
        const z = 14 + i * 3;
        const cols = [];
        for (let x = 14; x < 34; x++) cols.push(x + z * 48);
        const e = { type: 'land', up: cols, down: [] };
        if (!lc.game.can(e).ok) continue;
        const t0 = performance.now();
        lc.game.edit(e);
        strokes.push({ total: performance.now() - t0, rebuild: lc.view.stats().rebuildMs });
        await frame();
        await frame();
      }
      return { one, strokes };
    }, runs);
    console.log('\nIn the browser (median / p95)');
    row('one raise or dig: logic + rebuild', `${ms(median(out.one.map((o) => o.total)))} / ${ms(p95(out.one.map((o) => o.total)))}`);
    row('  of which geometry rebuild', `${ms(median(out.one.map((o) => o.rebuild)))} / ${ms(p95(out.one.map((o) => o.rebuild)))}`, 'budget ≤ 8 ms');
    row('a 20-column stroke frame: logic + rebuild', `${ms(median(out.strokes.map((o) => o.total)))} / ${ms(p95(out.strokes.map((o) => o.total)))}`);
    row('  of which geometry rebuild', `${ms(median(out.strokes.map((o) => o.rebuild)))} / ${ms(p95(out.strokes.map((o) => o.rebuild)))}`);
  } finally {
    await browser.close();
    await server.close();
  }
}
