#!/usr/bin/env node
/* global console, window, process */
// Things going down, from the owner's angle (design section 13b): low over the sea, looking at the slab's
// front edge, so anything drawn below the water would hang under the map. One row a vessel: the raid's
// longship and one of its rowing boats, a harbour galleon and a small harbour boat, each near the slab's
// edge and out in the harbour; hit by a bomb, then frames as it goes down and after it is under.
//
//   node src/life/testing/sink-frames.mjs [--time day|night] [--zoom 2.4] [--pitch 14] [--only longship-edge,…] [--name after]
//
// Output: .context/shots/seq/sink-<name>-<time>.png

import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { parseArgs, ROOT, startServer } from '../../../tools/lib/vite.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const FRAME = 1000 / 60;
const time = String(flags.time ?? 'night');
const zoom = Number(flags.zoom ?? 2.4);
const pitch = Number(flags.pitch ?? 14);
const only = flags.only ? String(flags.only).split(',') : null;
const W = 420, H = 280;
/** Seconds after the hit at which a frame is kept (the last ones well after it is under). */
const AFTER = [0, 1.5, 3, 5, 7, 10, 14, 20];
const server = await startServer();
const browser = await launchBrowser();
const rows = [];

/** The yaw (degrees) that puts the camera out beyond the map edge nearest (x, z), looking in. */
const outward = (x, z) => {
  const d = [[x, -90], [48 - x, 90], [z, 180], [48 - z, 0]].sort((a, b) => a[0] - b[0]);
  return d[0][1];
};

try {
  const open = async (scenario) => {
    const { page } = await openPage(browser, `${server.url}/?scenario=${scenario}&mischief`, { width: W, height: H });
    await page.waitForFunction(() => window.__lc !== undefined, null, { timeout: 60_000 });
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
    await page.evaluate((t) => window.__lc.signals.hold(t), time);
    await page.addStyleTag({ content: '.lc-ui, body > *:not(#town) { display: none !important; }' });
    for (let i = 0; i < 60; i++) await page.clock.runFor(FRAME);
    return page;
  };
  const play = async (page, seconds) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) await page.clock.runFor(FRAME);
  };
  /** Plays until `until` (evaluated in the page) gives a point [x, z, yaw?], or null after `most` seconds. */
  const waitFor = async (page, until, arg, most = 240) => {
    for (let i = 0; i < most * 4; i++) {
      const at = await page.evaluate(until, arg);
      if (at) return at;
      await play(page, 0.25);
    }
    return null;
  };
  /** Aims low at (x, z) from beyond the nearest edge; bombs it from `off` cells away; keeps frames. */
  const film = async (page, label, at, bomb, extra = 0) => {
    const [x, z] = at;
    const yaw = outward(x, z);
    await page.evaluate(([px, pz, yw, zm, pt]) => window.__lc.view.setCamera({ target: [px, 0.2, pz], yaw: yw, zoom: zm, pitch: pt }), [x, z, yaw, zoom, pitch]);
    await play(page, 2 / 60);
    const shots = [];
    shots.push({ png: await page.locator('#town').screenshot(), label: `${label}: before` });
    await page.evaluate(bomb, at);
    let t = 0;
    for (const s of AFTER.slice(1)) {
      await play(page, s + extra - t);
      t = s + extra;
      shots.push({ png: await page.locator('#town').screenshot(), label: `${label}: +${(s + extra).toFixed(1)} s` });
    }
    rows.push(shots);
    console.log(label, 'filmed at', x.toFixed(1), z.toFixed(1), 'yaw', yaw);
  };
  const want = (k) => !only || only.includes(k);
  const bombBeside = ([x, z]) => window.__lc.mischief.dropBomb([x + 0.6, 0.45, z + 0.6]);

  // The raid's longship: just in over the edge under sail, and in the harbour coming round to the beach.
  for (const where of ['edge', 'mid']) {
    if (!want(`longship-${where}`)) continue;
    const page = await open('raid-landing');
    await page.evaluate(() => window.__lc.raids.summon({ at: null, kind: 'landing' }));
    const at = await waitFor(page, (w) => {
      const r = window.__lc.raids.current;
      if (!r?.ship) return null;
      const s = r.ship;
      const edge = Math.min(s.x, s.z, 48 - s.x, 48 - s.z);
      if (w === 'edge') return r.shipState === 'arrive' && !s.edgeCut && edge > 3 ? [s.x, s.z] : null;
      return r.shipState === 'spin' ? [s.x, s.z] : null;
    }, where);
    if (at) await film(page, `longship, ${where}`, at, ([x, z]) => {
      const s = window.__lc.raids.current.ship;
      window.__lc.mischief.dropBomb([s.x + Math.cos(s.yaw) * 1.2, 0.6, s.z - Math.sin(s.yaw) * 1.2]);
      void x; void z;
    });
    else console.log(`longship, ${where}: not found`);
    await page.close();
  }

  // A raid's rowing boat: just in over the edge, and rowing in across the harbour.
  for (const where of ['edge', 'mid']) {
    if (!want(`boat-${where}`)) continue;
    const page = await open('raid-boats');
    await page.evaluate(() => window.__lc.raids.summon({ at: null, kind: 'boats' }));
    const at = await waitFor(page, (w) => {
      const r = window.__lc.raids.current;
      const b = r?.boats[0];
      if (!b) return null;
      const edge = Math.min(b.x, b.z, 48 - b.x, 48 - b.z);
      if (w === 'edge') return r.boatState[0] === 'row-in' && !b.edgeCut && edge > 2.5 ? [b.x, b.z] : null;
      const l = r.site.landings[0];
      return r.boatState[0] === 'row-in' && Math.hypot(b.x - l.x, b.z - l.z) < 6 ? [b.x, b.z] : null;
    }, where);
    if (at) await film(page, `rowing boat, ${where}`, at, () => {
      const b = window.__lc.raids.current.boats[0];
      window.__lc.mischief.dropBomb([b.x + Math.cos(b.yaw) * 0.8, 0.6, b.z - Math.sin(b.yaw) * 0.8]);
    });
    else console.log(`rowing boat, ${where}: not found`);
    await page.close();
  }

  // A harbour galleon: under way near the edge, and moored at its quay.
  for (const where of ['edge', 'mid']) {
    if (!want(`galleon-${where}`)) continue;
    const page = await open('grown-harbour');
    const at = await waitFor(page, (w) => {
      const h = window.__lcHarbour;
      const s = h?.ships.find((q) => {
        const edge = Math.min(q.pose.x, q.pose.z, 48 - q.pose.x, 48 - q.pose.z);
        return w === 'edge' ? (q.phase === 'arriving' || q.phase === 'leaving') && edge > 3 && edge < 7 : q.phase === 'moored';
      });
      if (!s) return null;
      const mid = (s.hull.stern + s.hull.bow) / 2;
      return [s.pose.x + Math.sin(s.pose.yaw) * mid, s.pose.z + Math.cos(s.pose.yaw) * mid];
    }, where, 400);
    if (at) await film(page, `galleon, ${where}`, at, bombBeside);
    else console.log(`galleon, ${where}: not found`);
    await page.close();
  }

  // A small harbour boat (rowing, sailing or fishing), capsized: it floats hull up for half a minute, then goes under.
  if (want('small')) {
    const page = await open('grown-harbour');
    const at = await waitFor(page, () => {
      for (const [id, c] of window.__lcThrown?.critters ?? []) {
        if (id.startsWith('boat:') && !c.body && c.x > 3 && c.x < 45 && c.z > 3 && c.z < 45) return [c.x, c.z];
      }
      return null;
    }, null, 120);
    if (at) await film(page, 'small boat, capsized', at, ([x, z]) => window.__lc.mischief.dropBomb([x + 0.3, 0.45, z]), 28);
    else console.log('small boat: not found');
    await page.close();
  }

  const cols = AFTER.length;
  const ctx = await browser.newContext({ viewport: { width: cols * W + (cols + 1) * 6, height: rows.length * (H + 22) + 6 } });
  const sheet = await ctx.newPage();
  await sheet.setContent(
    `<body style="margin:0;background:#2b2622;font:12px/16px system-ui;color:#f2ede3"><div style="display:grid;grid-template-columns:repeat(${cols},${W}px);gap:6px;padding:6px">${rows
      .flat()
      .map((s) => `<div><img width="${W}" height="${H}" style="display:block" src="data:image/png;base64,${s.png.toString('base64')}"><div style="height:16px">${s.label}</div></div>`)
      .join('')}</div></body>`,
  );
  const out = path.join(ROOT, '.context/shots/seq', `sink-${flags.name ?? 'sheet'}-${time}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sheet.screenshot({ path: out });
  console.log(path.relative(ROOT, out));
} finally {
  await browser.close();
  await server.close?.();
  process.exit(0);
}
