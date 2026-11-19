// The first-visit note: a closable card beside the menu button, shown once, on an empty island,
// pointing at Grow a town, and never in the way of building.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app.close();
});

const blocks = `window.__lc.world().blocks.size`;

describe('welcome card', () => {
  test('a first visit shows it beside the menu, clear of the town; the cross closes it for good', async () => {
    const { page, errors } = await app.open('/?seed=7', { welcome: true });
    await page.waitForSelector('[data-ui="welcome"]');
    expect(await page.textContent('[data-ui="welcome"]')).toContain('Grow a town');
    const box = (await page.locator('[data-ui="welcome"]').boundingBox())!;
    // In the top-left corner, not over the middle of the town.
    expect(box.x + box.width).toBeLessThan(1280 * 0.35);
    expect(box.y + box.height).toBeLessThan(800 * 0.3);
    await page.screenshot({ path: '.context/shots/welcome-desktop.png' });
    await page.click('[data-ui="welcome-close"]');
    expect(await page.locator('[data-ui="welcome"]').count()).toBe(0);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction('window.__lc');
    expect(await page.locator('[data-ui="welcome"]').count()).toBe(0);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test('"Grow a town" starts a town growing', async () => {
    const { page, errors } = await app.open('/?seed=7', { welcome: true });
    await page.waitForSelector('[data-ui="welcome"]');
    const before = (await page.evaluate(blocks)) as number;
    await page.click('[data-ui="welcome-grow"]');
    expect(await page.locator('[data-ui="welcome"]').count()).toBe(0);
    await page.waitForFunction(`${blocks} > ${before + 20}`, undefined, { timeout: 60_000 });
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test('it never blocks building: a click on the town places a block, and the note goes', async () => {
    const { page, errors } = await app.open('/?seed=7', { welcome: true });
    await page.waitForSelector('[data-ui="welcome"]');
    const before = (await page.evaluate(blocks)) as number;
    await page.mouse.click(640, 400);
    await page.waitForFunction(`${blocks} > ${before}`);
    await page.waitForFunction(`!document.querySelector('[data-ui="welcome"]')`);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test('on a phone it sits under the top row with 44 px targets', async () => {
    const { page, errors } = await app.open('/?seed=7', { welcome: true, width: 390, height: 844, hasTouch: true });
    await page.waitForSelector('[data-ui="welcome"]');
    await page.screenshot({ path: '.context/shots/welcome-phone.png' });
    const box = (await page.locator('[data-ui="welcome"]').boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThan(844 * 0.35);
    for (const sel of ['[data-ui="welcome-close"]', '[data-ui="welcome-grow"]']) {
      const b = await page.locator(sel).evaluate((n) => [(n as HTMLElement).offsetWidth, (n as HTMLElement).offsetHeight]);
      expect(Math.min(...b), sel).toBeGreaterThanOrEqual(44);
    }
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test('tools and other tests never see it', async () => {
    const { page } = await app.open('/?seed=7');
    await page.waitForFunction('window.__lc');
    expect(await page.locator('[data-ui="welcome"]').count()).toBe(0);
    await page.context().close();
  });
});
