#!/usr/bin/env node
// npm run shots -- [glob] [--time day|dusk|night|dawn] [--season spring|summer|autumn|winter|festival|<0..1>]
//                  [--weather clear|cloudy|rain|storm|fog|wind|snow] [--settle 2] [--size 1280x800] [--scale 1] [--out dir] [--list]
//
// Renders every scenario matching the glob from each of its cameras, with
// headless Chromium and WebGL, to .context/shots/<name>-<camera>.png in THIS
// checkout. Starts its own server on a free port, so it is safe to run from
// several worktrees at once. No glob means every scenario.
//
//   npm run shots -- hello-town
//   npm run shots -- 'R-H*' --time dusk
//   npm run shots -- 'rules/**'

import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openPage } from './lib/browser.mjs';
import { parseArgs, ROOT, startServer } from './lib/vite.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const pattern = positional[0];
const [width, height] = String(flags.size ?? '1280x800').split('x').map(Number);
const scale = Number(flags.scale ?? 1);
const outDir = path.resolve(ROOT, String(flags.out ?? '.context/shots'));
const time = flags.time === undefined ? undefined : Number.isNaN(Number(flags.time)) ? flags.time : Number(flags.time);
// Seasons (design section 13a): summer and clear unless asked; --settle is seconds of life before the shot.
const season = flags.season === undefined ? undefined : Number.isNaN(Number(flags.season)) ? flags.season : Number(flags.season);
const weather = flags.weather === undefined ? undefined : String(flags.weather);
const settle = flags.settle === undefined ? undefined : Number(flags.settle);

const server = await startServer();
const browser = await launchBrowser();
let failed = false;
try {
  const { page, errors } = await openPage(browser, `${server.url}/tools/shot/index.html`, { width, height, scale });
  await page.waitForFunction(() => window.__shot !== undefined, null, { timeout: 60_000 });
  const wanted = await page.evaluate((p) => window.__shot.match(p), pattern ?? null);
  if (wanted.length === 0) {
    console.error(`No scenario matches '${pattern}'. Scenarios: ${(await page.evaluate(() => window.__shot.match(null))).map((s) => s.name).join(', ')}`);
    failed = true;
  }
  if (flags.list) {
    for (const s of wanted) console.log(`${s.name}\t${s.cameras.join(',')}\t${s.file}`);
  } else {
    fs.mkdirSync(outDir, { recursive: true });
    for (const s of wanted) {
      for (let c = 0; c < s.cameras.length; c++) {
        const t0 = Date.now();
        const stats = await page.evaluate(([name, cam, opts]) => window.__shot.show(name, cam, opts), [s.name, c, { time, season, weather, settle }]);
        const suffix = [season, weather, time].filter((v) => v !== undefined).map((v) => `-${v}`).join('');
        const file = path.join(outDir, `${s.name}-${s.cameras[c]}${suffix}.png`);
        await page.locator('#town').screenshot({ path: file });
        console.log(`${path.relative(ROOT, file)}  (${stats.blocks} blocks, ${stats.drawCalls} draw calls, ${stats.triangles} triangles, ${Date.now() - t0} ms)`);
      }
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
