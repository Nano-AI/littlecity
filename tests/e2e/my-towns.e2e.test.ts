// My towns in a real browser: every town the player makes is kept, with a
// picture; a card opens its town; the choice survives a reload; names change
// in place; a town can be deleted; a saved town this version cannot read is
// kept, not written over.

import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

const kept = `window.__lc.keeper.current`;
const seed = `window.__lc.world().seed`;

async function openTowns(page: Page): Promise<void> {
  await page.click('[data-ui="menu-button"]');
  await page.click('[data-menu="towns"]');
  await page.waitForSelector('[data-ui="towns"]:not([hidden]) [data-town]');
}

describe('My towns', () => {
  test('two islands built on are both kept; a card opens the other; a reload keeps it; rename and delete', async () => {
    const { page, errors } = await app.open('/?seed=5&gen=1');
    await page.waitForFunction('window.__lc !== undefined');
    await page.mouse.click(640, 400);
    await page.waitForFunction(`${kept} !== null`);
    const firstSeed = (await page.evaluate(seed)) as number;
    const firstId = (await page.evaluate(kept)) as string;

    // A new island: the menu says the town stays.
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="new"]');
    expect(await page.textContent('[data-ui="confirm"]')).toContain('stays in My towns');
    await page.evaluate(`Math.random = () => 0.25`);
    await page.click('[data-menu="new-yes"]');
    await page.waitForFunction(`${seed} !== ${firstSeed}`);
    await page.mouse.click(640, 400);
    await page.waitForFunction(`${kept} !== null && ${kept} !== ${JSON.stringify(firstId)}`);
    const secondSeed = (await page.evaluate(seed)) as number;

    await openTowns(page);
    expect(await page.locator('[data-town]').count()).toBe(2);
    expect(await page.locator('.lc-town-here').count()).toBe(1);
    // The first town's card shows the picture taken as the player left it.
    const first = page.locator(`[data-town="${firstId}"]`);
    expect(await first.locator('img').count()).toBe(1);
    expect(await first.locator('img').getAttribute('src')).toMatch(/^data:image\/jpeg/);

    // Opening it: the sheet closes, the first town is back.
    await first.locator('[data-towns="open"]').click();
    await page.waitForSelector('[data-ui="towns"][hidden]', { state: 'attached' });
    await page.waitForFunction(`${seed} === ${firstSeed}`);
    expect(await page.evaluate(kept)).toBe(firstId);

    // A reload opens the town last chosen.
    await page.reload();
    await page.waitForFunction('window.__lc !== undefined');
    expect(await page.evaluate(seed)).toBe(firstSeed);
    expect(await page.evaluate(kept)).toBe(firstId);

    // Rename the other town in place; delete it after the second question.
    await openTowns(page);
    const other = page.locator('[data-town]:not(.lc-town-here)');
    await other.locator('[data-towns="name"]').fill('Windy Point');
    await other.locator('[data-towns="name"]').press('Enter');
    await page.click('[data-towns="close"]');
    await openTowns(page);
    expect(await page.locator('[data-town]:not(.lc-town-here) [data-towns="name"]').inputValue()).toBe('Windy Point');
    expect(await page.locator('.lc-town-here [data-towns="delete"]').count()).toBe(0);
    await page.click('[data-town]:not(.lc-town-here) [data-towns="delete"]');
    expect(await page.textContent('[data-ui="town-delete"]')).toContain('Delete Windy Point?');
    await page.click('[data-towns="delete-yes"]');
    await page.waitForFunction(`document.querySelectorAll('[data-town]').length === 1`);
    expect(await page.evaluate(`window.__lc.keeper.list().then((l) => l.map((t) => t.id))`)).toEqual([firstId]);
    void secondSeed;
    expect(errors).toEqual([]);
  });

  test('a saved town this version cannot read is kept in My towns and never written over', async () => {
    const { page, errors } = await app.open('/');
    await page.waitForFunction('window.__lc !== undefined');
    const garbage = 'LC' + 'z'.repeat(40);
    // Let the first page's own autosave of its bare island land first, then plant the unreadable town.
    await page.waitForTimeout(1200);
    await page.evaluate(`localStorage.setItem('little-city.town.v1', ${JSON.stringify(garbage)}); localStorage.setItem('little-city.town.id', 'lost-one')`);
    await page.reload();
    await page.waitForFunction('window.__lc !== undefined');
    await page.waitForFunction(`[...document.querySelectorAll('[data-ui="toast"]')].some((t) => t.textContent.includes('kept safe in My towns'))`);

    // Build on the fresh island: the old code is moved aside, and the library has it.
    await page.mouse.click(640, 400);
    await page.waitForFunction(`${kept} !== null`);
    await openTowns(page);
    expect(await page.locator('[data-town="lost-one"]').count()).toBe(1);
    expect(await page.evaluate(`window.__lc.keeper.list().then((l) => l.find((t) => t.id === 'lost-one').code)`)).toBe(garbage);

    // Opening it says why not, and the sheet stays.
    await page.click('[data-town="lost-one"] [data-towns="open"]');
    await page.waitForFunction(`[...document.querySelectorAll('[data-ui="toast"]')].some((t) => t.textContent.includes('newer Little City'))`);
    expect(await page.locator('[data-ui="towns"]:not([hidden])').count()).toBe(1);
    expect(errors).toEqual([]);
  });
});
