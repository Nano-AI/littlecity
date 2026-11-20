#!/usr/bin/env node
/* global console, process, window, document, Buffer */
// Close views of the doorsteps (D11) of a scenario, by day: three poses on each door (left, right, low),
// written to .context/doors/<label>/<scenario>-<n>-<pose>.png, with an index of which prop each is.
//
//   node src/render/testing/doors.mjs <scenario> [--label before] [--max 12] [--every 1]

import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { loadModule, parseArgs, ROOT, startServer } from '../../../tools/lib/vite.mjs';

const { positional, flags } = parseArgs(process.argv.slice(2));
const name = positional[0] ?? 'everything';
const label = String(flags.label ?? 'run');
const max = Number(flags.max ?? 12), every = Number(flags.every ?? 1);
const outDir = path.join(ROOT, '.context/doors', label);
fs.mkdirSync(outDir, { recursive: true });

const { mod, close } = await loadModule('/src/render/testing/doors.main.ts');
let doors;
try {
  doors = mod.list(name).filter((_, i) => i % every === 0).slice(0, max);
} finally {
  await close();
}

const server = await startServer();
const browser = await launchBrowser();
const index = [];
try {
  const { page } = await openPage(browser, `${server.url}/tools/shot/index.html`, { width: 900, height: 700 });
  await page.addScriptTag({ type: 'module', url: `${server.url}/src/render/testing/probe.ts` });
  await page.waitForFunction('window.__look !== undefined', null, { timeout: 60_000 });
  await page.evaluate((n) => window.__look.open(n, { width: 480, height: 320, pixelRatio: 3 }), name);
  await page.evaluate(() => window.__look.time('day'));
  // Without the people (who wait at doors) and the door leaves (shown as dark doorways), the mat shows.
  if (!flags.actors) await page.evaluate(() => window.__look.actors(false));
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    for (const pose of d.poses) {
      const { name: _n, ...p } = pose;
      await page.evaluate((p) => window.__look.camera(p), p);
      for (let k = 0; k < 3; k++) await page.evaluate(() => window.__look.frame(0));
      const file = path.join(outDir, `${name}-${i}-${pose.name}.png`);
      // The canvas at its full resolution (3x), the middle half of it: the door and its doorstep.
      const url = await page.evaluate(() => {
        const all = document.querySelectorAll('canvas'), c = all[all.length - 1];
        const o = document.createElement('canvas');
        o.width = c.width / 2;
        o.height = c.height / 2;
        o.getContext('2d').drawImage(c, c.width / 4, c.height / 4, c.width / 2, c.height / 2, 0, 0, o.width, o.height);
        return o.toDataURL('image/png');
      });
      fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    }
    index.push(`${name}-${i}: ${d.id} at ${d.at.map((v) => v.toFixed(2)).join(', ')} ${JSON.stringify(d.params)}`);
  }
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(path.join(outDir, `${name}-index.txt`), index.join('\n') + '\n');
console.log(index.join('\n'));
