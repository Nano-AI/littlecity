#!/usr/bin/env node
// npm run bench [-- <scenario>] [--frames 120] [--no-browser]
//
// Prints the design section 14 numbers for the synthetic 2,000-block town:
// both logic stages after one edit (in Node and in the browser), geometry
// rebuild after one edit, frame time and draw calls. Starts its own server
// on a free port.

import { launchBrowser, openPage } from './lib/browser.mjs';
import { loadModule, parseArgs, startServer } from './lib/vite.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const name = positional[0] ?? 'bench-2000';
const frames = Number(flags.frames ?? 120);

const sorted = (xs) => [...xs].sort((a, b) => a - b);
const median = (xs) => (xs.length ? sorted(xs)[Math.floor(xs.length / 2)] : NaN);
const p95 = (xs) => (xs.length ? sorted(xs)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] : NaN);
const ms = (x) => `${x.toFixed(2)} ms`;
const row = (label, value, budget) => console.log(`  ${label.padEnd(44)} ${String(value).padEnd(26)} ${budget ?? ''}`);

let failed = false;

// ── logic, in Node ──────────────────────────────────────────────────────────
{
  const { mod, close } = await loadModule('/tools/bench.main.ts');
  try {
    const r = mod.main(name);
    console.log(`\nLittle City benchmark: ${r.scenario} (${r.blocks} blocks, ${r.structures} structures, ${r.rules} rules ran)\n`);
    console.log('Logic in Node (median / p95 over ' + r.runs + ' edits)');
    row('resolveShape() after one edit', `${ms(median(r.shapeMs))} / ${ms(p95(r.shapeMs))}`, 'budget ≤ 8 ms');
    row('resolveDressing() after one edit', `${ms(median(r.dressingMs))} / ${ms(p95(r.dressingMs))}`, 'budget ≤ 30 ms');
    row('building the scenario (all edits)', ms(r.buildMs));
    if (r.slowestRules.some((s) => s.ms > 0)) {
      console.log('  slowest rules (mean per resolve):');
      for (const s of r.slowestRules) if (s.ms > 0) console.log(`    ${s.rule.padEnd(40)} ${ms(s.ms)}`);
    }
  } catch (err) {
    console.error(err);
    failed = true;
  } finally {
    await close();
  }
}

// ── frames, geometry and logic, in the browser ──────────────────────────────
if (!flags['no-browser'] && !failed) {
  const server = await startServer();
  const browser = await launchBrowser();
  try {
    const { page, errors } = await openPage(browser, `${server.url}/tools/shot/index.html`, { width: 1280, height: 800, scale: 2 });
    await page.waitForFunction(() => window.__shot !== undefined, null, { timeout: 60_000 });
    const r = await page.evaluate(([n, f]) => window.__shot.bench(n, f), [name, frames]);
    const fps = 1000 / (r.frameMs.reduce((a, b) => a + b, 0) / r.frameMs.length);
    console.log(`\nBrowser (headless Chromium, 1280 × 800 at 2×, GPU: ${r.gpu})`);
    row('frame rate over ' + r.frames + ' frames', `${fps.toFixed(1)} fps`, 'budget 60 fps');
    row('frame time (median / p95)', `${ms(median(r.frameMs))} / ${ms(p95(r.frameMs))}`);
    row('update + render CPU time (median / p95)', `${ms(median(r.renderMs))} / ${ms(p95(r.renderMs))}`);
    row('draw calls per frame', r.drawCalls, 'budget ≤ 150');
    row('triangles per frame', r.triangles);
    if (r.frameTriangles?.length) {
      const mean = r.frameTriangles.reduce((a, b) => a + b, 0) / r.frameTriangles.length;
      const low = Math.min(...r.frameTriangles);
      const redraws = r.frameTriangles.filter((t) => t > low * 1.5).length;
      row('triangles per frame (mean, with grounding)', `${(mean / 1e6).toFixed(2)} M`);
      row('frames that redrew the grounding picture', `${redraws} of ${r.frameTriangles.length}`);
    }
    row('resolveShape() after one edit', `${ms(median(r.edits.map((e) => e.shapeMs)))} / ${ms(p95(r.edits.map((e) => e.shapeMs)))}`, 'budget ≤ 8 ms');
    row('resolveDressing() after one edit', `${ms(median(r.edits.map((e) => e.dressingMs)))} / ${ms(p95(r.edits.map((e) => e.dressingMs)))}`, 'budget ≤ 30 ms');
    row('geometry rebuild after one edit', `${ms(median(r.edits.map((e) => e.rebuildMs)))} / ${ms(p95(r.edits.map((e) => e.rebuildMs)))}`, 'budget ≤ 8 ms');
    if (errors.length) {
      console.error(`\nThe page reported errors:\n${errors.slice(0, 10).join('\n')}`);
      failed = true;
    }
  } catch (err) {
    console.error(err);
    failed = true;
  } finally {
    await browser.close();
    await server.close();
  }
}
console.log('');
process.exit(failed ? 1 : 0);
