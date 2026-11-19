// The first-visit card: shown once, on an empty island, pointing at Grow a town.
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
  test('a first visit shows it; "Build my own" closes it for good', async () => {
    const { page, errors } = await app.open('/?seed=7', { welcome: true });
    await page.waitForSelector('[data-ui="welcome"]');
    expect(await page.textContent('[data-ui="welcome"]')).toContain('Grow a town');
    await page.screenshot({ path: '.context/shots/welcome-desktop.png' });
    await page.click('[data-ui="welcome-build"]');
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

  test('a click beside the card closes it without placing anything; a phone shows it too', async () => {
    const { page, errors } = await app.open('/?seed=7', { welcome: true, width: 390, height: 844, hasTouch: true });
    await page.waitForSelector('[data-ui="welcome"]');
    await page.screenshot({ path: '.context/shots/welcome-phone.png' });
    const before = await page.evaluate(blocks);
    await page.mouse.click(20, 120);
    expect(await page.locator('[data-ui="welcome"]').count()).toBe(0);
    expect(await page.evaluate(blocks)).toBe(before);
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
