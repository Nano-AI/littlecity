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
    expect(await page.evaluate(`getComputedStyle(document.querySelector('.lc-loading')).pointerEvents`)).toBe('none');
  });

  test('the drawing finishes and holds', async () => {
    const { page } = await app.open('/?seed=1', { javaScriptEnabled: false });
    await page.waitForTimeout(100);
    // The last stroke has the longest delay: still undrawn.
    const early = (await page.evaluate(offsets)) as string[];
    expect(parseFloat(early[early.length - 1]!)).toBe(1);
    await page.waitForTimeout(2900);
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

  test('a start that fails says so', async () => {
    const { page } = await app.open('/?seed=1');
    await page.addInitScript(() => {
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl2' || type === 'webgl') return null;
        return (real as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof real;
    });
    await page.reload();
    await page.waitForFunction('document.querySelector(".lc-loading")?.dataset.state === "failed"');
    expect(await page.textContent('.lc-loading-line')).toBe(
      "This browser couldn't draw the town. Try reloading, or another browser.",
    );
    expect(await page.getAttribute('.lc-loading', 'data-state')).toBe('failed');
  });

  test('a later error leaves the town alone', async () => {
    const { page } = await app.open('/?seed=1');
    await page.waitForFunction('!document.querySelector(".lc-loading")', undefined, { timeout: 15_000 });
    await page.evaluate(() => setTimeout(() => { throw new Error('later'); }));
    await page.waitForTimeout(300);
    expect(await page.locator('.lc-loading').count()).toBe(0);
  });

  test('a stray rejection before the town shows changes nothing', async () => {
    const { page } = await app.open('/?seed=1');
    await page.addInitScript(() => {
      (window as unknown as { __failed: boolean }).__failed = false;
      new MutationObserver(() => {
        if (document.querySelector('.lc-loading[data-state="failed"]')) (window as unknown as { __failed: boolean }).__failed = true;
      }).observe(document, { subtree: true, attributes: true, childList: true });
      document.addEventListener('readystatechange', () => void Promise.reject(new Error('stray')), { once: true });
    });
    await page.reload();
    await page.waitForFunction('window.__lc && window.__lc.ui');
    expect(await page.evaluate('window.__failed')).toBe(false);
  });

  test('a script that never arrives says so', async () => {
    const { page } = await app.open('/?seed=1');
    await page.route('**/src/app/main.ts*', (r) => r.abort());
    await page.reload();
    await page.waitForFunction('document.querySelector(".lc-loading")?.dataset.state === "failed"');
  });

  test('the failure line fits a phone', async () => {
    const { page } = await app.open('/?seed=1', { javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    await page.setContent((await page.content()).replace('Drawing your town…', "This browser couldn't draw the town. Try reloading, or another browser."));
    // The text itself, not the padded box.
    const b = (await page.evaluate(
      `(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('.lc-loading-line')); const b = r.getBoundingClientRect(); return { x: b.x, width: b.width }; })()`,
    )) as { x: number; width: number };
    expect(b.x).toBeGreaterThanOrEqual(16);
    expect(b.x + b.width).toBeLessThanOrEqual(374);
  });
});
