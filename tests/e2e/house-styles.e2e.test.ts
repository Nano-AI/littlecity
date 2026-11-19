// House styles in a real browser (design section 7, "House style"): hovering
// the House button opens the flyout; a chosen style goes onto every house
// placed after it; Random brings the variety back; Alt-click copies a look;
// on a phone a long press opens the flyout. Screenshots of the open flyout
// go to .context/shots/ for a look.

import fs from 'node:fs';
import path from 'node:path';
import type { CDPSession, Page } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

const SHOTS = path.resolve(__dirname, '../../.context/shots');
const TOWN = '/?scenario=ui-playground';
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844, hasTouch: true, isMobile: true, scale: 2 };

const key = (x: number, y: number, z: number): number => x | (z << 6) | (y << 12);

let app: App;
const pages: Page[] = [];
beforeAll(async () => {
  app = await startApp();
  fs.mkdirSync(SHOTS, { recursive: true });
});
afterEach(async () => {
  for (const p of pages.splice(0)) await p.close().catch(() => undefined);
});
afterAll(async () => {
  await app?.close();
});

async function open(opts: Record<string, unknown> = DESKTOP): Promise<{ page: Page; errors: string[] }> {
  const opened = await app.open(TOWN, opts);
  pages.push(opened.page);
  await opened.page.waitForFunction('window.__lc !== undefined && window.__lc.ui !== null');
  return opened;
}
const js = <T>(page: Page, expression: string): Promise<T> => page.evaluate(expression) as Promise<T>;
const debug = <T>(page: Page, field: string): Promise<T> => js(page, `window.__lc.ui.debug().${field}`);

async function ground(page: Page, x: number, z: number): Promise<[number, number]> {
  const [sx, sy] = await js<[number, number]>(page, `window.__lc.view.worldToScreen([${x + 0.5}, 0.8, ${z + 0.5}])`);
  expect(await js<boolean>(page, `document.elementFromPoint(${sx}, ${sy}) === window.__lc.view.canvas`)).toBe(true);
  return [sx, sy];
}

/** The block in a cell, as stored. */
const blockAt = (page: Page, x: number, y: number, z: number): Promise<{ kind: string; color: number; style?: number } | null> =>
  js(page, `window.__lc.world().blocks.get(${key(x, y, z)}) ?? null`);

const box = async (page: Page, selector: string): Promise<{ x: number; y: number; width: number; height: number }> => {
  const b = await page.locator(selector).boundingBox();
  expect(b, selector).not.toBeNull();
  return b!;
};
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe('desktop: house styles', () => {
  test('hover opens the flyout; a chosen style goes on every new house; Random brings variety back', async () => {
    const { page, errors } = await open();
    expect(await debug(page, 'style')).toBe(0);
    expect(await page.isHidden('[data-ui="styles"]')).toBe(true);

    await page.hover('[data-item="house"]');
    await page.waitForSelector('[data-ui="styles"]:not([hidden])');
    expect(await page.locator('[data-ui="styles"] [data-style]').count()).toBe(7);
    expect(await page.getAttribute('[data-style="0"]', 'aria-checked')).toBe('true');
    // The flyout sits above the House button and inside the window.
    const fly = await box(page, '[data-ui="styles"]');
    const house = await box(page, '[data-item="house"]');
    expect(fly.y + fly.height).toBeLessThanOrEqual(house.y);
    expect(fly.x).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: path.join(SHOTS, 'house-styles-flyout-desktop.png') });

    // Pick Tudor (3): the hand holds a house in that style and the House button shows it.
    await page.click('[data-style="3"]');
    expect(await debug(page, 'item')).toBe('house');
    expect(await debug(page, 'style')).toBe(3);
    expect(await page.getAttribute('[data-item="house"]', 'data-house-style')).toBe('3');
    expect(await page.getAttribute('[data-item="house"]', 'aria-label')).toBe('House: Tudor');
    // Choosing closes it, and leaving keeps it closed.
    await page.mouse.move(640, 300);
    await page.waitForSelector('[data-ui="styles"]', { state: 'hidden' });

    // Two clicks on bare ground: two separate houses, both Tudor, both in its peach (apart, so they stay two buildings).
    const [ax, ay] = await ground(page, 18, 28);
    await page.mouse.move(ax, ay);
    await page.waitForFunction('window.__lc.ui.debug().ghost !== null');
    // The ghost is a Tudor house too.
    await page.screenshot({ path: path.join(SHOTS, 'house-styles-ghost.png'), clip: { x: ax - 160, y: ay - 180, width: 320, height: 260 } });
    await page.mouse.click(ax, ay);
    const [bx, by] = await ground(page, 22, 29);
    await page.mouse.click(bx, by);
    await page.waitForFunction('window.__lc.world().blocks.size === 7');
    expect((await blockAt(page, 18, 1, 28))?.style).toBe(3);
    expect((await blockAt(page, 22, 1, 29))?.style).toBe(3);
    // Both structures resolve to the Tudor look.
    const looks = await js<number[]>(
      page,
      `(() => {
        const s = window.__lc.shape();
        return [${key(18, 1, 28)}, ${key(22, 1, 29)}].map((c) => {
          const st = s.structures.get(s.structureAt.get(c));
          return s.world.blocks.get(st.cells.find((k) => s.world.blocks.get(k).seq === st.id)).style;
        });
      })()`,
    );
    expect(looks).toEqual([3, 3]);

    // Random again: new houses carry no style (each rolls its own look).
    await page.hover('[data-item="house"]');
    await page.waitForSelector('[data-ui="styles"]:not([hidden])');
    await page.click('[data-style="0"]');
    expect(await debug(page, 'style')).toBe(0);
    expect(await page.getAttribute('[data-item="house"]', 'aria-label')).toBe('House');
    const [cx, cy] = await ground(page, 26, 30);
    await page.mouse.click(cx, cy);
    await page.waitForFunction('window.__lc.world().blocks.size === 8');
    expect((await blockAt(page, 26, 1, 30))?.style).toBeUndefined();

    // Undo takes the Random house away and keeps the Tudor ones.
    await page.keyboard.press('ControlOrMeta+z');
    expect(await js(page, 'window.__lc.world().blocks.size')).toBe(7);
    expect((await blockAt(page, 22, 1, 29))?.style).toBe(3);
    expect(errors).toEqual([]);
  });

  test('the tiles draw in the swatch colour; the keyboard reaches them; Escape closes', async () => {
    const { page, errors } = await open();
    await page.click('[data-item="house"]');
    await page.click('[data-ui="swatch"]');
    await page.click('.lc-swatches [data-swatch="4"]');
    await page.focus('[data-item="house"]');
    await page.keyboard.press('ArrowUp');
    await page.waitForSelector('[data-ui="styles"]:not([hidden])');
    expect(await js(page, 'document.activeElement.dataset.style')).toBe('0');
    // The Harbour tile's walls are the fifth wall colour.
    expect(await page.innerHTML('[data-style="1"]')).toContain('#aacdee');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await js(page, 'document.activeElement.dataset.style')).toBe('2');
    await page.keyboard.press('Enter');
    expect(await debug(page, 'style')).toBe(2);
    expect(await page.isHidden('[data-ui="styles"]')).toBe(true);
    expect(await js(page, 'document.activeElement.dataset.item')).toBe('house');
    await page.keyboard.press('ArrowUp');
    await page.waitForSelector('[data-ui="styles"]:not([hidden])');
    expect(await js(page, 'document.activeElement.dataset.style')).toBe('2');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-ui="styles"]', { state: 'hidden' });
    expect(errors).toEqual([]);
  });

  test('the flyout never covers the length stepper', async () => {
    const { page, errors } = await open();
    await page.click('[data-item="pillar"]');
    expect(await page.isVisible('[data-ui="length"]')).toBe(true);
    await page.hover('[data-item="house"]');
    await page.waitForSelector('[data-ui="styles"]:not([hidden])');
    expect(overlaps(await box(page, '[data-ui="styles"]'), await box(page, '[data-ui="length"]'))).toBe(false);
    expect(errors).toEqual([]);
  });

  test('Alt-click copies the kind, colour and style of a block into the hand', async () => {
    const { page, errors } = await open();
    // A Farm (5) house in colour 6, placed through the debug handle.
    expect(await js(page, `window.__lc.edit({ type: 'placeBlock', cell: ${key(18, 1, 28)}, kind: 'house', color: 6, from: null, style: 5 })`)).toBe(true);
    await page.click('[data-item="tower"]');
    const [sx, sy] = await js<[number, number]>(page, `window.__lc.view.worldToScreen([18.5, 1.2, 28.5])`);
    await page.keyboard.down('Alt');
    await page.mouse.click(sx, sy);
    await page.keyboard.up('Alt');
    expect(await debug(page, 'item')).toBe('house');
    expect(await debug(page, 'swatch')).toBe(6);
    expect(await debug(page, 'style')).toBe(5);
    // Nothing was built by the Alt-click.
    expect(await js(page, 'window.__lc.world().blocks.size')).toBe(6);
    // The next click places another house just like it.
    const [gx, gy] = await ground(page, 24, 30);
    await page.mouse.click(gx, gy);
    await page.waitForFunction('window.__lc.world().blocks.size === 7');
    expect(await blockAt(page, 24, 1, 30)).toMatchObject({ kind: 'house', color: 6, style: 5 });
    // A Random block copies as Random.
    const [hx, hy] = await js<[number, number]>(page, `window.__lc.view.worldToScreen([24.5, 1.2, 22.5])`);
    await page.keyboard.down('Alt');
    await page.mouse.click(hx, hy);
    await page.keyboard.up('Alt');
    expect(await debug(page, 'style')).toBe(0);
    expect(await debug(page, 'swatch')).toBe(1);
    expect(errors).toEqual([]);
  });
});

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchEnd', x: number, y: number): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 1 }] });
}

describe('phone: house styles', () => {
  test('a long press on House opens the flyout with 44 px targets; a tap chooses', async () => {
    const { page, errors } = await open(PHONE);
    // Hold a length piece first, so the stepper is showing.
    await page.tap('[data-item="pillar"]');
    expect(await page.isVisible('[data-ui="length"]')).toBe(true);
    // Selecting the pillar scrolled the row; bring the House back into view.
    await js(page, `document.querySelector('.lc-row').scrollLeft = 0`);
    const house = await box(page, '[data-item="house"]');
    const cdp = await page.context().newCDPSession(page);
    await touch(cdp, 'touchStart', house.x + house.width / 2, house.y + house.height / 2);
    await page.waitForTimeout(650);
    await touch(cdp, 'touchEnd', 0, 0);
    await page.waitForSelector('[data-ui="styles"]:not([hidden])');
    // The press that opened it did not also select the House.
    expect(await debug(page, 'item')).toBe('pillar');
    const tiles = await page.locator('[data-ui="styles"] [data-style]').all();
    expect(tiles).toHaveLength(7);
    for (const t of tiles) {
      const b = (await t.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    const fly = await box(page, '[data-ui="styles"]');
    expect(fly.x).toBeGreaterThanOrEqual(0);
    expect(fly.x + fly.width).toBeLessThanOrEqual(390);
    expect(overlaps(fly, await box(page, '[data-ui="length"]'))).toBe(false);
    await page.screenshot({ path: path.join(SHOTS, 'house-styles-flyout-phone.png') });

    await page.tap('[data-style="6"]');
    expect(await debug(page, 'style')).toBe(6);
    expect(await debug(page, 'item')).toBe('house');
    expect(await page.isHidden('[data-ui="styles"]')).toBe(true);
    // A tap on House is still just a tap: it selects, and opens nothing.
    await page.tap('[data-item="tower"]');
    await page.tap('[data-item="house"]');
    expect(await debug(page, 'item')).toBe('house');
    expect(await page.isHidden('[data-ui="styles"]')).toBe(true);
    expect(errors).toEqual([]);
  });
});
