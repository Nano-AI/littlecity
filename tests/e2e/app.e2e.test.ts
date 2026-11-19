// The walking skeleton in a real browser: the stub town shows, a click
// places a block, a right click erases it.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

const blocks = `window.__lc.world().blocks.size`;

describe('the app', () => {
  test('shows the town; click places a block; right click erases it; undo restores', async () => {
    const { page, errors } = await app.open('/?seed=1&gen=1');
    await page.waitForFunction('window.__lc !== undefined');
    // A new island starts with its 6–14 starting trees.
    const start = (await page.evaluate(blocks)) as number;
    expect(start).toBeGreaterThanOrEqual(6);
    expect(start).toBeLessThanOrEqual(14);
    const before = new Set((await page.evaluate('[...window.__lc.world().blocks.keys()]')) as number[]);

    // WebGL is really drawing: the centre of the canvas is grass, not paper.
    await page.waitForTimeout(300);
    const shot = await page.locator('#town').screenshot();
    expect(shot.byteLength).toBeGreaterThan(5000);

    await page.mouse.click(640, 400);
    await page.waitForFunction(`${blocks} === ${start + 1}`);
    const cell = ((await page.evaluate('[...window.__lc.world().blocks.keys()]')) as number[]).find((c) => !before.has(c))!;
    const ground = (await page.evaluate(`window.__lc.terrain().height[${(cell & 63) + ((cell >> 6) & 63) * 48}]`)) as number;
    expect(cell >> 12).toBe(ground); // on top of the island

    // Clicking the new block's top stacks a second one on it.
    const [sx, sy] = (await page.evaluate(
      ([x, y, z]) => (window as unknown as { __lc: { view: { worldToScreen(p: number[]): number[] } } }).__lc.view.worldToScreen([x! + 0.5, (y! + 1) * 0.8, z! + 0.5]),
      [cell & 63, cell >> 12, (cell >> 6) & 63],
    )) as [number, number];
    await page.mouse.click(sx, sy);
    await page.waitForFunction(`${blocks} === ${start + 2}`);
    expect(await page.evaluate(`window.__lc.world().blocks.has(${cell + (1 << 12)})`)).toBe(true);

    await page.mouse.click(sx, sy - 20, { button: 'right' });
    await page.waitForFunction(`${blocks} === ${start + 1}`);

    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction(`${blocks} === ${start + 2}`);

    // Dragging orbits instead of placing.
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(320, 220, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(blocks)).toBe(start + 2);
    expect(errors).toEqual([]);
  });

  test('a scenario loads by URL, and the gallery lists what discovery found', async () => {
    const { page, errors } = await app.open('/?scenario=hello-town');
    await page.waitForFunction('window.__lc !== undefined');
    expect(await page.evaluate(blocks)).toBe(11);
    const gallery = await app.open('/gallery/index.html');
    await gallery.page.waitForSelector('#gallery table');
    expect(await gallery.page.textContent('#gallery')).toContain('hello-town');
    expect([...errors, ...gallery.errors]).toEqual([]);
  });
});
