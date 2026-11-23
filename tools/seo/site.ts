// The pages search engines read (npm run seo, run by tools/deploy-pages.sh after the build).
//
// The game itself is one canvas: a crawler that opens littlecity.io finds a title and nothing to
// read. So the build also writes plain HTML pages with no script at all:
//
//   /about/              what Little City is, how it plays, the kinds of town, questions people ask
//   /guide/              every special building and event, grouped as in the game's guide
//   /guide/<id>/         one entry: its picture (public/guide/<id>.webp), the guide's own sentence
//                        on how to get it, and the others in its group
//   /404.html            GitHub Pages serves it for any address that is not a file
//   /sitemap.xml         every page above, with the guide pictures (Google Images)
//
// The guide pages are written from src/guide/entries.ts, the same entries the game's guide shows
// and guide.test.ts proves, so a page can never promise a building the rules do not make.
//
// Pure: pages in, strings out. tools/seo.mjs writes them to disk.

import { ENTRIES, GROUPS, type GuideEntry, type GuideGroup } from '@/guide/entries';

export const ORIGIN = 'https://littlecity.io';
export const NAME = 'Little City';
export const TAGLINE = 'a hand-drawn town diorama builder';
/** The one-sentence pitch: the page description and the start of every page about the game. */
/** Who made the game: named as its author on every page and in the structured data. */
export const CREATOR = 'Derek Yao';
export const PITCH = 'A hand-drawn town diorama builder, free in your browser. Place a few blocks, watch them turn into a town, then watch it come to life.';

export interface SitePage {
  /** Path from the site root, without a leading slash: 'about/index.html'. */
  file: string;
  /** Absolute URL, or null for a page that is not in the sitemap (the 404). */
  url: string | null;
  html: string;
  /** Pictures on the page, for the image sitemap. */
  images: { url: string; title: string }[];
  priority: number;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** JSON for a <script type="application/ld+json">: nothing in it can close the tag. */
const ld = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c');

/** Cut to at most `max` characters at a word, with an ellipsis if anything was cut. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).replace(/[,;:.\s]+$/, '')}…`;
}

const pictureOf = (e: GuideEntry): string => `${ORIGIN}/guide/${e.id}.webp`;
const pageOf = (e: GuideEntry): string => `${ORIGIN}/guide/${e.id}/`;
const groupTitle = (g: GuideGroup): string => GROUPS.find((x) => x.id === g)?.title ?? g;

const CSS = `
:root{--paper:#f2ede3;--card:#fbf8f1;--ink:#3a2f2a;--soft:#7a6a5e;--line:#d9cfbf;--accent:#c4633f}
*{box-sizing:border-box}
html{background:var(--paper)}
body{margin:0;color:var(--ink);font:400 17px/1.6 ui-rounded,'SF Pro Rounded','Nunito','Varela Round',system-ui,-apple-system,'Segoe UI',sans-serif}
a{color:inherit;text-decoration-color:var(--line);text-underline-offset:3px}
a:hover{text-decoration-color:var(--accent)}
header,main,footer{max-width:760px;margin:0 auto;padding:0 20px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:18px;padding-bottom:6px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:19px;text-decoration:none}
.brand img{width:32px;height:32px}
nav{display:flex;gap:16px;font-size:15px;align-items:center}
.play{display:inline-block;background:var(--ink);color:var(--paper);text-decoration:none;font-weight:700;padding:9px 18px;border-radius:999px}
.play:hover{background:var(--accent)}
.play.big{font-size:19px;padding:13px 26px;margin:8px 0 4px}
h1{font-size:34px;line-height:1.2;margin:28px 0 10px}
h2{font-size:23px;margin:38px 0 8px}
h3{font-size:18px;margin:22px 0 4px}
p,li{color:var(--ink)}
.lede{font-size:20px;color:var(--soft)}
.hero{width:100%;height:auto;border-radius:14px;border:1px solid var(--line);margin:18px 0 6px;display:block}
.caption{font-size:14px;color:var(--soft);margin:0 0 8px}
.crumbs{font-size:14px;color:var(--soft);margin-top:20px}
.crumbs a{color:var(--soft)}
.shot{display:block;margin:12px auto 4px;width:360px;max-width:100%;height:auto}
.how{font-size:20px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin:14px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:0;margin:12px 0;list-style:none}
.grid a{display:block;text-align:center;text-decoration:none;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 6px 10px;font-size:15px;font-weight:600}
.grid a:hover{border-color:var(--accent)}
.grid img{display:block;width:100%;height:auto;aspect-ratio:4/3}
dt{font-weight:700;margin-top:16px}
dd{margin:4px 0 0}
footer{margin-top:48px;padding-top:18px;padding-bottom:40px;border-top:1px solid var(--line);font-size:14px;color:var(--soft)}
footer a{color:var(--soft)}
@media (max-width:520px){h1{font-size:28px}nav .hide-sm{display:none}}
`;

interface Shell {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  body: string;
  data: unknown[];
  type?: 'website' | 'article';
  /** The trailer is this page's main content (og:video). */
  video?: boolean;
}

function page(s: Shell): string {
  const url = `${ORIGIN}${s.path}`;
  const image = s.image ?? `${ORIGIN}/og.jpg`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.title)}</title>
<meta name="description" content="${esc(s.description)}">
<link rel="canonical" href="${url}">
<meta name="author" content="${CREATOR}">
<meta name="theme-color" content="#f2ede3">
<meta property="og:type" content="${s.type ?? 'website'}">
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${esc(s.title)}">
<meta property="og:description" content="${esc(s.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:alt" content="${esc(s.imageAlt ?? 'A hand-drawn island town with a castle, a harbour, a chapel and a lighthouse.')}">
${s.video ? `<meta property="og:video" content="${ORIGIN}/preview.mp4">\n<meta property="og:video:secure_url" content="${ORIGIN}/preview.mp4">\n<meta property="og:video:type" content="video/mp4">\n<meta property="og:video:width" content="1280">\n<meta property="og:video:height" content="720">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(s.title)}">
<meta name="twitter:description" content="${esc(s.description)}">
<meta name="twitter:image" content="${image}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<style>${CSS.trim()}</style>
${s.data.map((d) => `<script type="application/ld+json">${ld(d)}</script>`).join('\n')}
</head>
<body>
<header>
<a class="brand" href="/"><img src="/favicon.svg" alt="" width="32" height="32">${NAME}</a>
<nav><a class="hide-sm" href="/about/">About</a><a class="hide-sm" href="/guide/">Guide</a><a class="play" href="/">Play free</a></nav>
</header>
<main>
${s.body.trim()}
</main>
<footer>
<p><strong>${NAME}</strong> is ${TAGLINE} by ${CREATOR}. Free, in your browser, on a computer or a phone. <a href="/">Play now</a> · <a href="/about/">About the game</a> · <a href="/guide/">The building guide</a></p>
</footer>
</body>
</html>
`;
}

/** The game, as structured data: the same node on every page, so search engines tie them together. */
export function gameData(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': ['VideoGame', 'WebApplication'],
    '@id': `${ORIGIN}/#game`,
    name: NAME,
    url: `${ORIGIN}/`,
    description: PITCH,
    image: `${ORIGIN}/og.jpg`,
    genre: ['City builder', 'Town builder', 'Diorama', 'Sandbox', 'Relaxing'],
    keywords: 'diorama builder, town builder, city builder, hand-drawn, cozy game, relaxing game, sandbox, browser game, free online game',
    gamePlatform: ['Web browser', 'PC', 'Mac', 'iPhone', 'iPad', 'Android'],
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any (runs in a web browser)',
    playMode: 'SinglePlayer',
    isAccessibleForFree: true,
    inLanguage: 'en',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    author: creator(),
    creator: creator(),
    publisher: creator(),
    trailer: trailer(),
  };
}

function creator(): Record<string, unknown> {
  return { '@type': 'Person', '@id': `${ORIGIN}/#creator`, name: CREATOR };
}

/** The trailer (public/preview.mp4, 58 s). Shown as the main thing at the top of /about/, so Google can index it there. */
export function trailer(): Record<string, unknown> {
  return {
    '@type': 'VideoObject',
    '@id': `${ORIGIN}/about/#trailer`,
    name: `${NAME} trailer: ${TAGLINE}`,
    description: `A drone flies in from the sea over a hand-drawn island town in ${NAME}: under the washing lines, through the square where a wedding is on, and out over the quay. ${NAME} is ${TAGLINE} by ${CREATOR}.`,
    thumbnailUrl: [`${ORIGIN}/og.jpg`],
    contentUrl: `${ORIGIN}/preview.mp4`,
    embedUrl: `${ORIGIN}/about/`,
    uploadDate: '2026-11-21T00:00:00-08:00',
    duration: 'PT58S',
    width: 1280,
    height: 720,
    author: creator(),
    publisher: creator(),
  };
}

/** The site, as structured data: what makes Google show "Little City" as the site's name. */
export function siteData(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${ORIGIN}/#site`,
    name: NAME,
    alternateName: ['littlecity.io', 'Little City game', 'Little City city builder'],
    url: `${ORIGIN}/`,
    creator: creator(),
  };
}

function crumbs(items: [name: string, url: string][]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };
}

function tile(e: GuideEntry): string {
  return `<li><a href="/guide/${e.id}/"><img src="/guide/${e.id}.webp" alt="${esc(e.name)} in Little City" width="180" height="135" loading="lazy">${esc(e.name)}</a></li>`;
}

// ── /about/ ──────────────────────────────────────────────────────────────

/** The questions on the about page, answered from what the game really does. */
export const FAQ: readonly [q: string, a: string][] = [
  ['Who made Little City?', `${CREATOR}.`],
  ['Is it free?', 'Yes. It runs in your browser: nothing to download, no account.'],
  ['Does it work on a phone?', 'Yes, on iPhone, iPad and Android as well as on a computer.'],
  ['Does my town save?', 'Yes, by itself, in your browser. You can also share a town as a link, or save it as a postcard.'],
];

export function aboutPage(): SitePage {
  const examples = ['chapel', 'lighthouse', 'watermill', 'market-day', 'wedding', 'stone-bridge', 'keep', 'orchard']
    .map((id) => ENTRIES.find((e) => e.id === id))
    .filter((e): e is GuideEntry => e !== undefined);
  const body = `
<h1>${NAME}</h1>
<p class="lede">A tiny, hand-drawn town diorama. Something like a snow globe you build yourself.</p>
<a class="play big" href="/">Play</a>
<video class="hero" controls muted playsinline preload="metadata" poster="/og.jpg" width="1280" height="720" title="${NAME} trailer">
<source src="/preview.mp4" type="video/mp4">
<img src="/og.jpg" alt="A hand-drawn island town in ${NAME}, with a castle, a harbour, a chapel and a lighthouse." width="1200" height="630">
</video>
<p class="caption">A drone flight over a town grown in the game.</p>

<p>Place a few blocks and they turn into a town. What each one becomes depends on where you put it. A house beside a tall tower becomes a chapel. Four blocks stacked by the sea become a lighthouse. A path becomes a street, with lamps and benches along it.</p>
<p>Then people move in. The miller carries flour down to the bakery, and the baker takes the bread to the stall on the square. Boats go out in the morning and come back with fish. Washing goes up on the lines. Some days there's a market. Sometimes there's a wedding.</p>
<p>The seasons turn. It snows. The lamps come on at dusk.</p>
<p>You can also skip the building: grow a whole town on a new island (a harbour town, a castle town, a farming village) and just watch it.</p>
<p>There are over 80 things to find. <a href="/guide/">The guide</a> has all of them.</p>
<ul class="grid">${examples.map(tile).join('')}</ul>

<h2>A few questions</h2>
<dl>${FAQ.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('')}</dl>

<p><a class="play big" href="/">Play ${NAME}</a></p>
`;
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return {
    file: 'about/index.html',
    url: `${ORIGIN}/about/`,
    priority: 0.9,
    images: [{ url: `${ORIGIN}/og.jpg`, title: `${NAME}: ${TAGLINE}` }],
    html: page({
      title: `About ${NAME}: a tiny, hand-drawn town diorama by ${CREATOR}`,
      description: PITCH,
      path: '/about/',
      body,
      video: true,
      data: [gameData(), siteData(), { '@context': 'https://schema.org', ...trailer() }, faqData, crumbs([[NAME, `${ORIGIN}/`], ['About', `${ORIGIN}/about/`]])],
    }),
  };
}

// ── /guide/ ──────────────────────────────────────────────────────────────

export function guideIndexPage(): SitePage {
  const sections = GROUPS.map((g) => {
    const entries = ENTRIES.filter((e) => e.group === g.id);
    if (entries.length === 0) return '';
    return `<h2 id="${g.id}">${esc(g.title)}</h2><ul class="grid">${entries.map(tile).join('')}</ul>`;
  }).join('\n');
  const body = `
<p class="crumbs"><a href="/">${NAME}</a> › Guide</p>
<h1>The ${NAME} guide</h1>
<p class="lede">You never pick a building from a menu in ${NAME}. You put blocks down and the town decides what they become. Here are all ${ENTRIES.length} special buildings and events, and how to get each one.</p>
<a class="play big" href="/">Play ${NAME} free</a>
${sections}
`;
  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${NAME} building guide`,
    itemListElement: ENTRIES.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.name, url: pageOf(e) })),
  };
  return {
    file: 'guide/index.html',
    url: `${ORIGIN}/guide/`,
    priority: 0.8,
    images: ENTRIES.map((e) => ({ url: pictureOf(e), title: `${e.name} in ${NAME}` })),
    html: page({
      title: `${NAME} guide: all ${ENTRIES.length} special buildings and how to get them`,
      description: `How to get every special building in ${NAME}: the chapel, the lighthouse, the keep, the watermill, market day, a wedding and the rest.`,
      path: '/guide/',
      body,
      data: [list, crumbs([[NAME, `${ORIGIN}/`], ['Guide', `${ORIGIN}/guide/`]]), gameData()],
    }),
  };
}

export function entryPage(e: GuideEntry): SitePage {
  const group = groupTitle(e.group);
  const others = ENTRIES.filter((x) => x.group === e.group && x.id !== e.id);
  // A happening (the guide's event groups) carries a `when`.
  const event = e.when !== undefined;
  const heading = `${e.name} in ${NAME}`;
  const howTo = event ? 'how to make it happen' : 'how to build it';
  const intro = event
    ? `${e.name} is one of the things a town does by itself in ${NAME}, ${TAGLINE}. Nobody schedules it: build the right places and it happens on its own.`
    : `In ${NAME} you never choose a building from a menu. Put the blocks down like this and the town does the rest.`;
  const body = `
<p class="crumbs"><a href="/">${NAME}</a> › <a href="/guide/">Guide</a> › <a href="/guide/#${e.group}">${esc(group)}</a></p>
<h1>${esc(heading)}</h1>
<img class="shot" src="/guide/${e.id}.webp" alt="${esc(e.name)} in ${NAME}, drawn in ink and pencil" width="360" height="270">
<p class="how"><strong>How to get it:</strong> ${esc(e.how)}</p>
<p>${esc(intro)}</p>
<a class="play big" href="/">Try it, free in your browser</a>
${others.length ? `<h2>More in ${esc(group)}</h2><ul class="grid">${others.map(tile).join('')}</ul>` : ''}
<p><a href="/guide/">All ${ENTRIES.length} buildings and events</a> · <a href="/about/">About ${NAME}</a></p>
`;
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: heading,
    description: e.how,
    image: pictureOf(e),
    url: pageOf(e),
    about: { '@id': `${ORIGIN}/#game` },
    isPartOf: { '@id': `${ORIGIN}/#site` },
  };
  return {
    file: `guide/${e.id}/index.html`,
    url: pageOf(e),
    priority: 0.6,
    images: [{ url: pictureOf(e), title: `${e.name} in ${NAME}` }],
    html: page({
      title: `${e.name}: ${howTo} | ${NAME} guide`,
      description: clip(`${e.how} ${NAME} is ${TAGLINE}, free in your browser.`, 160),
      path: `/guide/${e.id}/`,
      image: `${ORIGIN}/og.jpg`,
      imageAlt: `${e.name} in ${NAME}`,
      type: 'article',
      body,
      data: [article, crumbs([[NAME, `${ORIGIN}/`], ['Guide', `${ORIGIN}/guide/`], [e.name, pageOf(e)]])],
    }),
  };
}

export function notFoundPage(): SitePage {
  const body = `
<h1>This street isn't built yet</h1>
<p class="lede">There's nothing at this address. The town is this way.</p>
<a class="play big" href="/">Go to ${NAME}</a>
<p><a href="/guide/">The building guide</a> · <a href="/about/">About the game</a></p>
`;
  const html = page({ title: `Not found | ${NAME}`, description: PITCH, path: '/404.html', body, data: [] }).replace(
    '<link rel="canonical" href="https://littlecity.io/404.html">',
    '<meta name="robots" content="noindex">',
  );
  return { file: '404.html', url: null, priority: 0, images: [], html };
}

/** Every page the build writes, the home page first in the sitemap (the game's own index.html). */
export function sitePages(): SitePage[] {
  return [aboutPage(), guideIndexPage(), ...ENTRIES.map(entryPage), notFoundPage()];
}

export function sitemap(pages: readonly SitePage[], lastmod: string): string {
  const home = { url: `${ORIGIN}/`, priority: 1, images: [{ url: `${ORIGIN}/og.jpg`, title: `${NAME}: ${TAGLINE}` }] };
  const rows = [home, ...pages.filter((p) => p.url !== null)].map(
    (p) =>
      `  <url>\n    <loc>${p.url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${p.priority.toFixed(1)}</priority>\n${p.images
        .map((i) => `    <image:image><image:loc>${i.url}</image:loc><image:title>${esc(i.title)}</image:title></image:image>\n`)
        .join('')}  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${rows.join('\n')}\n</urlset>\n`;
}
