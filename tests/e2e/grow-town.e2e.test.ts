// Grow a town (design section 15a) in a real browser: the menu entry fills
// the island while the camera stays usable, a click skips to the end, one
// undo puts the island back as it was; the dice grows a different town on a
// new island; it works on the phone layout too.

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
const growing = `window.__lc.ui.growth.active`;

describe('grow a town', () => {
  test('the menu entry grows a town; dragging still orbits; a click skips; one undo empties it', async () => {
    const { page, errors } = await app.open('/?seed=3&gen=1');
    await page.waitForFunction('window.__lc !== undefined');
    const start = (await page.evaluate(blocks)) as number;

    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow"]');
    // Only starting trees on the island: no confirmation, it starts growing.
    await page.waitForFunction(growing);
    await page.waitForFunction(`${blocks} > 10`);

    // The camera stays usable while it grows: a drag orbits and does not stop the growth.
    const yaw0 = (await page.evaluate('window.__lc.view.getCamera().yaw')) as number;
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.mouse.move(420, 320, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate('window.__lc.view.getCamera().yaw')).not.toBe(yaw0);
    expect(await page.evaluate(growing)).toBe(true);

    // A click skips to the end.
    await page.mouse.click(640, 400);
    await page.waitForFunction(`!${growing}`);
    const grown = (await page.evaluate(blocks)) as number;
    expect(grown).toBeGreaterThan(200);
    expect(await page.evaluate('window.__lc.world().floors.size')).toBeGreaterThan(100);

    // One undo step for the whole growth: back to the starting trees.
    await page.click('[data-ui="undo"]');
    await page.waitForFunction(`${blocks} === ${start}`);
    expect(await page.evaluate('window.__lc.world().floors.size')).toBe(0);
    expect(await page.evaluate('window.__lc.game.canUndo')).toBe(false);

    // Redo brings the whole town back.
    await page.click('[data-ui="redo"]');
    await page.waitForFunction(`${blocks} === ${grown}`);
    expect(errors).toEqual([]);
  });

  test('over a town it asks first; a key skips; the dice grows on a new island', async () => {
    const { page, errors } = await app.open('/?seed=5&gen=1');
    await page.waitForFunction('window.__lc !== undefined');
    // Put something down, so there is a town to lose.
    await page.mouse.click(640, 400);
    await page.waitForFunction(`window.__lc.world().blocks.size > 0`);
    const seed = (await page.evaluate('window.__lc.world().seed')) as number;

    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow"]');
    await page.waitForSelector('[data-ui="confirm"]');
    await page.click('[data-menu="grow-no"]');
    expect(await page.evaluate(growing)).toBe(false);

    // The new island's seed comes from the clock and Math.random: pin them to a positive seed
    // (a negative one trips L10.fireflies, docs/swarm/requests/grow-town.md).
    await page.evaluate('Date.now = () => 3; Math.random = () => 0.5;');
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow-new"]');
    await page.click('[data-menu="grow-new-yes"]');
    await page.waitForFunction(growing);
    expect(await page.evaluate('window.__lc.world().seed')).not.toBe(seed);
    await page.keyboard.press('Space');
    await page.waitForFunction(`!${growing}`);
    expect(await page.evaluate(blocks)).toBeGreaterThan(200);
    expect(errors).toEqual([]);
  });

  test('on a phone: the entry is there, a tap skips', async () => {
    const { page, errors } = await app.open('/?seed=2&gen=1', { width: 390, height: 844, hasTouch: true, isMobile: true });
    await page.waitForFunction('window.__lc !== undefined');
    await page.tap('[data-ui="menu-button"]');
    await page.tap('[data-menu="grow"]');
    await page.waitForFunction(growing);
    await page.tap('#town', { position: { x: 195, y: 420 } });
    await page.waitForFunction(`!${growing}`, undefined, { timeout: 10_000 });
    expect(await page.evaluate(blocks)).toBeGreaterThan(200);
    expect(errors).toEqual([]);
  });
});
