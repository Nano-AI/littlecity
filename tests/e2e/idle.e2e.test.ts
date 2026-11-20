// Nothing in hand: clicking the selected piece again (or Escape) puts it down, so the player can
// look round the town without a ghost under the pointer or placing anything by accident.
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
const pressed = `[...document.querySelectorAll('[data-item][aria-pressed="true"]')].map((b) => b.dataset.item)`;

describe('nothing in hand', () => {
  test('clicking the selected piece again puts it down: no ghost, clicks place nothing, the wheel zooms', async () => {
    const { page, errors } = await app.open('/?seed=7&gen=1');
    await page.waitForFunction('window.__lc');
    expect(await page.evaluate(pressed)).toEqual(['auto']);
    await page.click('[data-item="auto"]');
    expect(await page.evaluate(pressed)).toEqual([]);
    const before = await page.evaluate(blocks);
    await page.mouse.move(640, 400);
    await page.mouse.click(640, 400);
    await page.mouse.click(640, 400, { button: 'right' });
    await page.waitForTimeout(300);
    expect(await page.evaluate(blocks)).toBe(before);
    expect(await page.evaluate(`window.__lc.ui.debug().ghost`)).toBeNull();
    // Dragging still turns the camera.
    const yaw0 = (await page.evaluate(`window.__lc.view.getCamera().yaw`)) as number;
    await page.mouse.move(600, 400);
    await page.mouse.down();
    await page.mouse.move(700, 400, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await page.evaluate(`window.__lc.view.getCamera().yaw`)).not.toBe(yaw0);
    expect(await page.evaluate(blocks)).toBe(before);
    // Picking a piece takes it up again.
    await page.click('[data-item="house"]');
    expect(await page.evaluate(pressed)).toEqual(['house']);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test('Escape puts the piece down too, and a fence (which has a length) hides its stepper', async () => {
    const { page, errors } = await app.open('/?seed=7&gen=1');
    await page.waitForFunction('window.__lc');
    await page.click('[data-drawer="ground"]');
    await page.click('[data-item="fence"]');
    expect(await page.locator('[data-ui="length"]:visible').count()).toBe(1);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(pressed)).toEqual([]);
    expect(await page.locator('[data-ui="length"]:visible').count()).toBe(0);
    await page.click('[data-item="fence"]');
    expect(await page.evaluate(pressed)).toEqual(['fence']);
    expect(errors).toEqual([]);
    await page.context().close();
  });
});
