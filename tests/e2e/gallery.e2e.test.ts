// The gallery page in a real browser: it lists what discovery found, shows
// the chosen entry, orbits, and its sliders change the style values live.

import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

const SHOTS = path.resolve(__dirname, '../../.context/shots');
const KINDS = ['auto', 'house', 'tower', 'lighthouse', 'arch', 'dock', 'marble', 'pillar', 'stairs', 'windmill', 'tree', 'fountain', 'stall', 'fence', 'wall', 'path', 'plaza', 'garden'];

let app: App;
beforeAll(async () => {
  app = await startApp();
  fs.mkdirSync(SHOTS, { recursive: true });
});
afterAll(async () => {
  await app?.close();
});

const js = <T>(page: Page, expression: string): Promise<T> => page.evaluate(expression) as Promise<T>;
type Listed = { id: string; group: string; label: string; note: string; file?: string };

describe('the gallery', () => {
  test('lists every generator, layer and scenario by itself, and shows whichever is chosen', async () => {
    const { page, errors } = await app.open('/gallery/index.html', { width: 1440, height: 900 });
    await page.waitForFunction('window.__gallery !== undefined');
    const entries = await js<Listed[]>(page, 'window.__gallery.entries()');
    const ids = entries.map((e) => e.id);
    for (const kind of KINDS) expect(ids).toContain(`gen.${kind}`);
    expect(ids).toContain('layer.terrain');
    expect(ids).toContain('scenario.hello-town');
    expect(ids).toContain('icons');
    // The convention: a scenario under scenarios/gallery/ is a gallery entry.
    expect(entries.find((e) => e.id === 'scenario.tray-pieces')).toMatchObject({ group: 'Gallery entries', file: '/scenarios/gallery/tray-pieces.scenario.ts' });
    // Every entry has a button in the list.
    expect(await page.locator('.g-list [data-entry]').count()).toBe(entries.length);

    // Each generator entry builds and draws without a problem.
    for (const kind of KINDS) {
      expect(await js(page, `window.__gallery.show('gen.${kind}')`)).toBe(true);
      expect(await js(page, 'window.__gallery.problem()'), `gen.${kind}`).toBe('');
      expect(await js(page, 'window.__gallery.view !== null')).toBe(true);
    }

    // Choosing from the list shows it; the address follows.
    await page.click('[data-entry="scenario.tray-pieces"]');
    expect(await js(page, 'window.__gallery.current()')).toBe('scenario.tray-pieces');
    expect(await js(page, 'location.hash')).toBe('#scenario.tray-pieces');
    expect(await js(page, 'window.__gallery.blocks()')).toBe(24);
    expect(await page.textContent('.g-title')).toContain('tray-pieces');
    // Its two cameras are buttons.
    expect(await page.locator('[data-ui="cameras"] button').count()).toBe(2);
    await page.click('[data-ui="cameras"] button:nth-child(2)');
    expect(await js(page, 'window.__gallery.view.getCamera().yaw')).toBe(225);

    // The filter narrows the list.
    await page.fill('.g-filter', 'light');
    expect(await js(page, `[...document.querySelectorAll('.g-list [data-entry]:not([hidden])')].map((b) => b.dataset.entry)`)).toEqual(['gen.lighthouse']);
    expect(errors).toEqual([]);
  });

  test('orbit controls turn the view; a slider changes a style value and the picture', async () => {
    const { page, errors } = await app.open('/gallery/index.html#scenario.tray-pieces', { width: 1440, height: 900 });
    await page.waitForFunction('window.__gallery !== undefined && window.__gallery.view !== null');
    await page.waitForTimeout(300);
    const canvas = page.locator('#town');
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height * 0.7;

    const yaw = await js<number>(page, 'window.__gallery.view.getCamera().yaw');
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 10, { steps: 5 });
    await page.mouse.up();
    expect(await js<number>(page, 'window.__gallery.view.getCamera().yaw')).not.toBe(yaw);
    await page.mouse.wheel(0, -200);
    const camera = await js<{ yaw: number; zoom: number }>(page, 'window.__gallery.view.getCamera()');

    // Every style module has a group of controls; palette.grass is a colour well.
    expect(await js<string[]>(page, `[...document.querySelectorAll('[data-ui="sliders"] details')].map((d) => d.dataset.module)`)).toEqual(
      expect.arrayContaining(['auto', 'input', 'palette', 'ramps', 'time']),
    );
    const before = await canvas.screenshot();
    await page.evaluate(`{
      const well = document.querySelector('[data-style="palette.grass"] input');
      well.value = '#d9a0c8';
      well.dispatchEvent(new Event('input', { bubbles: true }));
    }`);
    await page.waitForTimeout(400);
    const after = await canvas.screenshot();
    expect(after.equals(before)).toBe(false);
    expect(await page.getAttribute('[data-style="palette.grass"]', 'class')).toContain('lc-changed');
    // The camera stayed where it was put.
    expect(await js(page, 'window.__gallery.view.getCamera()')).toMatchObject(camera);
    fs.writeFileSync(path.join(SHOTS, 'gallery-tuned.png'), await page.screenshot());

    // A value with a declared range is a slider; one without (the Auto block's numbers, today) is a number box.
    await page.click('[data-module="input"] summary');
    expect(await page.getAttribute('[data-style="input.longPressMs"] input', 'type')).toBe('range');
    expect(await page.locator('[data-style="auto.spanMax"] input').count()).toBe(1);

    // Reset puts every value back.
    await page.click('[data-ui="tuning"] button:has-text("Reset")');
    await page.waitForTimeout(400);
    expect(await page.getAttribute('[data-style="palette.grass"]', 'class')).not.toContain('lc-changed');
    expect((await canvas.screenshot()).equals(after)).toBe(false);
    await page.screenshot({ path: path.join(SHOTS, 'gallery.png') });
    expect(errors).toEqual([]);
  });

  test('the icon sheet shows an icon for every tray piece and tool', async () => {
    const { page, errors } = await app.open('/gallery/index.html#icons', { width: 1100, height: 1500, scale: 2 });
    await page.waitForSelector('.g-icons figure');
    const icons = await js<string[]>(page, `[...document.querySelectorAll('.g-icons figure')].map((f) => f.dataset.icon)`);
    for (const id of [...KINDS, 'change', 'paint', 'erase', 'menu', 'undo', 'redo']) expect(icons).toContain(id);
    await page.locator('.g-icons').screenshot({ path: path.join(SHOTS, 'interface-icons.png') });
    expect(errors).toEqual([]);
  });
});
