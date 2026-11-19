#!/usr/bin/env node
/* global console, process, window, document, performance */
// The view's own benchmark (Look). `npm run bench` measures the standard
// town with a fixed list of edits that are not legal in every scenario; this
// one works on any scenario and says where a rebuild's time goes.
//
//   node src/render/testing/bench.mjs [scenario ...] [--auto]     default: bench-2000 everything
//
// Per scenario: draw calls and whole-frame time at rest (CPU and GPU, synced
// by a pixel read), then 30 single edits: resolveShape, the view's rebuild
// split into generators / layers / parts / the view itself, and the frame
// after the edit (which also redraws the grounding picture).

import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { startServer } from '../../../tools/lib/vite.mjs';

const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
// --auto places Auto blocks (as `npm run bench` does) instead of houses.
const kind = process.argv.includes('--auto') ? 'auto' : 'house';
const sorted = (xs) => [...xs].sort((a, b) => a - b);
const med = (xs) => sorted(xs)[Math.floor(xs.length / 2)];
const p95 = (xs) => sorted(xs)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];
const mp = (xs) => `${med(xs).toFixed(2)} / ${p95(xs).toFixed(2)} ms`;

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const name of names.length ? names : ['bench-2000', 'everything']) {
    const { page, errors } = await openPage(browser, `${server.url}/tools/shot/index.html`, { width: 1280, height: 800, scale: 2 });
    await page.addScriptTag({ type: 'module', url: `${server.url}/src/render/testing/probe.ts` });
    await page.waitForFunction('window.__look !== undefined');
    const r = await page.evaluate(([n, kind]) => {
      const look = window.__look;
      const structures = look.open(n, { ink: 'full', pixelRatio: 2, width: 1280, height: 800 });
      const canvases = document.querySelectorAll('canvas');
      const gl = canvases[canvases.length - 1].getContext('webgl2');
      const px = new Uint8Array(4);
      const frame = () => {
        const t = performance.now();
        look.orbit(0.5, 0);
        look.frameOnly(1 / 60);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return performance.now() - t;
      };
      for (let i = 0; i < 20; i++) frame();
      const rest = [];
      for (let i = 0; i < 120; i++) rest.push(frame());
      const still = look.frame();
      look.spawn(60);
      const moving = { still: look.moving('still'), spawned: look.moving('spawned'), prop: look.moving('prop') };
      const edits = look.editBench(34, kind).slice(4); // the first few warm the JIT
      return { structures, rest, drawCalls: still.drawCalls, triangles: still.triangles, edits, moving };
    }, [name, kind]);
    const col = (k) => r.edits.map((e) => e[k]);
    console.log(`\n${name}: ${r.structures} structures, ${r.triangles} triangles`);
    console.log(`  draw calls at rest              ${r.drawCalls}`);
    console.log(`  whole frame at rest (med / p95) ${mp(r.rest)}`);
    const mv = (m) => `${m.ms.toFixed(2)} ms, ${m.drawCalls.toFixed(1)} draw calls`;
    console.log(`  whole frame, camera still:`);
    console.log(`    nothing moving                ${mv(r.moving.still)}`);
    console.log(`    60 actors moving every frame  ${mv(r.moving.spawned)}   (kept out of the grounding picture)`);
    console.log(`    one prop moving every frame   ${mv(r.moving.prop)}   (redraws the grounding picture every other frame)`);
    console.log(`  after one edit (a ${kind} block), over ${r.edits.length} edits (med / p95):`);
    console.log(`    resolveShape                  ${mp(col('shapeMs'))}`);
    console.log(`    view rebuild, total           ${mp(col('rebuildMs'))}     budget 8 ms`);
    console.log(`      in structure generators     ${mp(col('generators'))}   (${med(col('structures'))} structures, ${med(col('vertices'))} vertices rebuilt)`);
    console.log(`      in layers (terrain, ...)    ${mp(col('layers'))}`);
    console.log(`      in prop and actor parts     ${mp(col('parts'))}`);
    console.log(`      in the view itself          ${mp(col('view'))}`);
    console.log(`    the frame after the edit      ${mp(col('frameMs'))}`);
    console.log(`    then the dressing arrives (${med(col('items'))} props and actors):`);
    console.log(`      resolveDressing             ${mp(col('dressingMs'))}`);
    console.log(`      view.setDressing, total     ${mp(col('dressMs'))}`);
    console.log(`        in prop and actor parts   ${mp(col('dressParts'))}`);
    console.log(`        in the view itself        ${mp(col('dressView'))}`);
    if (errors.length) console.log('  page errors:', errors.slice(0, 3));
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
