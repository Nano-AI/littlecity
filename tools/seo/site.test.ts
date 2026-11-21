import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '@/guide/entries';
import { ORIGIN, sitemap, sitePages } from './site';

const pages = sitePages();
const field = (html: string, re: RegExp): string => re.exec(html)?.[1] ?? '';

describe('the pages search engines read', () => {
  it('has a page for every guide entry, and its picture exists', () => {
    for (const e of ENTRIES) {
      expect(pages.some((p) => p.file === `guide/${e.id}/index.html`), e.id).toBe(true);
      expect(fs.existsSync(path.join('public', 'guide', `${e.id}.webp`)), `public/guide/${e.id}.webp`).toBe(true);
    }
  });

  it('gives every page a title, a description short enough to show whole, and one canonical address', () => {
    const titles = new Set<string>();
    for (const p of pages) {
      const title = field(p.html, /<title>(.*?)<\/title>/);
      const description = field(p.html, /<meta name="description" content="(.*?)">/);
      expect(title.length, p.file).toBeGreaterThan(10);
      expect(description.length, p.file).toBeGreaterThan(50);
      expect(description.length, p.file).toBeLessThanOrEqual(160);
      expect(titles.has(title), `two pages titled ${title}`).toBe(false);
      titles.add(title);
      if (p.url) expect(field(p.html, /<link rel="canonical" href="(.*?)">/), p.file).toBe(p.url);
      else expect(p.html, p.file).toContain('noindex');
    }
  });

  it('writes structured data that parses', () => {
    for (const p of pages) {
      for (const m of p.html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) expect(() => JSON.parse(m[1]!), p.file).not.toThrow();
    }
  });

  it('lists the home page and every indexable page once in the sitemap, and nothing else', () => {
    const urls = [...sitemap(pages, '2026-11-21').matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls[0]).toBe(`${ORIGIN}/`);
    expect(urls.length).toBe(1 + pages.filter((p) => p.url).length);
  });

  it('links only to pages that exist', () => {
    const files = new Set(pages.map((p) => p.file));
    for (const p of pages) {
      for (const m of p.html.matchAll(/href="(\/[^"#]*)/g)) {
        const href = m[1]!;
        if (href === '/' || /\.(svg|png|webmanifest)$/.test(href)) continue;
        expect(files.has(`${href.slice(1)}index.html`), `${p.file} links to ${href}`).toBe(true);
      }
    }
  });
});
