// The playing field in a living town, stepped with fixed time steps:
// residents come to a court and play, the game ends and everyone leaves,
// editing the court mid-game ends it at once, and nobody leaves the walking
// graph on the way there or back.

import { describe, expect, test } from 'vitest';
import { applyEdit } from '@/world/world';
import { resolveTown } from '@/resolve/index';
import { key } from '@/core/grid';
import basketballTown from '../../../scenarios/field/field-basketball.scenario';
import { clock, scenarioTown, type TestTown } from '../people/testing';
import { createLivingTown, type LivingTown } from '../town/index';
import type { FieldChain } from '../town/chains/field';

const fieldOf = (t: LivingTown): FieldChain => t.board.chains.find((c) => c.id === 'field') as FieldChain;

function start(town: TestTown): { t: LivingTown; c: ReturnType<typeof clock>; field: FieldChain } {
  const c = clock(town.world.seed, 'day');
  const t = createLivingTown({ seed: town.world.seed });
  t.sync(town.shape, town.dressing, c.time);
  return { t, c, field: fieldOf(t) };
}

describe('a basketball court in a town', () => {
  const town = scenarioTown(basketballTown);

  test('residents gather, play (shots and a basket), shake hands and go home; the cap holds', () => {
    const { t, c, field } = start(town);
    field.call();
    let started = -1, ended = -1, most = 0, baskets = 0;
    const people = t.crowd.people.length;
    for (let i = 0; i < 30 * 420 && ended < 0; i++) {
      t.step(c.tick(1 / 30), c.time);
      const v = field.venues[0]!;
      if (v.state === 'play' && started < 0) started = i / 30;
      if (v.game) baskets = v.game.events.filter((e) => e.kind === 'basket').length;
      most = Math.max(most, v.roster.length);
      if (started >= 0 && v.state === 'idle') ended = i / 30;
      expect(t.crowd.people.length).toBe(people);
    }
    expect(started, 'a game started').toBeGreaterThanOrEqual(0);
    expect(most).toBeGreaterThanOrEqual(4);
    expect(baskets).toBeGreaterThanOrEqual(1);
    expect(ended, 'the game ended').toBeGreaterThan(started);
    // Afterwards everybody has somewhere else to be: nobody is left standing on the court.
    for (let i = 0; i < 30 * 30; i++) t.step(c.tick(1 / 30), c.time);
    const left = t.crowd.people.filter((p) => p.mode === 'linger' && p.goal?.errand?.tag?.startsWith('field:') && p.goal.errand.tag !== 'field:watch');
    expect(left.map((p) => p.id)).toEqual([]);
  }, 120_000);

  test('editing the court mid-game ends the game at once, tidily', () => {
    const { t, c, field } = start(town);
    field.call();
    for (let i = 0; i < 30 * 300 && field.venues[0]?.state !== 'play'; i++) t.step(c.tick(1 / 30), c.time);
    expect(field.venues[0]?.state).toBe('play');
    for (let i = 0; i < 30 * 5; i++) t.step(c.tick(1 / 30), c.time);
    const players = field.venues[0]!.roster.slice();
    // Erase one cell of the court: a 4 × 3 less a corner is still a basketball court, but a different one? No: the
    // same rectangle cannot be kept, so the court is re-read; erase a middle row to make it something else.
    let w = town.world;
    for (const x of [24, 25, 26, 27]) w = applyEdit(w, town.terrain, { type: 'eraseFloor', cell: key(x, 1, 14) });
    const next = resolveTown(w, town.terrain);
    t.sync(next.shape, next.dressing, c.time);
    t.step(c.tick(1 / 30), c.time);
    expect(field.venues.every((v) => v.state !== 'play')).toBe(true);
    // The players walk off: none of them is still being moved by a game.
    for (let i = 0; i < 30 * 3; i++) t.step(c.tick(1 / 30), c.time);
    for (const p of players) expect(p.goal?.errand?.tag === 'field:play' && p.mode === 'linger').toBe(false);
  }, 120_000);
});
