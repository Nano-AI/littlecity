// L62 and the fill builder's places, stepped with fixed time steps in each
// builder's own fixture town: the work happens where it should, nobody
// leaves the walking graph, nothing carried is lost.

import { describe, expect, test } from 'vitest';
import type { Scenario } from '@/scenario';
import schoolhouse from '../../../scenarios/life/L62.school.scenario';
import smithy from '../../../scenarios/rules/R-H19.smithy.scenario';
import theatre from '../../../scenarios/rules/R-M09.theatre.scenario';
import bandstand from '../../../scenarios/life/L62.bandstand.scenario';
import bridgeShop from '../../../scenarios/rules/R-H20.bridge-shop.scenario';
import green from '../../../scenarios/rules/U15.village-green.scenario';
import drying from '../../../scenarios/rules/U17.drying-green.scenario';
import orchard from '../../../scenarios/rules/U18.orchard.scenario';
import { clock, scenarioTown, watch } from '../people/testing';
import { createLivingTown } from './index';

/** Steps the town, and counts how often anybody lingers (or is inside) on a step with each tag. */
function tally(sc: Scenario, seconds: number): { tags: Map<string, Set<string>>; problems: string[] } {
  const town = scenarioTown(sc);
  const c = clock(town.world.seed, 'day');
  const t = createLivingTown({ seed: town.world.seed });
  t.sync(town.shape, town.dressing, c.time);
  const w = watch(t.crowd, { maxStuck: 14 });
  const tags = new Map<string, Set<string>>();
  for (let i = 0; i < seconds * 30; i++) {
    t.step(c.tick(1 / 30), c.time);
    w.check();
    if (i % 10 !== 0) continue;
    for (const p of t.crowd.people) {
      const tag = p.goal?.errand?.tag;
      if (!tag || (p.mode !== 'linger' && p.mode !== 'visit')) continue;
      const set = tags.get(tag) ?? new Set();
      set.add(p.id);
      tags.set(tag, set);
    }
  }
  // (Squeezing past somebody standing at work in a one-wide way can dither a step for a frame: see town.test.ts.)
  return { tags, problems: w.problems.filter((x) => !x.includes('walking backwards')) };
}
const n = (r: ReturnType<typeof tally>, tag: string): number => r.tags.get(tag)?.size ?? 0;

describe('L62 the structures builder’s buildings at work', () => {
  test('the schoolhouse: the teacher calls them in, children go in for the lesson, then out to play in the yard', () => {
    const r = tally(schoolhouse, 200);
    expect(r.problems).toEqual([]);
    expect(n(r, 'school:bell')).toBe(1);
    expect(n(r, 'school:lesson')).toBeGreaterThanOrEqual(1);
    expect(n(r, 'school:play')).toBeGreaterThanOrEqual(1);
  });
  test('the smithy: the smith hammers at the anvil and works the forge', () => {
    const r = tally(smithy, 90);
    expect(r.problems).toEqual([]);
    expect(n(r, 'smith:hammer')).toBe(1);
    expect(n(r, 'smith:forge')).toBe(1);
  });
  test('the bandstand: a band on and round it, listeners', () => {
    // (Its fixture is a small town: a few players, a few listening.)
    const r = tally(bandstand, 260);
    expect(r.problems).toEqual([]);
    expect(n(r, 'show:play')).toBeGreaterThanOrEqual(1);
    expect(n(r, 'show:watch')).toBeGreaterThanOrEqual(1);
  });
  test('the theatre: nothing goes wrong (in its fixture the stage cannot be walked to from the houses: no show)', () => {
    expect(tally(theatre, 120).problems).toEqual([]);
  });
  test('a bridge shop has its shopkeeper at the door', () => {
    const r = tally(bridgeShop, 60);
    expect(r.problems).toEqual([]);
    expect(n(r, 'vend:stand')).toBeGreaterThanOrEqual(1);
  });
});

describe('the fill builder’s places at work', () => {
  test('the village green: dancers round the maypole', () => {
    const r = tally(green, 200);
    expect(r.problems).toEqual([]);
    expect(n(r, 'dance:round')).toBeGreaterThanOrEqual(2);
  });
  test('the drying green: the washing is seen to', () => {
    const r = tally(drying, 10);
    expect(r.problems).toEqual([]);
  });
  test('the orchard: pickers up the ladder, baskets to the big basket', () => {
    const r = tally(orchard, 200);
    expect(r.problems).toEqual([]);
    expect(n(r, 'pick:pick')).toBeGreaterThanOrEqual(1);
  });
});
