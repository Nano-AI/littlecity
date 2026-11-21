// L67 · carol singers, stepped with fixed time steps: at dusk in winter a band
// with lanterns goes door to door, sings at each, residents come out to
// listen, and the singers go home with their lanterns; none in summer or by
// day; held dusk keeps the rounds coming.

import { describe, expect, test } from 'vitest';
import { CLEAR, seasonAt, type SeasonSignal } from '../season';
import carolTown from '../../../scenarios/life/L67.carols.scenario';
import { clock, scenarioTown, watch, type TestTown } from '../people/testing';
import type { CarolChain } from './chains/carols';
import { createLivingTown, type LivingTown } from './index';

const town = scenarioTown(carolTown);
const WINTER = seasonAt(0.875);

function run(where: TestTown, seconds: number, each?: (t: LivingTown, c: CarolChain) => void, season: SeasonSignal = WINTER, part: 'day' | 'dusk' = 'dusk') {
  const c = clock(where.world.seed, part);
  const t = createLivingTown({ seed: where.world.seed });
  t.sync(where.shape, where.dressing, c.time);
  t.board.setSky(season, CLEAR);
  const w = watch(t.crowd, { maxStuck: 12 });
  const ch = t.board.chains.find((x) => x.id === 'carols') as CarolChain;
  for (let i = 0; i < seconds * 30; i++) {
    t.step(c.tick(1 / 30), c.time);
    w.check();
    each?.(t, ch);
  }
  return { t, ch, problems: w.problems };
}

describe('L67: carol singers', () => {
  test('door to door with lanterns, singing, residents out to listen, then home', () => {
    let singers = 0, sung = 0, notes = 0, lanterns = 0, listeners = 0;
    const r = run(town, 240, (_t, c) => {
      singers = Math.max(singers, c.singers.length);
      sung = Math.max(sung, c.sung);
      listeners = Math.max(listeners, c.listeners);
      notes += c.notes > 0 ? 1 : 0;
      lanterns = Math.max(lanterns, c.singers.filter((s) => s.p.load === 'lantern').length);
    });
    expect(r.problems).toEqual([]);
    expect(singers).toBeGreaterThanOrEqual(3);
    expect(lanterns).toBeGreaterThanOrEqual(3);
    expect(sung).toBeGreaterThanOrEqual(3);
    expect(notes).toBeGreaterThan(0);
    expect(listeners).toBeGreaterThanOrEqual(1);
    expect(r.ch.rounds).toBeGreaterThanOrEqual(1);
  });

  test('none in summer or by day', () => {
    expect(run(town, 80, undefined, seasonAt(0.375)).ch.rounds).toBe(0);
    expect(run(town, 80, undefined, WINTER, 'day').ch.rounds).toBe(0);
  });

  test('after a round everybody is home with their lantern put away', () => {
    let over = -1, i = 0;
    const r = run(town, 400, (t, c) => {
      i++;
      if (c.rounds > 0 && !c.on && over < 0) over = i;
      if (over > 0 && i === over + 30 * 60) {
        for (const p of t.crowd.people) {
          expect(p.party, p.id).toBe(false);
          expect(p.load === 'lantern' && t.board.claimedBy(p)?.id === 'carols').toBe(false);
        }
      }
    });
    expect(over).toBeGreaterThan(0);
    expect(r.problems).toEqual([]);
  });
});
