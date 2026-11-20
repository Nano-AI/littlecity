// The six play-throughs of shaping the land, by real mouse clicks and drags
// on generator 2's island for seed 2 (gentle, two rivers), as a player does
// them: a river dug and bridged; a moat round a tower; a hill raised with a
// tower on top; a plot levelled on a slope with a house; a stretch of river
// filled in; a street of houses sunk into the water. Each ends with a
// picture in .context/shots/play-*.png.

import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';
import { FULL } from '../helpers/tier';

const SHOTS = path.resolve(__dirname, '../../.context/shots');
const DESKTOP = { width: 1280, height: 800 };

let app: App;
let page: Page;
let errors: string[];
beforeAll(async () => {
  app = await startApp();
  fs.mkdirSync(SHOTS, { recursive: true });
  ({ page, errors } = await app.open('/?seed=2', DESKTOP));
  await page.waitForFunction('window.__lc !== undefined && window.__lc.ui !== null');
}, 120_000);
afterAll(async () => {
  await app?.close();
});

const js = <T>(expression: string): Promise<T> => page.evaluate(expression) as Promise<T>;
const h = (x: number, z: number): Promise<number> => js(`window.__lc.terrain().height[${x + z * 48}]`);
const DRAWER: Record<string, string> = { raise: 'nature', dig: 'nature', level: 'nature', tree: 'nature', path: 'ground' };

async function pick(item: string): Promise<void> {
  await page.click(`[data-drawer="${DRAWER[item] ?? 'build'}"]`);
  await page.click(`[data-item="${item}"]`);
  await page.mouse.move(640, 790);
}
async function brush(n: number): Promise<void> {
  for (let i = 0; i < 3; i++) if (!(await page.isDisabled('[data-ui="length-less"]'))) await page.click('[data-ui="length-less"]');
  for (let i = 1; i < n; i++) await page.click('[data-ui="length-more"]');
}
async function look(x: number, z: number, zoom = 3): Promise<void> {
  await js(`window.__lc.view.setCamera({ target: [${x}, 1, ${z}], zoom: ${zoom}, pitch: 52, yaw: 45 })`);
  // Until the camera has stopped gliding (a point's place on screen holds for a few frames).
  await page.waitForFunction(`(() => {
    const p = window.__lc.view.worldToScreen([${x}, 1, ${z}]).map((v) => Math.round(v * 10)).join();
    const w = window.__tdCam ??= { p: '', n: 0 };
    w.n = w.p === p ? w.n + 1 : 0;
    w.p = p;
    return w.n >= 3;
  })()`, undefined, { polling: 'raf' });
  await js('delete window.__tdCam');
}
/** The screen point on top of column (x, z) (or on whatever stands there, `y` levels up). */
async function at(x: number, z: number, y?: number): Promise<[number, number]> {
  const top = y ?? (await h(x, z));
  return js(`window.__lc.view.worldToScreen([${x + 0.5}, ${top ? top * 0.8 : 0.4}, ${z + 0.5}])`);
}
async function click(x: number, z: number, y?: number): Promise<void> {
  await page.mouse.click(...(await at(x, z, y)));
  await page.waitForTimeout(120);
}
async function drag(cols: [number, number][]): Promise<void> {
  const first = await at(...cols[0]!);
  await page.mouse.move(...first);
  await page.mouse.down();
  for (const c of cols.slice(1)) await page.mouse.move(...(await at(...c)), { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}
const row = (x0: number, x1: number, z: number): [number, number][] => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, z]);
/** A picture for people to look at: only in the full run (LC_FULL=1); it checks nothing. */
const shot = async (name: string): Promise<void> => {
  if (!FULL) return;
  await page.mouse.move(640, 790);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOTS, `play-${name}.png`) });
};

describe('six play-throughs, by hand', () => {
  test('a river dug across the island from the sea to the old river, and a bridge over it', async () => {
    await look(18, 34);
    await pick('dig');
    await drag(row(10, 25, 34));
    let water = 0;
    for (let x = 10; x <= 25; x++) if ((await h(x, 34)) === 0) water++;
    expect(water).toBeGreaterThanOrEqual(13);
    await pick('arch');
    await click(18, 34, 0);
    expect(await js(`window.__lc.shape().kinds.get(${18 | (34 << 6)})`)).toBe('arch');
    await shot('river-bridge');
  });

  test('a moat dug round a tower on the plateau', async () => {
    await look(12, 25);
    await pick('tower');
    await click(12, 25);
    await click(12, 25, 3);
    await pick('dig');
    // Two strokes down each side of the ring (the plateau is two levels up).
    for (let pass = 0; pass < 2; pass++) {
      await drag(row(10, 14, 23));
      await drag(row(10, 14, 27));
      await drag([[10, 24], [10, 25], [10, 26]]);
      await drag([[14, 24], [14, 25], [14, 26]]);
    }
    let moat = 0;
    for (const [x, z] of [...row(10, 14, 23), ...row(10, 14, 27), [10, 25], [14, 25]] as [number, number][]) if ((await h(x, z)) === 0) moat++;
    expect(moat).toBeGreaterThanOrEqual(9);
    await shot('moat');
  });

  test('a hill raised with the wide brush, and a tower on its top', async () => {
    await look(34, 19, 2.6);
    await pick('raise');
    await brush(3);
    for (let i = 0; i < 4; i++) await click(34, 19);
    expect(await h(34, 19)).toBe(5);
    expect(await h(33, 18)).toBeLessThan(5); // the soft edge: the corners lag behind
    await pick('tower');
    await click(34, 19);
    expect(await js(`window.__lc.world().blocks.has(${34 | (19 << 6) | (5 << 12)})`)).toBe(true);
    await shot('hill-tower');
  });

  test('a plot levelled on the slope, and a house on it', async () => {
    await look(11, 15);
    await pick('level');
    await brush(1);
    const to = await h(10, 15);
    await drag([[10, 15], [11, 15], [12, 15], [12, 14], [11, 14], [10, 14], [10, 16], [11, 16], [12, 16]]);
    let flat = 0;
    for (const [x, z] of [[11, 15], [12, 15], [11, 14], [12, 16]] as const) if ((await h(x, z)) === to) flat++;
    expect(flat).toBeGreaterThanOrEqual(3);
    await pick('house');
    await click(11, 15);
    expect(await js(`window.__lc.world().blocks.has(${11 | (15 << 6) | (to << 12)})`)).toBe(true);
    await shot('level-plot');
  });

  test('a stretch of the river filled in', async () => {
    await look(27, 21);
    await pick('raise');
    await brush(1);
    await drag(row(25, 30, 21));
    let filled = 0;
    for (let x = 25; x <= 30; x++) if ((await h(x, 21)) > 0) filled++;
    expect(filled).toBe(6);
    await shot('filled-river');
  });

  test('a street of houses sunk into the water', async () => {
    await look(19, 37);
    await pick('house');
    for (const x of [16, 18, 20, 22]) await click(x, 37);
    await pick('dig');
    await drag(row(15, 23, 37));
    for (const x of [16, 18, 20, 22]) expect(await js(`window.__lc.world().blocks.get(${x | (37 << 6)})?.kind`)).toBe('house');
    await shot('sunk-street');
    expect(errors).toEqual([]);
  });
});
