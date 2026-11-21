#!/usr/bin/env node
// npm run seo -- <built site dir>
//
// Writes the pages search engines read into a built site (tools/seo/site.ts says what and why):
// /about/, /guide/, /guide/<id>/ for every guide entry, /404.html and /sitemap.xml.
// tools/deploy-pages.sh runs it on every deploy, after `vite build`.

import fs from 'node:fs';
import path from 'node:path';
import { loadModule, parseArgs } from './lib/vite.mjs';

const { positional } = parseArgs(process.argv.slice(2));
const out = positional[0];
if (!out || !fs.existsSync(path.join(out, 'index.html'))) {
  console.error('usage: npm run seo -- <built site dir> (the folder vite build wrote, with index.html in it)');
  process.exit(1);
}

const { mod, close } = await loadModule('/tools/seo/site.ts');
try {
  const pages = mod.sitePages();
  for (const p of pages) {
    const file = path.join(out, p.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, p.html);
  }
  // The home page is the game's own (index.html): give it the game and the site as structured data.
  const home = path.join(out, 'index.html');
  const marker = /<!-- seo:data[^>]*-->/;
  const index = fs.readFileSync(home, 'utf8');
  if (!marker.test(index)) throw new Error('index.html has lost its <!-- seo:data --> marker');
  const data = [mod.gameData(), mod.siteData()].map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`).join('\n    ');
  fs.writeFileSync(home, index.replace(marker, data));
  const lastmod = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(out, 'sitemap.xml'), mod.sitemap(pages, lastmod));
  console.log(`seo: wrote ${pages.length} pages and sitemap.xml (${pages.filter((p) => p.url).length + 1} urls) to ${out}`);
} finally {
  await close();
}
