// The first times a piece with a length is picked, a note over the stepper
// says that scrolling changes it (the owner: "otherwise they don't know that
// this is a mechanic"). It goes for good once a length has been changed.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

const HINT = '[data-ui="length-hint"]';

describe('the length note', () => {
  test('desktop: picking a marble block says to scroll; a tower says taller; changing the length ends it for good', async () => {
    const { page, errors } = await app.open('/?seed=5');
    await page.waitForFunction('window.__lc !== undefined');
    // The piece in hand at the start (Auto) has no length: no note.
    expect(await page.isHidden(HINT)).toBe(true);

    // All of these are in the Build drawer, which is open at the start.
    await page.click('[data-item="marble"]');
    await page.waitForSelector(`${HINT}:not([hidden])`);
    expect(await page.textContent(HINT)).toBe('Scroll to make it longer or shorter');
    // It is a note, not a control: it takes no clicks.
    expect(await page.evaluate(`getComputedStyle(document.querySelector('${HINT}')).pointerEvents`)).toBe('none');

    await page.click('[data-item="tower"]');
    await page.waitForFunction(`document.querySelector('${HINT}').textContent === 'Scroll to make it taller or shorter'`);

    // A piece without a length: the note goes.
    await page.click('[data-item="house"]');
    await page.waitForSelector(HINT, { state: 'hidden' });

    // Changing a length is the lesson learned: gone, and not shown again, in this visit or the next.
    await page.click('[data-item="arch"]');
    await page.waitForSelector(`${HINT}:not([hidden])`);
    await page.click('[data-ui="length-more"]');
    await page.waitForSelector(HINT, { state: 'hidden' });
    await page.click('[data-item="marble"]');
    expect(await page.isHidden(HINT)).toBe(true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction('window.__lc !== undefined');
    await page.click('[data-item="marble"]');
    expect(await page.isVisible('[data-ui="length"]')).toBe(true);
    expect(await page.isHidden(HINT)).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  });

  test('never changed: it is shown three times, then taken as read', async () => {
    const { page, errors } = await app.open('/?seed=5');
    await page.waitForFunction('window.__lc !== undefined');
    for (const item of ['marble', 'arch', 'pillar']) {
      await page.click(`[data-item="${item}"]`);
      await page.waitForSelector(`${HINT}:not([hidden])`);
    }
    await page.click('[data-item="dock"]');
    await page.waitForSelector(HINT, { state: 'hidden' });
    expect(errors).toEqual([]);
    await page.close();
  });

  test('on a phone it speaks of the buttons, not of scrolling', async () => {
    const { page, errors } = await app.open('/?seed=5', { width: 390, height: 844, hasTouch: true, isMobile: true });
    await page.waitForFunction('window.__lc !== undefined');
    await page.tap('[data-item="marble"]');
    await page.waitForSelector(`${HINT}:not([hidden])`);
    expect(await page.textContent(HINT)).toBe('Tap − and + to make it longer or shorter');
    // Inside the screen.
    const box = await page.locator(HINT).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
    await page.close();
  });
});
