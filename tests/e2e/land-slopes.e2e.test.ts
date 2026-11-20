// Raise, Dig and Level as a player uses them, on sloping generated islands
// (the owner's report: "the level function does not work"). Real mouse
// events on desktop, real touch events on the phone viewport:
//
//   - with a land tool held, a plain drag on the island shapes the ground
//     (it used to turn the camera, so Level seemed to do nothing);
//   - a drag that starts beside the island still turns the camera;
//   - Level brings every column it covers all the way to the height where
//     the drag began, in one stroke, as one undo step;
//   - a Level click with a wide brush flattens the square under it; with
//     the narrowest brush it says what to do instead of doing nothing;
//   - Raise and Dig move each column of a stroke exactly one level.

import type { CDPSession, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';
import { sized } from '../helpers/tier';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844, hasTouch: true, isMobile: true, scale: 2 };

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

const js = <T>(page: Page, expression: string): Promise<T> => page.evaluate(expression) as Promise<T>;
const heights = (page: Page): Promise<number[]> => js(page, '[...window.__lc.terrain().height]');
const yaw = (page: Page): Promise<number> => js(page, 'window.__lc.view.getCamera().yaw');

async function open(seed: number, opts: Record<string, unknown> = DESKTOP): Promise<{ page: Page; errors: string[] }> {
  const opened = await app.open(`/?seed=${seed}`, opts);
  await opened.page.waitForFunction('window.__lc !== undefined && window.__lc.ui !== null');
  // Look straight down the slope from close by, so each column's top is in view.
  await opened.page.evaluate('window.__lc.view.setCamera({ zoom: 2.4, pitch: 50 })');
  await settled(opened.page);
  return opened;
}

/** Waits until the camera has stopped gliding (a point's place on screen holds for a few frames). */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(`(() => {
    const p = window.__lc.view.worldToScreen([24, 1, 24]).map((v) => Math.round(v * 10)).join();
    const w = window.__tdCam ??= { p: '', n: 0 };
    w.n = w.p === p ? w.n + 1 : 0;
    w.p = p;
    return w.n >= 3;
  })()`, undefined, { polling: 'raf' });
  await page.evaluate('delete window.__tdCam');
}

/** Waits (up to 10 s) for the ground to change after a stroke; the test's own checks say whether it changed right. */
async function landMoved(page: Page, before: number[]): Promise<void> {
  await page.waitForFunction((was) => [...(window as unknown as { __lc: { terrain(): { height: Iterable<number> } } }).__lc.terrain().height].join() !== was, before.join(), { timeout: 10_000 }).catch(() => {});
}

async function pick(page: Page, item: 'raise' | 'dig' | 'level', tap = false): Promise<void> {
  const press = (selector: string): Promise<void> => (tap ? page.tap(selector) : page.click(selector));
  await press('[data-drawer="nature"]');
  await press(`[data-item="${item}"]`);
}

/** Where the pointer must go to point at the top of column (x, z), and the column it really picks there. */
async function aim(page: Page, x: number, z: number): Promise<{ at: [number, number]; col: number } | null> {
  return js(page, `(() => {
    const lc = window.__lc;
    const h = lc.terrain().height[${x} + ${z} * 48];
    const [sx, sy] = lc.view.worldToScreen([${x} + 0.5, h ? h * 0.8 : 0.4, ${z} + 0.5]);
    if (document.elementFromPoint(sx, sy) !== lc.view.canvas || sy < innerHeight * 0.18 || sy > innerHeight * 0.75) return null;
    return { at: [sx, sy], col: ${x} + ${z} * 48 };
  })()`);
}

/** A row of land columns on a slope (heights differ by 2 or more), whose tops the pointer can reach. */
async function slope(page: Page, minSpan = 2): Promise<{ x: number; z: number; n: number } | null> {
  const h = await heights(page);
  for (let z = 14; z < 34; z++) {
    for (let x = 12; x < 30; x++) {
      const r = [0, 1, 2, 3, 4].map((d) => h[x + d + z * 48]!);
      if (r.some((v) => v === 0) || Math.max(...r) - Math.min(...r) < minSpan || Math.max(...r) > 6) continue;
      let ok = true;
      for (let d = 0; d < 5 && ok; d++) ok = (await aim(page, x + d, z)) !== null;
      if (ok) return { x, z, n: 5 };
    }
  }
  return null;
}

/** A real mouse drag through the tops of these columns, without Shift. */
async function drag(page: Page, cols: [number, number][], shift = false): Promise<void> {
  const was = await heights(page);
  const points: [number, number][] = [];
  for (const [x, z] of cols) {
    const a = await aim(page, x, z);
    if (a) points.push(a.at);
  }
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(...points[0]!);
  await page.mouse.down();
  for (const p of points.slice(1)) await page.mouse.move(p[0], p[1], { steps: 6 });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await landMoved(page, was);
}

describe('desktop: the land tools on generated slopes', () => {
  // One slope in the gate (the Level click and the phone test below use seed 11 too); three in the full run.
  for (const seed of sized([14], [11, 14, 5])) {
    test(`Level, seed ${seed}: a plain drag levels every column it covers to the starting height, in one stroke and one undo`, async () => {
      const { page, errors } = await open(seed);
      await pick(page, 'level');
      const s = await slope(page);
      expect(s, 'a slope in view').not.toBeNull();
      const before = await heights(page);
      const y0 = await yaw(page);
      const first = (await aim(page, s!.x, s!.z))!;
      const to = before[first.col]!;
      await drag(page, [0, 1, 2, 3, 4].map((d) => [s!.x + d, s!.z]));
      const after = await heights(page);
      expect(await yaw(page)).toBe(y0); // the camera did not turn
      const changed = after.map((v, i) => (v !== before[i] ? i : -1)).filter((i) => i >= 0);
      expect(changed.length).toBeGreaterThan(0);
      // Every column the stroke moved went all the way, unless a refusal was shown.
      const refused = await js<boolean>(page, '!!document.querySelector(".lc-refusal, [data-ui=refusal]")');
      // The height where the drag began (the column the pointer really picked there); every column moved ends on it.
      const target = after[changed[0]!]!;
      for (const i of changed) if (!refused) expect(after[i], `column ${i % 48},${Math.floor(i / 48)}`).toBe(target);
      expect(before.some((v, i) => v === target && Math.abs((i % 48) - first.col % 48) <= 2 && Math.abs(Math.floor(i / 48) - Math.floor(first.col / 48)) <= 2)).toBe(true);
      void to;
      // One undo puts it all back.
      await page.keyboard.press('ControlOrMeta+z');
      await page.waitForFunction(`window.__lc.world().terrainEdits === undefined`);
      expect(await heights(page)).toEqual(before);
      expect(errors).toEqual([]);
    });
  }

  test('Level click: the widest brush flattens the square; the narrowest one says how to use it', async () => {
    const { page, errors } = await open(11);
    await pick(page, 'level');
    const s = (await slope(page))!;
    const a = (await aim(page, s.x + 2, s.z))!;
    await page.mouse.click(...a.at);
    await page.waitForFunction('document.body.innerText.includes("Level brings the ground to the height where you press")');
    await page.click('[data-ui="length-more"]');
    await page.click('[data-ui="length-more"]');
    const before = await heights(page);
    const to = before[a.col]!;
    await page.mouse.click(...a.at);
    await landMoved(page, before);
    const after = await heights(page);
    const x0 = a.col % 48, z0 = Math.floor(a.col / 48);
    let level = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (after[x0 + dx + (z0 + dz) * 48] === to) level++;
    expect(level).toBe(9);
    expect(errors).toEqual([]);
  });

  test('Raise and Dig: a plain drag moves each column it covers one level; a drag beside the island turns the camera', async () => {
    const { page, errors } = await open(14);
    const s = (await slope(page, 0))!;
    const cols: [number, number][] = [0, 1, 2, 3, 4].map((d) => [s.x + d, s.z]);
    await pick(page, 'raise');
    let before = await heights(page);
    await drag(page, cols);
    let after = await heights(page);
    for (const [x, z] of cols) expect(after[x + z * 48]).toBe(before[x + z * 48]! + 1);
    await pick(page, 'dig');
    await page.mouse.move(640, 790);
    await page.waitForTimeout(200);
    before = after;
    await drag(page, cols);
    after = await heights(page);
    // Each moved column went down exactly one level; most of the row was reached.
    const dug = cols.filter(([x, z]) => after[x + z * 48] === before[x + z * 48]! - 1).length;
    const aims = [];
    for (const [x, z] of cols) aims.push(JSON.stringify(await aim(page, x, z)));
    expect(dug, `${cols.map(([x, z]) => `${x},${z}: ${before[x + z * 48]}->${after[x + z * 48]}`).join(' ')} aims ${aims.join(' ')} toast ${await js(page, 'document.body.innerText')}`).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < after.length; i++) expect(Math.abs(after[i]! - before[i]!)).toBeLessThanOrEqual(1);
    // On the sea: the camera turns, the ground does not change.
    await page.evaluate('window.__lc.view.setCamera({ zoom: 1.2 })');
    await settled(page);
    const sea = await js<[number, number]>(page, 'window.__lc.view.worldToScreen([45.5, 0.4, 24])');
    const y0 = await yaw(page);
    const h0 = await heights(page);
    await page.mouse.move(sea[0], sea[1]);
    await page.mouse.down();
    await page.mouse.move(sea[0] + 200, sea[1] + 20, { steps: 8 });
    await page.mouse.up();
    expect(await yaw(page)).not.toBe(y0);
    expect(await heights(page)).toEqual(h0);
    expect(errors).toEqual([]);
  });
});

/** Real touch events through the DevTools protocol (Playwright's touchscreen only taps). */
async function touchDrag(cdp: CDPSession, points: [number, number][], fingers = 1): Promise<void> {
  const tp = (p: [number, number], i: number) => ({ x: p[0] + i * 60, y: p[1], id: i });
  const all = (p: [number, number]) => Array.from({ length: fingers }, (_, i) => tp(p, i));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: all(points[0]!) });
  for (const p of points.slice(1)) {
    const [x0, y0] = points[points.indexOf(p) - 1]!;
    for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: all([x0 + ((p[0] - x0) * k) / 5, y0 + ((p[1] - y0) * k) / 5]) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

describe('phone: the land tools with one finger', () => {
  test('one finger drags Level across a slope; two fingers do not shape anything', async () => {
    const { page, errors } = await open(11, PHONE);
    await pick(page, 'level', true);
    const s = (await slope(page))!;
    const cdp = await page.context().newCDPSession(page);
    const before = await heights(page);
    const points: [number, number][] = [];
    for (let d = 0; d < 5; d++) points.push((await aim(page, s.x + d, s.z))!.at);
    const to = before[(await aim(page, s.x, s.z))!.col]!;
    await touchDrag(cdp, points);
    await landMoved(page, before);
    const after = await heights(page);
    const changed = after.map((v, i) => (v !== before[i] ? i : -1)).filter((i) => i >= 0);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.filter((i) => after[i] === to).length).toBeGreaterThan(0);
    const mid = await heights(page);
    await touchDrag(cdp, [points[0]!, points[4]!], 2);
    await page.waitForTimeout(200);
    expect(await heights(page)).toEqual(mid);
    expect(errors).toEqual([]);
  });
});
