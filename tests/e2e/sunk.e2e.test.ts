// Sunk things stay under (design section 13b; Derek, 2026-11-22: "Sunken boats should stay under"). A raid's
// longship bombed just inside the edge of the map goes down deeper than the slab is thick; from a low camera
// looking at the slab's front edge, nothing of it may be drawn below the sea: the picture where it lies is the
// same as the picture once it is gone.

import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

const frames = (n: number): string => `new Promise((done) => { let k = ${n}; const f = () => (--k <= 0 ? done(true) : requestAnimationFrame(f)); requestAnimationFrame(f); })`;

/** The page's pixels as RGBA rows (a screenshot of the town, decoded in the page). */
async function pixels(page: Page): Promise<{ w: number; h: number; data: number[] }> {
  const png = (await page.locator('#town').screenshot()).toString('base64');
  return (await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, data: [...g.getImageData(0, 0, img.width, img.height).data] };
  }, png)) as { w: number; h: number; data: number[] };
}

describe('sunk things stay under', () => {
  test('a longship gone down near the front edge: nothing of it shows under the slab', async () => {
    const { page, errors } = await app.open('/?scenario=raid-landing&mischief', { width: 640, height: 400 });
    await page.waitForFunction('window.__lc !== undefined && window.__lc.raids !== undefined', null, { timeout: 60_000 });
    await page.addStyleTag({ content: 'body > *:not(#town) { display: none !important; }' });
    await page.evaluate(`window.__lc.signals.hold('day')`);
    expect(await page.evaluate(`window.__lc.raids.summon({ at: null, kind: 'landing' })`)).toBeNull();
    // In over the edge, under sail, a few cells inside the map.
    await page.waitForFunction(`(() => {
      const r = window.__lc.raids.current, s = r && r.ship;
      return !!s && r.shipState === 'arrive' && !s.edgeCut && Math.min(s.x, s.z, 48 - s.x, 48 - s.z) > 2.5;
    })()`, null, { timeout: 90_000, polling: 50 });
    // Broken by a bomb beside it: down it goes, all the way.
    await page.evaluate(`(() => {
      const s = window.__lc.raids.current.ship;
      window.__lc.mischief.dropBomb([s.x + Math.cos(s.yaw) * 1.2, 0.6, s.z - Math.sin(s.yaw) * 1.2]);
    })()`);
    await page.waitForFunction(`window.__lc.raids.current?.ship.sink >= 1`, null, { timeout: 60_000, polling: 100 });
    // Low over the sea beyond the nearest edge, looking in at the slab's face, the wreck in the middle.
    await page.evaluate(`(() => {
      const s = window.__lc.raids.current.ship;
      const d = [[s.x, -90], [48 - s.x, 90], [s.z, 180], [48 - s.z, 0]].sort((a, b) => a[0] - b[0]);
      window.__lc.view.setCamera({ target: [s.x, 0, s.z], yaw: d[0][1], pitch: 12, zoom: 2.4 });
    })()`);
    await page.evaluate(frames(4));
    // Where its pieces are now (bow, stern, the masthead, the keel): on the page.
    const at = (await page.evaluate(`(() => {
      const v = window.__lc.raids.current.ship, m = v.m;
      const pts = [[0, 0, 0], [0, 0, 2.5], [0, 0, -2.5], [0, 2.3, 0], [0, 1.2, 0]];
      return pts.map(([x, y, z]) => {
        const w = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
        return { y: w[1], s: window.__lc.view.worldToScreen(w) };
      });
    })()`)) as { y: number; s: [number, number] }[];
    // It is under: every piece of it below the water.
    for (const p of at) expect(p.y).toBeLessThan(0.4);
    const sunk = await pixels(page);
    // Gone (the raid called off): the same view without it.
    await page.evaluate('window.__lc.mischief.cancel()');
    await page.waitForFunction('window.__lc.raids.current === null');
    await page.evaluate(frames(6));
    const gone = await pixels(page);
    const k = sunk.w / 640;
    let worst = 0;
    for (const p of at) {
      const cx = Math.round(p.s[0] * k), cy = Math.round(p.s[1] * k);
      let diff = 0, n = 0;
      for (let y = cy - 6; y <= cy + 6; y++) {
        for (let x = cx - 6; x <= cx + 6; x++) {
          if (x < 0 || y < 0 || x >= sunk.w || y >= sunk.h) continue;
          const i = (y * sunk.w + x) * 4;
          diff += Math.abs(sunk.data[i]! - gone.data[i]!) + Math.abs(sunk.data[i + 1]! - gone.data[i + 1]!) + Math.abs(sunk.data[i + 2]! - gone.data[i + 2]!);
          n++;
        }
      }
      if (n > 0) worst = Math.max(worst, diff / n / 3);
    }
    expect(worst, 'the sunk longship drawn below the sea (mean colour difference where it lies)').toBeLessThan(6);
    expect(errors).toEqual([]);
    await page.close();
  });
});
