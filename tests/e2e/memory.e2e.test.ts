// Memory over a session. Every edit resolves a whole new plan of the town (megabytes of it); the plan
// before must then be let go of. For a while nothing let go: whatever was made during an edit and lived
// on (a lamp, a chimney's smoke, a walker) kept that edit's whole plan, so the page held about a
// megabyte more for every block placed, and a long session crawled and then died (tools/perf.mjs
// --heap, tools/heap-paths.mjs).
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app.close();
});

describe('memory over a session', () => {
  test('the plans of earlier edits are let go of as a town grows', async () => {
    // A first visit: a town grows by itself, a block at a time, each one an edit.
    const { page, errors } = await app.open('/?seed=7', { welcome: true });
    await page.waitForFunction('window.__lc !== undefined');
    // A weak reference to every plan the town is shown with (one that holds nothing itself).
    await page.evaluate(() => {
      const w = window as unknown as { __lc: { shape(): object }; __plans: WeakRef<object>[] };
      w.__plans = [];
      let last: object | null = null;
      const watch = (): void => {
        const shape = w.__lc.shape();
        if (shape !== last) w.__plans.push(new WeakRef((last = shape)));
        last = shape;
        requestAnimationFrame(watch);
      };
      // `last` would hold the newest plan, which is alive anyway.
      requestAnimationFrame(watch);
    });
    await page.waitForFunction('window.__plans.length >= 45', undefined, { timeout: 90_000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
    const { seen, alive } = (await page.evaluate(`({ seen: window.__plans.length, alive: window.__plans.filter((r) => r.deref() !== undefined).length })`)) as { seen: number; alive: number };
    expect(seen).toBeGreaterThanOrEqual(45);
    // The plan on screen, the one before it while its dressing is on its way, a ghost preview: a few, not all.
    expect(alive).toBeLessThanOrEqual(4);
    expect(errors).toEqual([]);
    await page.context().close();
  });
});
