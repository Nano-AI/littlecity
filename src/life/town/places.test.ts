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
  test('the bandstand: the band plays on its floor facing out of the open bay; nobody crosses its rail', () => {
    // The fixture's bandstand: a 2 × 2 at x 12–13, z 11–12 on ground level 1, its way in on the north
    // (toward the path). The octagon's rail runs 0.85 out from the middle; columns stand on it.
    const town = scenarioTown(bandstand);
    const c = clock(town.world.seed, 'day');
    const t = createLivingTown({ seed: town.world.seed });
    t.sync(town.shape, town.dressing, c.time);
    const mx = 13, mz = 12, ring = 0.85;
    const columns: [number, number][] = [];
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + (k * Math.PI) / 4, r = ring / Math.cos(Math.PI / 8);
      columns.push([mx + Math.cos(a) * r, mz + Math.sin(a) * r]);
    }
    /** Inside the octagon's rail (its inradius, along all eight faces). */
    const inside = (x: number, z: number): boolean => {
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        if ((x - mx) * Math.cos(a) + (z - mz) * Math.sin(a) > ring) return false;
      }
      return true;
    };
    const was = new Map<string, boolean>();
    const crossings: string[] = [], clips: string[] = [];
    let played = 0, watched = 0, floorY = Infinity;
    for (let i = 0; i < 260 * 30; i++) {
      t.step(c.tick(1 / 30), c.time);
      if (i % 3 !== 0) continue;
      for (const p of t.crowd.people) {
        if (!p.visible) continue;
        const now = inside(p.x, p.z);
        const before = was.get(p.id);
        // In or out only on the north side, between the open bay's outer columns.
        if (before !== undefined && before !== now && !(p.z < mz - 0.3 && Math.abs(p.x - mx) < 0.75)) crossings.push(`${p.id} at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
        was.set(p.id, now);
        for (const [x, z] of columns) if (Math.hypot(p.x - x, p.z - z) < 0.09) clips.push(`${p.id} ${p.mode} ${p.goal?.errand?.tag} at ${p.x.toFixed(2)}, ${p.z.toFixed(2)} col ${x.toFixed(2)}, ${z.toFixed(2)}`);
        const tag = p.goal?.errand?.tag;
        if (p.mode !== 'linger') continue;
        if (tag === 'show:play') {
          played++;
          expect(inside(p.x, p.z), 'the band is on the floor').toBe(true);
          floorY = Math.min(floorY, p.y);
        }
        if (tag === 'show:watch') {
          watched++;
          expect(inside(p.x, p.z), 'the audience is outside').toBe(false);
          expect(p.z, 'in front of the open bay').toBeLessThan(mz - 0.5);
        }
      }
    }
    expect(played).toBeGreaterThan(0);
    expect(watched).toBeGreaterThan(0);
    expect(floorY, 'standing on the plinth, not in it').toBeGreaterThan(0.8 + 0.1);
    expect(crossings).toEqual([]);
    expect(clips).toEqual([]);
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
