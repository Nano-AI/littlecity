#!/usr/bin/env node
// npm run guide -- [id ...] [--sheet] [--quality 0.8]
//
// Renders every guide entry's recipe town (src/guide/entries.ts) to
// public/guide/<id>.webp: 180 × 135 shown, drawn at 2× (360 × 270), by day,
// with nothing that moves by chance, cut out as a soft vignette on a
// transparent background. Pictures of entries that no longer exist are
// deleted. With ids, only those entries are drawn (and nothing is deleted).
//
// --sheet also writes .context/shots/guide-sheet.png: every picture on one
// cream page with its name, to judge the set at thumbnail size.

import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openPage } from './lib/browser.mjs';
import { parseArgs, ROOT, startServer } from './lib/vite.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const outDir = path.join(ROOT, 'public', 'guide');
const quality = Number(flags.quality ?? 0.8);
const WIDTH = 180, HEIGHT = 135, SCALE = 2;

const server = await startServer();
const browser = await launchBrowser();
let failed = false;
try {
  const { page, errors } = await openPage(browser, `${server.url}/tools/guide/index.html`, { width: WIDTH, height: HEIGHT, scale: SCALE });
  await page.waitForFunction(() => window.__guide !== undefined, null, { timeout: 60_000 });
  const all = await page.evaluate(() => window.__guide.ids());
  const unknown = positional.filter((id) => !all.includes(id));
  if (unknown.length) throw new Error(`no guide entry ${unknown.join(', ')}; entries: ${all.join(', ')}`);
  const ids = positional.length ? positional : all;
  fs.mkdirSync(outDir, { recursive: true });
  let total = 0;
  for (const id of ids) {
    const url = await page.evaluate(([i, q]) => window.__guide.render(i, { quality: q }), [id, quality]);
    if (!url.startsWith('data:image/webp')) throw new Error(`the browser did not make a WebP for ${id}`);
    const bytes = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    fs.writeFileSync(path.join(outDir, `${id}.webp`), bytes);
    total += bytes.length;
    console.log(`public/guide/${id}.webp  ${(bytes.length / 1024).toFixed(1)} KB`);
  }
  if (!positional.length) {
    for (const f of fs.readdirSync(outDir)) {
      if (!f.startsWith('.') && !all.includes(f.replace(/\.webp$/, ''))) {
        fs.rmSync(path.join(outDir, f));
        console.log(`removed public/guide/${f} (no such entry)`);
      }
    }
  }
  console.log(`${ids.length} pictures, ${(total / 1024).toFixed(0)} KB`);

  if (flags.sheet) {
    const shotDir = path.join(ROOT, '.context', 'shots');
    fs.mkdirSync(shotDir, { recursive: true });
    const cards = all
      .map((id) => {
        const data = fs.readFileSync(path.join(outDir, `${id}.webp`)).toString('base64');
        return `<figure><img src="data:image/webp;base64,${data}"><figcaption>${id}</figcaption></figure>`;
      })
      .join('');
    const sheet = await browser.newPage({ viewport: { width: 1400, height: 800 } });
    await sheet.setContent(
      `<style>body{margin:16px;background:#fbf6ea;font:13px system-ui;display:grid;grid-template-columns:repeat(8,1fr);gap:10px}
       figure{margin:0;text-align:center}img{width:144px;height:108px}</style>${cards}`,
    );
    const file = path.join(shotDir, 'guide-sheet.png');
    await sheet.screenshot({ path: file, fullPage: true });
    console.log(path.relative(ROOT, file));
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
