#!/usr/bin/env node
/* global performance, requestAnimationFrame */
// node tools/phone-bench.mjs [scenario ...] [--throttle 4] [--seconds 6] [--query 'a=b']
//
// Frame time of the real app on an EMULATED phone: headless Chromium with a
// 390 × 844 viewport at device scale 3, touch, a mobile user agent, and the
// CPU slowed down by --throttle (Chrome DevTools' CPU throttling). This is
// not a real phone: the GPU is this machine's. Default scenarios: bench-600
// and everything. --query adds URL parameters (the app's ?ink=, ?density=).

import { launchBrowser, openPage } from './lib/browser.mjs';
import { parseArgs, startServer } from './lib/vite.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const names = positional.length ? positional : ['bench-600', 'everything'];
const throttle = Number(flags.throttle ?? 4);
const seconds = Number(flags.seconds ?? 6);
const extra = flags.query ? `&${flags.query}` : '';
const sorted = (xs) => [...xs].sort((a, b) => a - b);
const med = (xs) => sorted(xs)[Math.floor(xs.length / 2)];
const p95 = (xs) => sorted(xs)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const name of names) {
    const { page, errors } = await openPage(browser, `${server.url}/?scenario=${encodeURIComponent(name)}${extra}`, {
      width: 390,
      height: 844,
      scale: 3,
      hasTouch: true,
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    });
    await page.waitForFunction(() => window.__lc !== undefined, null, { timeout: 120_000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    // Let the dressing arrive and life settle.
    await page.waitForTimeout(4000);
    const r = await page.evaluate(async (ms) => {
      const gaps = [];
      let last = performance.now();
      const end = last + ms;
      await new Promise((done) => {
        const tick = (now) => {
          gaps.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
      const lc = window.__lc;
      const stats = lc.view.stats();
      return {
        gaps,
        drawCalls: stats.drawCalls,
        triangles: stats.triangles,
        blocks: lc.world().blocks.size,
        props: lc.game.dressing?.props.length ?? null,
        canvas: [document.getElementById('town').width, document.getElementById('town').height],
      };
    }, seconds * 1000);
    // Edits: an Auto block on top of a column of the town, as a tap places it; then the frames until
    // the dressing has arrived (the slowest of the next eight).
    const edits = await page.evaluate(async () => {
      const lc = window.__lc;
      const out = [];
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      for (let i = 0, tries = 0; out.length < 8 && tries < 200; tries++, i++) {
        const blocks = [...lc.world().blocks.keys()];
        const c = blocks[(i * 7919) % blocks.length];
        const x = c & 63, z = (c >> 6) & 63;
        let y = 0;
        while (lc.world().blocks.has(x | (z << 6) | (y << 12)) || y < lc.terrain().height[x + z * 48]) y++;
        if (y > 30) continue;
        const below = y > 0 && lc.world().blocks.has(x | (z << 6) | ((y - 1) << 12)) ? x | (z << 6) | ((y - 1) << 12) : null;
        await frame();
        const t0 = performance.now();
        if (!lc.edit({ type: 'placeBlock', cell: x | (z << 6) | (y << 12), kind: 'auto', color: 'auto', from: below })) continue;
        const editMs = performance.now() - t0;
        let worst = 0, last = performance.now();
        for (let k = 0; k < 8; k++) {
          const now = await frame();
          worst = Math.max(worst, now - last);
          last = now;
        }
        out.push({ editMs, worst });
      }
      return out;
    });
    const editLine = !edits.length ? '' : (
        `  one edit (shape + rebuild, in the tap's handler): ${med(edits.map((e) => e.editMs)).toFixed(1)} ms median / ${p95(edits.map((e) => e.editMs)).toFixed(1)} ms p95;` +
          ` slowest frame after it (the dressing arriving): ${med(edits.map((e) => e.worst)).toFixed(1)} ms median`);
    const fps = (1000 * r.gaps.length) / r.gaps.reduce((a, b) => a + b, 0);
    console.log(
      `${name}: ${r.blocks} blocks, canvas ${r.canvas[0]}×${r.canvas[1]}, ${r.drawCalls} draw calls, ${(r.triangles / 1e6).toFixed(2)} M triangles` +
        `\n  emulated phone, CPU ${throttle}× slower: frame ${med(r.gaps).toFixed(1)} ms median / ${p95(r.gaps).toFixed(1)} ms p95 (${fps.toFixed(1)} fps over ${seconds} s)`,
    );
    if (editLine) console.log(editLine);
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(0);
