// Berths and the ways in and out of them (berths.fact.ts, ship-routes.ts).

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import { resolveScenario, scenario, type TerrainBuilder, type TownBuilder } from '@/scenario';
import galleonScn from '../../../scenarios/rules/L38.galleon.scenario';
import { findBerths, harbour, hullSize, planningField } from './berths.fact';
import { beyond, hullClear, mapEdge, pathAt, planArrival } from './ship-routes';

function town(terrain: (t: TerrainBuilder) => void, build: (b: TownBuilder) => void) {
  return resolveScenario(scenario({ name: 'berth-test', seed: 11, terrain, build }));
}
const calls = (t: ReturnType<typeof town>): string[] => t.dressing.actors.filter((a) => a.type === 'ship-call').map((a) => a.variant ?? '');

describe('berths', () => {
  test('the L38 quay is one berth of ten: a galleon, a galley and a cog all fit it, and rowboats still moor along it', () => {
    const t = resolveScenario(galleonScn);
    const berths = findBerths(t.shape.facts);
    expect(berths[0]!.cells).toBe(10);
    const h = harbour(t.shape.facts);
    const at = h.plans.filter((p) => p.berth.key === berths[0]!.key).map((p) => p.ship);
    expect(at).toEqual(['galleon', 'galley', 'cog']);
    // No water is kept for a ship that is not there: the quay has its rowboats too.
    const quayBoats = t.dressing.actors.filter((a) => a.type === 'rowboat' && a.home === t.shape.structureAt.get(key(20, 0, 27)));
    expect(quayBoats.length).toBeGreaterThan(1);
  });

  test('fit is the only test: a single dock gets a rowboat, a quay of four a cog (and nothing bigger), with no other conditions', () => {
    const t = town(
      (g) => {
        g.flat(1);
        g.water(4, 24, 43, 43);
      },
      (b) => {
        b.block('dock', 8, 0, 24);
        for (let x = 20; x <= 23; x++) b.block('dock', x, 0, 24);
      },
    );
    expect(calls(t).sort()).toEqual(['cog', 'passing']);
    const single = t.shape.structureAt.get(key(8, 0, 24));
    expect(t.dressing.actors.some((a) => a.type === 'rowboat' && a.home === single)).toBe(true);
    // The sea is never empty: a sailboat sails it whatever is built (this lane is a there-and-back strip: one).
    expect(t.dressing.actors.filter((a) => a.type === 'sailboat').length).toBeGreaterThanOrEqual(1);
  });

  test('an island with no dock at all still has sailboats and a tall ship passing far out', () => {
    const t = town(
      (g) => {
        g.flat(0);
        g.rect(16, 16, 30, 30, 1);
      },
      () => {},
    );
    expect(t.dressing.actors.filter((a) => a.type === 'sailboat').length).toBeGreaterThanOrEqual(2);
    expect(calls(t)).toEqual(['passing']);
  });

  test('too narrow: a quay in a channel two columns wide is no berth', () => {
    const t = town(
      (g) => {
        g.flat(1);
        g.water(4, 30, 43, 43);
        g.water(20, 4, 21, 29); // a channel from the sea up into the land
      },
      (b) => {
        for (let z = 12; z <= 19; z++) b.block('dock', 20, 0, z);
      },
    );
    expect(findBerths(t.shape.facts)).toEqual([]);
    expect(calls(t).filter((c) => c !== 'passing')).toEqual([]);
  });

  test('no way in: a long quay in a closed lagoon has a berth, but no ship and no boat can get there', () => {
    const t = town(
      (g) => {
        g.flat(1);
        g.water(12, 12, 30, 30); // a lake, no way to the sea
      },
      (b) => {
        for (let x = 14; x <= 22; x++) b.block('dock', x, 0, 12);
        for (let x = 14; x <= 18; x++) b.block('dock', x, 0, 30);
      },
    );
    expect(findBerths(t.shape.facts).some((b) => b.cells >= 8)).toBe(true);
    expect(harbour(t.shape.facts).plans).toEqual([]);
    expect(calls(t).filter((c) => c !== 'passing')).toEqual([]);
    expect(t.dressing.actors.filter((a) => a.type === 'rowboat')).toEqual([]);
  });

  test('a way in is clear for the whole hull, every quarter column, from the edge to the berth', () => {
    const t = resolveScenario(galleonScn);
    const plan = harbour(t.shape.facts).plans.find((p) => p.ship === 'galleon')!;
    const field = planningField(t.shape.facts, plan.berth);
    const h = hullSize('galleon');
    // The plan was found by sailing it; check it again from scratch.
    const v = planArrival(field, h, plan.mooring, 1.4, 0.22)!;
    // It starts out beyond the edge of the map, square to a straight side.
    expect(mapEdge(v.path.points[0]![0], v.path.points[0]![1])).toBeGreaterThan(h.bow - h.stern);
    for (let s = beyond(h); s <= v.path.length; s += 0.25) {
      const p = pathAt(v.path, s);
      expect(hullClear(field, h, p.x, p.z, p.yaw, 0.05)).toBe(true);
    }
  });
});
