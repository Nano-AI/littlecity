// Mischief in a real browser (design section 13b): a new island keeps nothing
// of the old one's mischief (the owner: "the new islands still have scorch
// marks and random burned windows ... you should have no trace of the old one").

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { CELL_H, columnIndex } from '@/core/grid';
import { startApp, type App } from '../helpers/browser';

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

const drawn = 'window.__lc.mischief.drawn()';
/** Lets the page draw this many frames. */
const frames = (n: number): string => `new Promise((done) => { let k = ${n}; const f = () => (--k <= 0 ? done(true) : requestAnimationFrame(f)); requestAnimationFrame(f); })`;

describe('mischief and a new island', () => {
  test('a nuke mid-cloud, then New island: nothing of it is drawn, saved or still to come', async () => {
    const { page, errors } = await app.open('/?seed=4242&mischief');
    await page.waitForFunction('window.__lc !== undefined');
    const seed = (await page.evaluate('window.__lc.world().seed')) as number;
    // Something to burn, then the nuke in the middle of the island.
    await page.evaluate(`(() => {
      const t = window.__lc.terrain();
      const h = t.height[${columnIndex(24, 24)}];
      window.__lc.mischief.dropNuke([24.5, h * ${CELL_H}, 24.5]);
    })()`);
    // Gone off, and the cloud up.
    await page.waitForFunction(`${drawn} > 40`, null, { timeout: 30000 });
    await page.waitForFunction(`[...window.__lc.world().blocks.values()].some((b) => b.ruin)`);

    await page.click('[data-ui="menu-button"]');
    await page.click('[data-menu="new"]');
    await page.click('[data-menu="new-yes"]');
    await page.waitForFunction(`window.__lc.world().seed !== ${seed}`);
    await page.evaluate(frames(60));

    expect(await page.evaluate(drawn)).toBe(0);
    expect(await page.evaluate('window.__lc.mischief.busy')).toBe(false);
    expect(await page.evaluate(`[...window.__lc.world().blocks.values()].filter((b) => b.ruin).length`)).toBe(0);
    expect(await page.evaluate('window.__lc.world().terrainEdits?.size ?? 0')).toBe(0);
    expect(errors).toEqual([]);
  });
});
