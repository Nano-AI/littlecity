// The loading drawing: a small ink drawing is in the page before any game code runs, and steps aside
// once the town is dressed. It never takes a click.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app.close();
});

const offsets = `[...document.querySelectorAll('.lc-loading svg path')].map((p) => getComputedStyle(p).strokeDashoffset)`;

describe('the loading drawing', () => {
  test('the drawing is in the page before any game code runs', async () => {
    const { page } = await app.open('/?seed=1', { javaScriptEnabled: false });
    expect(await page.locator('.lc-loading').isVisible()).toBe(true);
    expect(await page.textContent('.lc-loading-line')).toBe('Drawing your town…');
  });

  test('the drawing finishes and holds', async () => {
    const { page } = await app.open('/?seed=1', { javaScriptEnabled: false });
    await page.waitForTimeout(3000);
    const all = (await page.evaluate(offsets)) as string[];
    expect(all.length).toBeGreaterThan(5);
    expect(all.every((o) => o === '0px')).toBe(true);
  });

  test('the drawing stays still when motion is reduced', async () => {
    const { page } = await app.open('/?seed=1', { javaScriptEnabled: false, reducedMotion: 'reduce' });
    expect(await page.evaluate(`document.querySelector('.lc-loading').getAnimations({ subtree: true }).length`)).toBe(0);
    const all = (await page.evaluate(offsets)) as string[];
    expect(all.length).toBeGreaterThan(5);
    expect(all.every((o) => o === '0px')).toBe(true);
  });

  test('it fits a phone', async () => {
    const { page } = await app.open('/?seed=1', {
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    for (const sel of ['.lc-loading svg', '.lc-loading-line']) {
      const b = (await page.locator(sel).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(390);
      expect(b.y + b.height).toBeLessThanOrEqual(844);
    }
  });

  test('it never takes a click, and leaves once the town is dressed', async () => {
    const { page, errors } = await app.open('/?seed=1');
    await page.waitForFunction('window.__lc !== undefined && window.__lc.ui !== null');
    expect(await page.evaluate('document.elementFromPoint(640, 400) === window.__lc.view.canvas')).toBe(true);
    await page.waitForFunction('!document.querySelector(".lc-loading")', undefined, { timeout: 15_000 });
    expect(await page.evaluate('document.elementFromPoint(640, 400) === window.__lc.view.canvas')).toBe(true);
    expect(errors).toEqual([]);
  });
});
