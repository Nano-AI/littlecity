#!/usr/bin/env node
/* global console, window, document, process, Buffer */
// The field guide's picture for the Raid tool (src/ui/mischief.ts): a raid is life, not a recipe town, so the
// guide tool cannot draw it. This plays a landing raid on the `raid-landing` scenario until the longship is
// up on the beach and the band is charging, frames it, and writes public/guide/raid.webp (360 × 270, as the
// guide's own pictures are drawn at twice their size).
//
//   node src/life/testing/raid-picture.mjs [--wait 5500] [--zoom 6] [--yaw 45]

import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { parseArgs, ROOT, startServer } from '../../../tools/lib/vite.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const FRAME = 1000 / 60;
const server = await startServer();
const browser = await launchBrowser();
try {
  const { page } = await openPage(browser, `${server.url}/?scenario=raid-landing`, { width: 960, height: 720 });
  await page.waitForFunction(() => window.__lc !== undefined, null, { timeout: 60_000 });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.evaluate(() => window.__lc.signals.hold('day'));
  for (let i = 0; i < 120; i++) await page.clock.runFor(FRAME);
  console.log(await page.evaluate(() => window.__lc.raids.summon({ at: null, kind: 'landing' }) ?? 'raid on its way'));
  // Until it is beached and the band is ashore.
  for (let i = 0; i < 60 * 60; i++) {
    await page.clock.runFor(FRAME);
    if (await page.evaluate(() => window.__lc.raids.current?.shipState === 'beached')) break;
  }
  for (let i = 0; i < Number(flags.wait ?? 5500) / FRAME; i++) await page.clock.runFor(FRAME);
  await page.evaluate(([zoom, yaw]) => {
    const r = window.__lc.raids.current;
    const s = r.ship, l = r.site.landings[0];
    // Between the ship's middle and a few cells up the shore: the ship and the charge both in the frame.
    const x = (s.x + l.x - l.ox * 2) / 2, z = (s.z + l.z - l.oz * 2) / 2;
    window.__lc.view.setCamera({ target: [x, 0.7, z], zoom, yaw, pitch: 34 });
  }, [Number(flags.zoom ?? 6), Number(flags.yaw ?? 45)]);
  await page.clock.runFor(FRAME * 2);
  const data = await page.evaluate(async () => {
    const src = document.getElementById('town');
    const out = document.createElement('canvas');
    out.width = 360;
    out.height = 270;
    const g = out.getContext('2d');
    // The middle of the view, 4:3.
    const h = src.height, w = Math.round((h * 4) / 3);
    g.drawImage(src, Math.round((src.width - w) / 2), 0, w, h, 0, 0, 360, 270);
    return out.toDataURL('image/webp', 0.82);
  });
  const file = path.join(ROOT, 'public/guide/raid.webp');
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${path.relative(ROOT, file)}`);
} finally {
  await browser.close();
  await server.close?.();
  process.exit(0);
}
