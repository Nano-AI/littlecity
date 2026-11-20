// Shaping the land in a real browser (design section 6, "Shaping the land";
// section 7 for how tools behave): Raise, Dig and Level in the Land group of
// the Nature drawer; a click changes the pointed column; the ghost shows the
// new ground first; Shift-drag paints a stroke that undoes as one; the brush
// is the held length. Desktop and the phone viewport.

import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

const SHOTS = path.resolve(__dirname, '../../.context/shots');
/** Flat ground at level 1 on columns 4–43 (the ui playground), a few houses on it. */
const TOWN = '/?scenario=ui-playground';
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844, hasTouch: true, isMobile: true, scale: 2 };

let app: App;
beforeAll(async () => {
  app = await startApp();
  fs.mkdirSync(SHOTS, { recursive: true });
});
afterAll(async () => {
  await app?.close();
});

const js = <T>(page: Page, expression: string): Promise<T> => page.evaluate(expression) as Promise<T>;
const debug = <T>(page: Page, field: string): Promise<T> => js(page, `window.__lc.ui.debug().${field}`);
const height = (page: Page, x: number, z: number): Promise<number> => js(page, `window.__lc.terrain().height[${x + z * 48}]`);

async function open(opts: Record<string, unknown> = DESKTOP): Promise<{ page: Page; errors: string[] }> {
  const opened = await app.open(TOWN, opts);
  await opened.page.waitForFunction('window.__lc !== undefined && window.__lc.ui !== null');
  return opened;
}

/** A point on the top of column (x, z) as it stands now. */
async function top(page: Page, x: number, z: number, fx = 0.5, fz = 0.5): Promise<[number, number]> {
  const h = await height(page, x, z);
  const y = h === 0 ? 0.4 : h * 0.8;
  return js<[number, number]>(page, `window.__lc.view.worldToScreen([${x + fx}, ${y}, ${z + fz}])`);
}

async function pick(page: Page, item: 'raise' | 'dig' | 'level', tap = false): Promise<void> {
  const press = (selector: string): Promise<void> => (tap ? page.tap(selector) : page.click(selector));
  await press('[data-drawer="nature"]');
  // Clicking the piece already in hand puts it down, so only press one that is not selected.
  if ((await page.getAttribute(`[data-item="${item}"]`, 'aria-pressed')) !== 'true') await press(`[data-item="${item}"]`);
  expect(await debug(page, 'item')).toBe(item);
}

describe('desktop: shaping the land', () => {
  test('the Land group starts the Nature drawer; Raise and Dig change the pointed column; undo puts it back', async () => {
    const { page, errors } = await open();
    await page.click('[data-drawer="nature"]');
    const items = await page.$$eval('[data-item]', (els) => els.map((e) => (e as HTMLElement).dataset.item));
    expect(items.slice(0, 3)).toEqual(['raise', 'dig', 'level']);

    await pick(page, 'raise');
    const [x, z] = [20, 30];
    expect(await height(page, x, z)).toBe(1);
    const p = await top(page, x, z);
    await page.mouse.move(p[0], p[1]);
    await page.waitForFunction('window.__lc.ui.debug().ghost !== null');
    expect(await height(page, x, z)).toBe(1); // the ghost changes nothing
    await page.screenshot({ path: path.join(SHOTS, 'land-ghost-raise.png') });
    await page.mouse.click(p[0], p[1]);
    await page.waitForFunction(`window.__lc.terrain().height[${x + z * 48}] === 2`);
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(SHOTS, 'land-raise-bounce.png') });

    await pick(page, 'dig');
    const q = await top(page, x, z);
    await page.mouse.click(q[0], q[1]);
    await page.waitForFunction(`window.__lc.terrain().height[${x + z * 48}] === 1`);
    await page.mouse.click(q[0], q[1] + 12);
    await page.waitForFunction(`window.__lc.terrain().height[${x + z * 48}] === 0`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'land-dug-pond.png') });

    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction(`window.__lc.terrain().height[${x + z * 48}] === 1 && window.__lc.world().terrainEdits === undefined`);
    expect(errors).toEqual([]);
  });

  test('a Shift-drag stroke digs a channel as one undo step; the brush widens it', async () => {
    const { page, errors } = await open();
    await pick(page, 'dig');
    // A brush of 2.
    await page.click('[data-ui="length-more"]');
    expect(await debug(page, 'length')).toBe(2);
    const a = await top(page, 12, 24);
    const b = await top(page, 30, 24);
    await page.keyboard.down('Shift');
    await page.mouse.move(a[0], a[1]);
    await page.mouse.down();
    await page.mouse.move(b[0], b[1], { steps: 18 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForFunction('window.__lc.ui.debug() && window.__lc.game.canUndo');
    let dug = 0;
    for (let x = 12; x <= 30; x++) if ((await height(page, x, 24)) === 0) dug++;
    expect(dug).toBeGreaterThan(14);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, 'land-stroke-channel.png') });
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction('window.__lc.world().terrainEdits === undefined');
    expect(errors).toEqual([]);
  });

  test('Level brings a stroke to the height it began at', async () => {
    const { page, errors } = await open();
    await pick(page, 'raise');
    for (let i = 0; i < 2; i++) {
      const p = await top(page, 25, 20);
      await page.mouse.click(p[0], p[1]);
      await page.waitForFunction(`window.__lc.terrain().height[${25 + 20 * 48}] === ${2 + i}`);
    }
    await pick(page, 'level');
    const a = await top(page, 22, 20);
    const b = await top(page, 28, 20);
    await page.keyboard.down('Shift');
    await page.mouse.move(a[0], a[1]);
    await page.mouse.down();
    await page.mouse.move(b[0], b[1], { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForFunction(`window.__lc.terrain().height[${25 + 20 * 48}] === 1`); // all the way, in one stroke
    expect(errors).toEqual([]);
  });
});

describe('phone: shaping the land', () => {
  test('tap Raise and Dig, the brush stepper, undo', async () => {
    const { page, errors } = await open(PHONE);
    await pick(page, 'raise', true);
    await page.screenshot({ path: path.join(SHOTS, 'land-phone-tray.png') });
    expect(await debug(page, 'length')).toBe(1);
    await page.tap('[data-ui="length-more"]');
    await page.tap('[data-ui="length-more"]');
    expect(await debug(page, 'length')).toBe(3);
    expect(await page.isDisabled('[data-ui="length-more"]')).toBe(true); // a brush goes no wider than 3
    const p = await top(page, 22, 22);
    await page.touchscreen.tap(p[0], p[1]);
    // The widest brush has a soft edge: the middle and its four sides rise, the corners wait a dab.
    await page.waitForFunction(`window.__lc.terrain().height[${22 + 22 * 48}] === 2 && window.__lc.terrain().height[${23 + 22 * 48}] === 2 && window.__lc.terrain().height[${23 + 23 * 48}] === 1`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'land-phone-raise.png') });
    await page.tap('[data-ui="undo"]');
    await page.waitForFunction('window.__lc.world().terrainEdits === undefined');
    expect(errors).toEqual([]);
  });
});
