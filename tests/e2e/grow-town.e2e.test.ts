// Grow a town (design section 15a) in a real browser: the menu entry fills
// the island while the camera stays usable, a click skips to the end, one
// undo puts the island back as it was. The entry asks where (this island or
// a new one) and then what kind of town: Surprise me as before, or a kind,
// which is what grows (greyed where this island cannot grow it); on a new
// island the island is found to suit the kind. New island asks what kind of
// island. Back works at every step; on a phone every choice is on screen.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Page } from 'playwright';
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
const banner = `document.querySelector('[data-ui="banner"]')?.textContent ?? ''`;
/** The roles the town shows, once the newest world is resolved. */
const hasRole = (role: string): string => `[...window.__lc.shape().roles.values()].some((r) => r.role === '${role}') && window.__lc.shape().world === window.__lc.world()`;
/** The highest ground, and how many columns are river (generator 2's river material, 4). */
const highest = `Math.max(...window.__lc.terrain().height)`;
const riverColumns = `window.__lc.terrain().material.filter((m) => m === 4).length`;

/** The new island's seed comes from the clock and Math.random: pinned, so a run is the same every time. */
const pinDice = (page: Page): Promise<unknown> => page.evaluate('Date.now = () => 3; Math.random = () => 0.5;');

describe('grow a town', () => {
  test('the menu entry grows a town; dragging still orbits; a click skips; one undo empties it', async () => {
    const { page, errors } = await app.open('/?seed=3&gen=1');
    await page.waitForFunction('window.__lc !== undefined');
    const start = (await page.evaluate(blocks)) as number;

    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow"]');
    // The second screen asks where, the third what kind: on this island, the dice's kind.
    await page.click('[data-menu="grow-here"]');
    await page.click('[data-menu="town-any"]');
    await page.waitForFunction(growing);
    await page.waitForFunction(`${blocks} > 10`);
    expect(await page.isHidden('[data-ui="menu"]')).toBe(true);

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

  test('Back at every step; Escape closes; Surprise me on a new island grows there as before', async () => {
    const { page, errors } = await app.open('/?seed=5&gen=1');
    await page.waitForFunction('window.__lc !== undefined');
    // Put something down, so there is a town to lose.
    await page.mouse.click(640, 400);
    await page.waitForFunction(`window.__lc.world().blocks.size > 0`);
    const seed = (await page.evaluate('window.__lc.world().seed')) as number;

    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow"]');
    await page.waitForSelector('[data-ui="grow-choice"]');
    expect(await page.textContent('[data-ui="grow-choice"]')).toContain('On this island');
    expect(await page.textContent('[data-ui="grow-choice"]')).toContain('On a new island');
    // Where → back to the menu.
    await page.click('[data-menu="grow-back"]');
    await page.waitForSelector('[data-menu="share"]');
    // What kind (this island) → back to where. Growing over this island leaves nothing behind (one undo; a town built by hand stays in My towns), so no line.
    await page.click('[data-menu="grow"]');
    await page.click('[data-menu="grow-here"]');
    await page.waitForSelector('[data-ui="town-kinds"]');
    expect(await page.textContent('[data-ui="town-kinds"]')).not.toContain('The town you have now');
    await page.click('[data-menu="town-back"]');
    await page.waitForSelector('[data-ui="grow-choice"]');
    // What kind (a new island): where the town there is now goes (it stays in My towns), said once, here.
    await page.click('[data-menu="grow-new"]');
    await page.waitForSelector('[data-ui="town-kinds"][data-where="new"]');
    expect(await page.textContent('[data-ui="town-kinds"]')).toContain('The town you have now stays in My towns.');
    // Escape closes the menu from a kind screen; nothing happened.
    await page.keyboard.press('Escape');
    expect(await page.isHidden('[data-ui="menu"]')).toBe(true);
    // New island's kind screen → back to the menu.
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="new"]');
    await page.waitForSelector('[data-ui="confirm"]');
    await page.click('[data-menu="new-back"]');
    await page.waitForSelector('[data-menu="share"]');
    await page.click('[data-ui="menu-button"]');
    expect(await page.evaluate(growing)).toBe(false);
    expect(await page.evaluate('window.__lc.world().seed')).toBe(seed);

    // Surprise me on a new island: a new island and the dice's town, at once.
    await pinDice(page);
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow"]');
    await page.click('[data-menu="grow-new"]');
    await page.click('[data-menu="town-any"]');
    await page.waitForFunction(growing);
    expect(await page.evaluate('window.__lc.world().seed')).not.toBe(seed);
    await page.keyboard.press('Space');
    await page.waitForFunction(`!${growing}`);
    expect(await page.evaluate(blocks)).toBeGreaterThan(200);
    expect(errors).toEqual([]);
  });

  test('on this island: a castle town is a castle town; a kind the island cannot grow is greyed', async () => {
    // Generator 1's island 2 has no river and no site for a forum.
    const { page, errors } = await app.open('/?seed=2&gen=1');
    await page.waitForFunction('window.__lc !== undefined');
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow"]');
    await page.click('[data-menu="grow-here"]');
    // The planner's word on the marble city and the castle town comes in a moment.
    await page.waitForSelector('[data-menu="town-castle"][data-can="true"]');
    await page.waitForSelector('[data-menu="town-marble"][data-can="false"]');
    expect(await page.getAttribute('[data-menu="town-river"]', 'aria-disabled')).toBe('true');
    expect(await page.getAttribute('[data-menu="town-marble"]', 'aria-disabled')).toBe('true');
    // A greyed kind says why: on hover (its title), and in a line under the list when it is pressed. It grows nothing.
    expect(await page.getAttribute('[data-menu="town-river"]', 'title')).toBe('This island has no river long enough.');
    expect(await page.isHidden('[data-ui="kind-why"]')).toBe(true);
    // (The test tool will not press what is marked aria-disabled; a player's finger does.)
    await page.click('[data-menu="town-river"]', { force: true });
    await page.waitForSelector('[data-ui="kind-why"]:not([hidden])');
    expect(await page.textContent('[data-ui="kind-why"]')).toBe('This island has no river long enough.');
    expect(await page.isVisible('[data-ui="town-kinds"]')).toBe(true);
    expect(await page.evaluate('window.__lc.ui.growth.active')).toBe(false);
    for (const kind of ['harbour', 'castle', 'market', 'farming', 'hill', 'gardens']) expect(await page.isEnabled(`[data-menu="town-${kind}"]`)).toBe(true);

    await page.click('[data-menu="town-castle"]');
    await page.waitForFunction(growing);
    expect(await page.evaluate(banner)).toContain('A castle town is growing.');
    await page.keyboard.press('Space');
    await page.waitForFunction(`!${growing}`);
    await page.waitForFunction(hasRole('keep'));
    expect(errors).toEqual([]);
  });

  test('on a new island: a river town gets an island with a river; New island → Mountain gives a steep island', async () => {
    const { page, errors } = await app.open('/?seed=3&gen=1');
    await page.waitForFunction('window.__lc !== undefined');
    await pinDice(page);
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow"]');
    await page.click('[data-menu="grow-new"]');
    await page.click('[data-menu="town-river"]');
    await page.waitForFunction(growing);
    expect(await page.evaluate(banner)).toContain('A river town is growing.');
    expect(await page.evaluate('window.__lc.world().terrainGen')).toBe(2);
    expect(await page.evaluate(riverColumns)).toBeGreaterThan(30);
    await page.keyboard.press('Space');
    await page.waitForFunction(`!${growing}`);
    await page.waitForFunction(`${hasRole('stone-bridge')} || ${hasRole('bridge-shop')}`);

    const seed = (await page.evaluate('window.__lc.world().seed')) as number;
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="new"]');
    await page.click('[data-menu="island-mountain"]');
    await page.waitForFunction(`window.__lc.world().seed !== ${seed}`);
    expect(await page.evaluate(highest)).toBeGreaterThanOrEqual(7);
    expect(await page.evaluate('window.__lc.world().terrainGen')).toBe(2);
    expect(await page.evaluate('window.__lc.world().blocks.size')).toBeLessThan(20);
    expect(await page.isHidden('[data-ui="menu"]')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('My towns: a town left for a new island of a kind, or for a town of a kind on a new island, is kept', async () => {
    const { page, errors } = await app.open('/?seed=5&gen=1');
    await page.waitForFunction('window.__lc !== undefined');
    const kept = `window.__lc.keeper.current`;
    const keptIds = async (): Promise<string[]> => (await page.evaluate(`window.__lc.keeper.list().then((l) => l.map((t) => t.id))`)) as string[];
    const seed = (): Promise<number> => page.evaluate('window.__lc.world().seed') as Promise<number>;
    // Erase one tree by hand: a change of the player's to the town on screen.
    const byHand = `(() => { const w = window.__lc.world(); const c = [...w.blocks].find(([, b]) => b.kind === 'tree'); return c ? window.__lc.edit({ type: 'eraseBlock', cell: c[0] }) : false; })()`;

    // A town built by hand.
    await page.mouse.click(640, 400);
    await page.waitForFunction(`${kept} !== null`);
    const first = (await page.evaluate(kept)) as string;

    // New island → Hills: the first town stays in My towns; the new island is a new town once built on.
    const seed1 = await seed();
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="new"]');
    expect(await page.textContent('[data-ui="confirm"]')).toContain('The town you have now stays in My towns.');
    await page.click('[data-menu="island-hills"]');
    await page.waitForFunction(`window.__lc.world().seed !== ${seed1}`);
    expect(await page.evaluate(kept)).toBe(null);
    await page.mouse.click(640, 400);
    await page.waitForFunction(`${kept} !== null && ${kept} !== ${JSON.stringify(first)}`);
    const second = (await page.evaluate(kept)) as string;

    // Grow a town → On a new island → Castle town: the second town stays too; the castle town is a third.
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow"]');
    await page.click('[data-menu="grow-new"]');
    await page.click('[data-menu="town-castle"]');
    await page.waitForFunction(growing);
    await page.keyboard.press('Space');
    await page.waitForFunction(`!${growing}`);
    await page.waitForFunction(`${kept} !== null && ![${JSON.stringify(first)}, ${JSON.stringify(second)}].includes(${kept})`);
    const third = (await page.evaluate(kept)) as string;

    // Growing again over a grown town is another try at the same town: no new entry.
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow"]');
    await page.click('[data-menu="grow-here"]');
    await page.click('[data-menu="town-any"]');
    await page.waitForFunction(growing);
    await page.keyboard.press('Space');
    await page.waitForFunction(`!${growing}`);
    expect(await page.evaluate(kept)).toBe(third);

    // Changed by hand, then grown over with a chosen kind: the changed town stays kept; the new one is a fourth.
    expect(await page.evaluate(byHand)).toBe(true);
    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="grow"]');
    await page.click('[data-menu="grow-here"]');
    await page.waitForSelector('[data-menu="town-market"]:not([disabled])');
    await page.click('[data-menu="town-market"]');
    await page.waitForFunction(growing);
    await page.keyboard.press('Space');
    await page.waitForFunction(`!${growing}`);
    await page.waitForFunction(`${kept} !== null && ${kept} !== ${JSON.stringify(third)}`);

    await page.waitForFunction(`window.__lc.keeper.list().then((l) => l.length >= 4)`);
    const ids = await keptIds();
    for (const id of [first, second, third]) expect(ids).toContain(id);
    expect(errors).toEqual([]);
  });

  test('on a phone: every choice on every screen is on screen and big enough to tap; a tap grows', async () => {
    const { page, errors } = await app.open('/?seed=2&gen=1', { width: 390, height: 844, hasTouch: true, isMobile: true });
    await page.waitForFunction('window.__lc !== undefined');
    /** Every row and button of the open screen lies inside the screen and is at least 44 px high. */
    const allTappable = async (): Promise<void> => {
      const boxes = (await page.evaluate(`[...document.querySelectorAll('[data-ui="menu"] button')].map((b) => {
        const r = b.getBoundingClientRect();
        return { id: b.dataset.menu, top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height };
      })`)) as { id: string; top: number; bottom: number; left: number; right: number; h: number }[];
      expect(boxes.length).toBeGreaterThan(2);
      for (const b of boxes) {
        expect(b.top, b.id).toBeGreaterThanOrEqual(0);
        expect(b.left, b.id).toBeGreaterThanOrEqual(0);
        expect(b.bottom, b.id).toBeLessThanOrEqual(844);
        expect(b.right, b.id).toBeLessThanOrEqual(390);
        expect(b.h, b.id).toBeGreaterThanOrEqual(44);
      }
    };
    await page.tap('[data-ui="menu-button"]');
    await page.tap('[data-menu="new"]');
    await page.waitForSelector('[data-ui="confirm"]');
    await allTappable();
    await page.tap('[data-menu="new-back"]');
    await page.tap('[data-menu="grow"]');
    await allTappable();
    await page.tap('[data-menu="grow-new"]');
    await allTappable();
    await page.tap('[data-menu="town-back"]');
    await page.tap('[data-menu="grow-here"]');
    await page.waitForSelector('[data-menu="town-castle"][data-can="true"]');
    await allTappable();
    await page.tap('[data-menu="town-any"]');
    await page.waitForFunction(growing);
    await page.tap('#town', { position: { x: 195, y: 420 } });
    await page.waitForFunction(`!${growing}`, undefined, { timeout: 10_000 });
    expect(await page.evaluate(blocks)).toBeGreaterThan(200);
    expect(errors).toEqual([]);
  });
});
