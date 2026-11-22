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
export const TAGLINE = 'a peaceful, hand-drawn city builder';
/** The one-sentence pitch: the page description and the start of every page about the game. */
/** Who made the game: named as its author on every page and in the structured data. */
export const CREATOR = 'Derek Yao';
export const PITCH =
  'A peaceful, hand-drawn city builder sandbox. No money, no goals, no tycoon: place a few blocks and watch a little town come alive. Free, in your browser.';

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
<p><strong>${NAME}</strong> is ${TAGLINE} you play in your browser, on a computer or a phone. Free, no download, no account. Made by ${CREATOR}. <a href="/">Play now</a> · <a href="/about/">About the game</a> · <a href="/guide/">The building guide</a></p>
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
    genre: ['City builder', 'Sandbox', 'Simulation', 'Casual', 'Relaxing'],
    keywords: 'city builder, town builder, sandbox, cozy game, relaxing game, hand-drawn, browser game, free online game, no download',
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
    description: `A drone flies in from the sea over a hand-drawn island town in ${NAME}: under the washing lines, through the square where a wedding is on, and out over the quay. ${NAME} is a free, peaceful city builder made by ${CREATOR}.`,
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
  ['Who made Little City?', `Little City is made by ${CREATOR}.`],
  ['Is Little City free?', 'Yes. It is free to play in your browser, with no download, no sign-up and no ads.'],
  ['Is it a tycoon game?', 'No. There is no money, no budget, no zoning and no score. Nothing can go wrong. You build what you like and the town works out the rest.'],
  [
    'How is it different from Cities: Skylines?',
    'Cities: Skylines is a full city simulation with traffic, taxes and services to manage. Little City has none of that. It is a calm sandbox: closer to building a model town than running one.',
  ],
  ['Does it work on a phone?', 'Yes. It runs in the browser on iPhone, iPad and Android as well as on a computer.'],
  ['Is my town saved?', 'Yes. Your town saves itself in your browser as you build, and you can share any town as a link or save it as a picture postcard.'],
  [
    'What are the special buildings?',
    'Put pieces together in the right places and they turn into something: a house beside a tall tower becomes a chapel, a house opening onto a square becomes a shop, a tall stack by the sea becomes a lighthouse. The guide lists every one.',
  ],
  ['Can I play without building anything?', 'Yes. Open the menu, choose Grow a town, and watch a whole town grow on a new island by itself. Then fly over it.'],
];

export function aboutPage(): SitePage {
  const examples = ['chapel', 'lighthouse', 'watermill', 'market-day', 'wedding', 'stone-bridge', 'keep', 'orchard']
    .map((id) => ENTRIES.find((e) => e.id === id))
    .filter((e): e is GuideEntry => e !== undefined);
  const body = `
<h1>${NAME}: ${TAGLINE}</h1>
<p class="lede">${esc(PITCH)}</p>
<a class="play big" href="/">Play ${NAME} free</a>
<video class="hero" controls muted playsinline preload="metadata" poster="/og.jpg" width="1280" height="720" title="${NAME} trailer">
<source src="/preview.mp4" type="video/mp4">
<img src="/og.jpg" alt="A hand-drawn island town in ${NAME}, with a castle, a harbour, a chapel and a lighthouse." width="1200" height="630">
</video>
<p class="caption">The ${NAME} trailer: a drone flight over a town grown in the game.</p>

<h2>A city builder with nothing to manage</h2>
<p>${NAME} is a cozy sandbox for building towns. There is no money to run out of, no traffic to fix, no taxes, no goals and no way to lose. You place a few pieces (a house, a tower, a path, a dock) and the town quietly works out what they should be. It is the calm part of a city builder and nothing else: put on the music, build a harbour, watch the lamps come on at dusk.</p>
<p>If you love the look of a town in games like Cities: Skylines but not the spreadsheets, or you want something as gentle as building a model village, this is that.</p>

<h2>The town figures itself out</h2>
<p>Every piece looks at what is around it. A house beside a tall tower becomes a chapel. A house that opens onto a square becomes a shop, and a big one where travellers arrive becomes the inn. Three blocks stacked make a tower; four stacked by the sea make a lighthouse. Blocks across a gap become an arch, blocks on the water become a dock, and a run of path becomes a street with lamps, benches and flower boxes. Over 80 special buildings and events are waiting to be found; <a href="/guide/">the guide</a> shows how to get every one.</p>

<h2>A town that is alive</h2>
<p>The best part is watching. People leave their houses in the morning and go to work, and you can follow the work from start to finish: the miller carries flour from the windmill to the bakery, the baker carries the loaves to the market stall, and the neighbours walk home with a loaf under their arm. Fishermen row out and bring in the catch. Washing goes up on the lines. Ships come in to the quay.</p>
<p>A town earns its days, too: a market day on the square, a wedding at the chapel with a procession through the streets, a beach day, picnics in the park, a snow day with snowball fights, a harvest supper. The seasons turn, day turns to dusk and night, and the windows light up one by one.</p>

<h2>Every island is different</h2>
<p>Each new island has its own coast, hills and rivers. Choose <em>Grow a town</em> from the menu and a whole town grows on it by itself, in one of eight characters: a harbour town, a marble city, a castle town, a market town, a river town, a farming village, a hill town or a garden town. Then build on it, change it, or just fly over it.</p>

<h2>Things to find</h2>
<ul class="grid">${examples.map(tile).join('')}</ul>

<h2>Who made it</h2>
<p>${NAME} is designed and made by ${CREATOR}. It is free to play at <a href="/">littlecity.io</a>.</p>

<h2>Questions</h2>
<dl>${FAQ.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('')}</dl>

<p><a class="play big" href="/">Start building</a></p>
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
      title: `About ${NAME}: a peaceful, hand-drawn city builder by ${CREATOR}`,
      description: clip(`${PITCH} A cozy town-building sandbox with no tycoon: the town builds and lives by itself.`, 160),
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
<h1>The ${NAME} guide: every special building and how to get it</h1>
<p class="lede">In ${NAME} you never pick a building from a menu. You put simple pieces down and the town decides what they become. These are the ${ENTRIES.length} special buildings and events, and how to make each one.</p>
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
      title: `${NAME} guide: all ${ENTRIES.length} special buildings and how to build them`,
      description: clip(`How to build every special building in ${NAME}: chapel, lighthouse, castle keep, watermill, market day, a wedding and more. ${PITCH}`, 160),
      path: '/guide/',
      body,
      data: [list, crumbs([[NAME, `${ORIGIN}/`], ['Guide', `${ORIGIN}/guide/`]]), gameData()],
    }),
  };
}

export function entryPage(e: GuideEntry): SitePage {
  const group = groupTitle(e.group);
  const others = ENTRIES.filter((x) => x.group === e.group && x.id !== e.id);
  const event = e.group === 'events';
  const heading = `${e.name} in ${NAME}`;
  const howTo = event ? 'how to make it happen' : 'how to build it';
  const intro = event
    ? `${e.name} is one of the days a town earns in ${NAME}, ${TAGLINE}. Nobody schedules it: build the right places and the town holds it by itself.`
    : `In ${NAME}, ${TAGLINE}, you never choose a building from a menu. Put the pieces down like this and the town does the rest.`;
  const body = `
<p class="crumbs"><a href="/">${NAME}</a> › <a href="/guide/">Guide</a> › <a href="/guide/#${e.group}">${esc(group)}</a></p>
<h1>${esc(heading)}</h1>
<img class="shot" src="/guide/${e.id}.webp" alt="${esc(e.name)} in ${NAME}, drawn in ink and pencil" width="360" height="270">
<p class="how"><strong>How to get it:</strong> ${esc(e.how)}</p>
<p>${esc(intro)}</p>
<a class="play big" href="/">Try it now, free in your browser</a>
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
