// Held length in a real browser (design section 7, "Held length"): scroll
// or the − n + stepper stretches a run piece before it is placed; one click
// places the part that fits, as one undo step. Desktop (mouse) and phone
// (touch) viewports, in the same playground as tests/e2e/interface.e2e.test.ts.

import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

const SHOTS = path.resolve(__dirname, '../../.context/shots');
const TOWN = '/?scenario=ui-playground';
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844, hasTouch: true, isMobile: true, scale: 2 };

const key = (x: number, y: number, z: number): number => x | (z << 6) | (y << 12);

let app: App;
beforeAll(async () => {
  app = await startApp();
  fs.mkdirSync(SHOTS, { recursive: true });
});
afterAll(async () => {
  await app?.close();
});

// ── helpers ──────────────────────────────────────────────────────────────

async function open(opts: Record<string, unknown> = DESKTOP): Promise<{ page: Page; errors: string[] }> {
  const opened = await app.open(TOWN, opts);
  await opened.page.waitForFunction('window.__lc !== undefined && window.__lc.ui !== null');
  return opened;
}
const js = <T>(page: Page, expression: string): Promise<T> => page.evaluate(expression) as Promise<T>;
const debug = <T>(page: Page, field: string): Promise<T> => js(page, `window.__lc.ui.debug().${field}`);
const count = (page: Page, what: 'blocks' | 'floors' | 'edges' = 'blocks'): Promise<number> => js(page, `window.__lc.world().${what}.size`);
const zoom = (page: Page): Promise<number> => js(page, 'window.__lc.view.getCamera().zoom');

/** A point on the grass of column (x, z) (level 1 is the top of the flat ground); fx and fz say where within the square. */
async function ground(page: Page, x: number, z: number, fx = 0.5, fz = 0.5): Promise<[number, number]> {
  const [sx, sy] = await js<[number, number]>(page, `window.__lc.view.worldToScreen([${x + fx}, 0.8, ${z + fz}])`);
  expect(await js<boolean>(page, `document.elementFromPoint(${sx}, ${sy}) === window.__lc.view.canvas`)).toBe(true);
  return [sx, sy];
}

async function pick(page: Page, item: string, tap = false): Promise<void> {
  const drawer = ['path', 'plaza', 'fence', 'wall', 'stall'].includes(item) ? 'ground' : ['tree', 'garden', 'fountain'].includes(item) ? 'nature' : 'build';
  const press = (selector: string): Promise<void> => (tap ? page.tap(selector) : page.click(selector));
  await press(`[data-drawer="${drawer}"]`);
  await press(`[data-item="${item}"]`);
  expect(await debug(page, 'item')).toBe(item);
}

/** One mouse-wheel notch up (longer, or zoom in) or down. */
const notch = (page: Page, up = true): Promise<void> => page.mouse.wheel(0, up ? -100 : 100);

// ── desktop ──────────────────────────────────────────────────────────────

describe('desktop: held length', () => {
  test('scrolling grows a fence run, one click places it all, one undo takes it all away', async () => {
    const { page, errors } = await open();
    await pick(page, 'fence');
    expect(await debug(page, 'length')).toBe(1);
    expect(await page.isVisible('[data-ui="length"]')).toBe(true);

    // The middle of (24, 28), a little east of centre: a cell fence, growing east.
    const [x, y] = await ground(page, 24, 28, 0.66, 0.5);
    await page.mouse.move(x, y);
    await page.waitForFunction('window.__lc.ui.debug().ghost !== null');
    const before = await zoom(page);
    for (let i = 0; i < 3; i++) await notch(page);
    await page.waitForFunction('window.__lc.ui.debug().run === 4');
    expect(await debug(page, 'length')).toBe(4);
    expect(await page.textContent('[data-ui="length-value"]')).toBe('4');
    expect(await page.textContent('[data-ui="run-count"]')).toBe('4');
    expect(await zoom(page)).toBe(before);
    // The preview changes nothing.
    expect(await count(page)).toBe(5);

    // A notch down shortens it again.
    await notch(page, false);
    await page.waitForFunction('window.__lc.ui.debug().run === 3');
    await notch(page);

    await page.mouse.click(x, y);
    await page.waitForFunction('window.__lc.world().blocks.size === 9');
    const kinds = await js<(string | null)[]>(page, `[24, 25, 26, 27].map((x) => window.__lc.world().blocks.get(x | (28 << 6) | (1 << 12))?.kind ?? null)`);
    expect(kinds).toEqual(['fence', 'fence', 'fence', 'fence']);

    await page.keyboard.press('ControlOrMeta+z');
    expect(await count(page)).toBe(5);
    expect(await page.isDisabled('[data-ui="undo"]')).toBe(true);

    // The length is remembered for the fence, and other pieces start at 1.
    await pick(page, 'wall');
    expect(await debug(page, 'length')).toBe(1);
    await pick(page, 'fence');
    expect(await debug(page, 'length')).toBe(4);
    expect(errors).toEqual([]);
  });

  test('scroll zooms when the piece has no length; Ctrl + scroll always zooms', async () => {
    const { page, errors } = await open();
    await pick(page, 'house');
    expect(await debug(page, 'length')).toBeNull();
    expect(await page.isHidden('[data-ui="length"]')).toBe(true);
    const [x, y] = await ground(page, 24, 28);
    await page.mouse.move(x, y);
    const z0 = await zoom(page);
    await notch(page);
    await page.waitForFunction(`window.__lc.view.getCamera().zoom > ${z0}`);

    // A wall: a plain scroll over the island sets its length and leaves the camera alone…
    await pick(page, 'wall');
    await page.mouse.move(x, y);
    const z1 = await zoom(page);
    await notch(page);
    await page.waitForFunction('window.__lc.ui.debug().length === 2');
    expect(await zoom(page)).toBe(z1);
    // …and with Ctrl held (what a trackpad pinch looks like) it zooms, and the length stays.
    await page.keyboard.down('Control');
    await notch(page, false);
    await page.keyboard.up('Control');
    await page.waitForFunction(`window.__lc.view.getCamera().zoom < ${z1}`);
    expect(await debug(page, 'length')).toBe(2);
    expect(await count(page)).toBe(5);

    // The page itself never zooms or scrolls: a Ctrl + wheel over the tray is swallowed.
    const swallowed = await js<boolean>(
      page,
      `(() => { const e = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }); document.querySelector('.lc-tray').dispatchEvent(e); return e.defaultPrevented; })()`,
    );
    expect(swallowed).toBe(true);
    expect(await js(page, 'window.scrollY')).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a pillar grows straight up; the stepper does what the wheel does', async () => {
    const { page, errors } = await open();
    await pick(page, 'pillar');
    await page.click('[data-ui="length-more"]');
    await page.click('[data-ui="length-more"]');
    expect(await page.textContent('[data-ui="length-value"]')).toBe('3');
    const [x, y] = await ground(page, 25, 30);
    await page.mouse.move(x, y);
    await page.waitForFunction('window.__lc.ui.debug().run === 3');
    await page.mouse.click(x, y);
    await page.waitForFunction('window.__lc.world().blocks.size === 8');
    const pillars = await js<(string | null)[]>(page, `[1, 2, 3].map((y) => window.__lc.world().blocks.get(25 | (30 << 6) | (y << 12))?.kind ?? null)`);
    expect(pillars).toEqual(['pillar', 'pillar', 'pillar']);
    // The stepper stops at 1 and at 12.
    for (let i = 0; i < 4; i++) await page.click('[data-ui="length-less"]', { force: true });
    expect(await debug(page, 'length')).toBe(1);
    expect(await page.isDisabled('[data-ui="length-less"]')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('how a held run looks on a desktop', async () => {
    const { page, errors } = await open({ ...DESKTOP, scale: 2 });
    await pick(page, 'wall');
    const [x, y] = await ground(page, 21, 28, 0.66, 0.5);
    await page.mouse.move(x, y);
    for (let i = 0; i < 5; i++) await notch(page);
    await page.waitForFunction('window.__lc.ui.debug().run === 6');
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, 'held-length-desktop.png') });
    expect(errors).toEqual([]);
  });
});

// ── phone ────────────────────────────────────────────────────────────────

describe('phone: held length', () => {
  test('the stepper appears for a path and a tap places a run of the chosen length', async () => {
    const { page, errors } = await open(PHONE);
    expect(await page.isHidden('[data-ui="length"]')).toBe(true);
    await pick(page, 'path', true);
    expect(await page.isVisible('[data-ui="length"]')).toBe(true);
    await page.tap('[data-ui="length-more"]');
    await page.tap('[data-ui="length-more"]');
    expect(await page.textContent('[data-ui="length-value"]')).toBe('3');

    // Every button a finger must hit, the stepper's included, is at least 44 px.
    const small = await js<string[]>(
      page,
      `[...document.querySelectorAll('.lc-ui button')].filter((b) => b.offsetParent !== null).map((b) => { const w = b.offsetWidth, h = b.offsetHeight; return w < 44 || h < 44 ? (b.dataset.item ?? b.dataset.ui) + ' ' + w + 'x' + h : null; }).filter(Boolean)`,
    );
    expect(small).toEqual([]);

    // Tapped toward the east side of (23, 27): the path runs east.
    await page.touchscreen.tap(...(await ground(page, 23, 27, 0.8, 0.5)));
    await page.waitForFunction('window.__lc.world().floors.size === 3');
    const floors = await js<number[]>(page, '[...window.__lc.world().floors.keys()].sort((a, b) => a - b)');
    expect(floors).toEqual([23, 24, 25].map((x) => key(x, 1, 27)));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, 'held-length-phone.png') });

    // One undo step, by the button.
    await page.tap('[data-ui="undo"]');
    expect(await count(page, 'floors')).toBe(0);
    expect(errors).toEqual([]);
  });
});
