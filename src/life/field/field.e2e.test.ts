// The playing field in the real app: paint a court beside a street of
// houses and a game starts on it.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../../../tests/helpers/browser';

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

describe('the playing field', () => {
  test('painting a field three by four makes a basketball court, and residents come and play on it', async () => {
    // The tennis town, with a court painted beside it the way a player would: cell by cell.
    const { page, errors } = await app.open('/?scenario=field-tennis', { width: 900, height: 600 });
    await page.waitForFunction('window.__lc !== undefined && window.__lcTown !== undefined');
    const verdicts = (await page.evaluate(() => {
      const lc = (window as unknown as { __lc: { game: { edit(e: unknown): { ok: boolean } } } }).__lc;
      const out: boolean[] = [];
      for (let z = 14; z <= 16; z++) for (let x = 30; x <= 33; x++) out.push(lc.game.edit({ type: 'placeFloor', cell: x | (z << 6) | (1 << 12), floor: 'field' }).ok);
      return out;
    })) as boolean[];
    expect(verdicts.every(Boolean)).toBe(true);
    // The court is read (R-G03) once the town has caught up, and a game is called on it.
    const venue = `(() => { const f = window.__lcTown.board.chains.find((c) => c.id === 'field'); return f && f.venues.find((v) => v.game ? v.game.sport === 'basketball-court' : false); })()`;
    await page.waitForFunction(`(() => { const f = window.__lcTown.board.chains.find((c) => c.id === 'field'); f && f.call(); return f && f.venues.length >= 2; })()`, null, { timeout: 60_000 });
    await page.waitForFunction(`!!${venue}`, null, { timeout: 240_000, polling: 1000 });
    const players = (await page.evaluate(`${venue}.roster.length`)) as number;
    expect(players).toBeGreaterThanOrEqual(4);
    expect(errors).toEqual([]);
  }, 320_000);
});
