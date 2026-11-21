#!/usr/bin/env node
// npm run indexnow
//
// Tells Bing, Yandex, Seznam and Naver (IndexNow) that every page in the live sitemap is new or
// changed, so they crawl it now instead of whenever they next pass. Google does not use IndexNow:
// it reads the sitemap submitted in Search Console. Run after a deploy that adds or rewrites pages,
// not after every deploy (asking for unchanged pages again is wasted and may be ignored).
//
/* global fetch */
// The key proves the site is ours: https://littlecity.io/<KEY>.txt holds it (public/<KEY>.txt).

const KEY = '7c1f4e2a9b8d4c6e8a5f3b2d1e0c9a87';
const HOST = 'littlecity.io';

const res = await fetch(`https://${HOST}/sitemap.xml`);
if (!res.ok) throw new Error(`sitemap: HTTP ${res.status}`);
const urls = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const sent = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`indexnow: ${urls.length} urls, HTTP ${sent.status} ${sent.statusText}`);
if (sent.status >= 400) process.exit(1);
