// Berths and the ways in and out of them (berths.fact.ts, ship-routes.ts).

import { describe, expect, test } from 'vitest';
import { columnIndex, DIR4, keyX, keyZ } from '@/core/grid';
import { resolveScenario, scenario, type TerrainBuilder, type TownBuilder } from '@/scenario';
import galleonScn from '../../../scenarios/rules/L38.galleon.scenario';
import { findBerths, harbour, hullSize, planningField } from './berths.fact';
import { hullClear, pathAt, planArrival } from './ship-routes';

function town(terrain: (t: TerrainBuilder) => void, build: (b: TownBuilder) => void) {
  return resolveScenario(scenario({ name: 'berth-test', seed: 11, terrain, build }));
}
const calls = (t: ReturnType<typeof town>): string[] => t.dressing.actors.filter((a) => a.type === 'ship-call').map((a) => a.variant ?? '');

describe('berths', () => {
  test('the L38 quay is one berth of ten, and a galleon, a cog and a galley each have a way in and out', () => {
    const t = resolveScenario(galleonScn);
    const berths = findBerths(t.shape.facts);
    expect(berths[0]!.cells).toBe(10);
    const h = harbour(t.shape.facts);
    for (const ship of ['galleon', 'cog', 'galley'] as const) expect(h[ship]?.berth.key).toBe(berths[0]!.key);
    // The berth's water is reserved: no rowboat lies in it.
    const rowboats = t.dressing.actors.filter((a) => a.type === 'rowboat');
    expect(rowboats.length).toBeGreaterThan(0);
    for (const r of rowboats) {
      const [, cell, dir] = /@(\d+):(\d)/.exec((r.at as { socket: string }).socket)!;
      const [dx, dz] = DIR4[Number(dir) as 0]!;
      expect(h.reserved.has(columnIndex(keyX(Number(cell)) + dx, keyZ(Number(cell)) + dz))).toBe(false);
    }
  });

  test('too short: a quay of four gets no ship', () => {
    const t = town(
      (g) => {
        g.flat(1);
        g.water(4, 24, 43, 43);
      },
      (b) => {
        for (let x = 10; x <= 13; x++) b.block('dock', x, 0, 24);
        for (let x = 20; x <= 23; x++) b.block('dock', x, 0, 24);
      },
    );
    expect(findBerths(t.shape.facts).every((b) => b.cells < 5)).toBe(true);
    expect(calls(t)).toEqual([]);
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
    expect(calls(t)).toEqual([]);
  });

  test('no way out: a long quay in a closed lagoon has a berth but no ship can reach it', () => {
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
    const h = harbour(t.shape.facts);
    expect(h.galleon).toBeNull();
    expect(h.cog).toBeNull();
    expect(calls(t)).toEqual([]);
  });

  test('a way in is clear for the whole hull, every quarter column, from the edge to the berth', () => {
    const t = resolveScenario(galleonScn);
    const plan = harbour(t.shape.facts).galleon!;
    const field = planningField(t.shape.facts, plan.berth);
    const h = hullSize('galleon');
    // The plan was found by sailing it; check it again from scratch.
    const v = planArrival(field, h, plan.mooring, 1.4, 0.22)!;
    // (The first stretch is where it rises over the edge, half off the map.)
    for (let s = 3.5; s <= v.path.length; s += 0.25) {
      const p = pathAt(v.path, s);
      expect(hullClear(field, h, p.x, p.z, p.yaw, 0.05)).toBe(true);
    }
  });
});
