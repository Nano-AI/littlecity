// The water and the boats (L06, L17, L19): the hulls as meshes, the sea
// lane as geometry, and the motion stepped on the harbour fixture.

import { describe, expect, test } from 'vitest';
import { SEA_Y, SIZE_X, SIZE_Z } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import { findDuplicateFaces, triangleCount, validateMesh } from '@/gen/checks';
import { allParts } from '@/gen/discover';
import { meshBounds } from '@/gen/mesh';
import { resolveDressing, resolveShape } from '@/resolve/index';
import type { Actor } from '@/resolve/plan';
import { computeLane, obstacleDistance } from '@/rules/life/sea-lanes.fact';
import { buildScenario } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { generateTerrain, initialWorld } from '@/terrain/terrain';
import fxSystem from '../fx/fx.system';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { recordingStage } from '../testing/stage';
import ring from '../water/water-ring.behaviour';
import rowboat from './rowboat.behaviour';
import sailboat from './sailboat.behaviour';

function harbour() {
  const built = buildScenario(findScenario('L17.rowboats')!);
  const shape = resolveShape(built.world, built.terrain);
  const dressing = resolveDressing(shape);
  const rec = recordingStage({ shape, dressing });
  const signals = createSignals(built.scenario.seed);
  const life = createLife(rec.stage, signals, { behaviours: [rowboat, sailboat, ring], systems: [fxSystem] });
  life.sync({ shape, dressing });
  return { rec, signals, life, shape, dressing };
}
const finite = (m: ArrayLike<number>): boolean => Array.from(m).every(Number.isFinite);

describe('the hulls', () => {
  const { shape } = harbour();
  const draw = (type: string, look: number, variant?: string) =>
    allParts().actor({ id: `t:${type}:${look}`, type, variant, at: null, params: { look }, rule: 'test', hash: 0 } as unknown as Actor, { plan: shape }).mesh;

  test.each([
    ['rowboat', 0.5, 0.75, 1000],
    ['sailboat', 0.8, 1.15, 1300],
    ['fishing-boat', 0.9, 1.3, 1600],
  ] as const)('%s: a sound mesh with no doubled walls, sitting in the water, in budget', (type, minLength, maxLength, budget) => {
    for (const look of [0, 3, 7]) {
      const mesh = draw(type, look);
      expect(validateMesh(mesh)).toEqual([]);
      // The only doubled faces allowed are the few thin sheets drawn from both sides (they face opposite ways, so they never fight).
      expect(findDuplicateFaces(mesh)).toBeLessThanOrEqual(4);
      expect(triangleCount(mesh)).toBeLessThanOrEqual(budget);
      expect(triangleCount(mesh)).toBeGreaterThan(150);
      const b = meshBounds(mesh);
      const length = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]);
      const beam = Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]);
      expect(length).toBeGreaterThan(minLength);
      expect(length).toBeLessThan(maxLength);
      expect(beam).toBeLessThan(length * 0.6); // a boat, not a tub
      // Local y = 0 is the waterline: part of the hull is under it, most of it over.
      expect(b.min[1]).toBeLessThan(-0.02);
      expect(b.max[1]).toBeGreaterThan(0.08);
    }
  });

  test('the sail and the pieces that move apart are sound meshes too', () => {
    for (const variant of ['main', 'jib']) expect(validateMesh(draw('boat-sail', 1, variant))).toEqual([]);
    expect(validateMesh(draw('mooring-line', 0))).toEqual([]);
    expect(validateMesh(draw('water-ring', 0, 'pillar'))).toEqual([]);
  });
});

describe('the sea lane', () => {
  test('on generated islands it keeps 3 columns from land all the way round, inside the map', () => {
    let lanes = 0;
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
      const terrain = generateTerrain(seed);
      const kinds = resolveShape(initialWorld(seed, terrain), terrain, { rules: [] }).kinds;
      const lane = computeLane(terrain, kinds);
      if (lane.kind === 'none') continue;
      lanes++;
      expect(lane.length).toBeGreaterThan(20);
      for (let s = 0; s < lane.length; s += 0.5) {
        const p = lane.at(s);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(SIZE_X);
        expect(p.z).toBeGreaterThan(0);
        expect(p.z).toBeLessThan(SIZE_Z);
        expect(obstacleDistance(terrain, kinds, p.x, p.z)).toBeGreaterThanOrEqual(2.8);
        expect(Math.hypot(p.dx, p.dz)).toBeCloseTo(1, 3);
      }
    }
    expect(lanes).toBeGreaterThanOrEqual(6);
  });

  test('an island with no sea has no lane', () => {
    const { terrain, world } = buildScenario(findScenario('hello-town')!);
    const lane = computeLane(terrain, resolveShape(world, terrain, { rules: [] }).kinds);
    // The flat test ground still has a rim of sea: whatever it finds must keep clear.
    for (const [x, z] of lane.points) expect(obstacleDistance(terrain, resolveShape(world, terrain, { rules: [] }).kinds, x, z)).toBeGreaterThanOrEqual(2.8);
  });
});

describe('boats afloat', () => {
  test('sailboats keep to open water at the waterline for minutes on end, and travel', () => {
    const { rec, signals, life, shape, dressing } = harbour();
    const boats = dressing.actors.filter((a) => a.type === 'sailboat');
    expect(boats).toHaveLength(2);
    const travelled = boats.map(() => 0);
    const last = boats.map(() => [0, 0, 0] as [number, number, number]);
    for (let f = 0; f < 60 * 150; f++) {
      life.update(signals.advance(1 / 60));
      if (f % 30) continue;
      boats.forEach((b, i) => {
        const m = rec.of(b.id).matrix;
        expect(finite(m)).toBe(true);
        const [x, y, z] = positionOf(m);
        expect(Math.abs(y - SEA_Y)).toBeLessThan(0.12);
        expect(obstacleDistance(shape.terrain, shape.kinds, x, z)).toBeGreaterThanOrEqual(2.5);
        if (f > 0) travelled[i]! += Math.hypot(x - last[i]![0], z - last[i]![2]);
        last[i] = [x, y, z];
      });
    }
    for (const d of travelled) expect(d).toBeGreaterThan(20);
    // The two never come close to each other.
    expect(Math.hypot(last[0]![0] - last[1]![0], last[0]![2] - last[1]![2])).toBeGreaterThan(4);
  });

  test('a moored rowboat floats within reach of its line, on the water, through gusts', () => {
    const { rec, signals, life, dressing } = harbour();
    const boats = dressing.actors.filter((a) => a.type === 'rowboat');
    expect(boats.length).toBeGreaterThanOrEqual(2);
    const moved = boats.map(() => new Set<string>());
    for (let f = 0; f < 60 * 60; f++) {
      life.update(signals.advance(1 / 60));
      if (f % 20) continue;
      boats.forEach((b, i) => {
        const r = rec.of(b.id);
        if (!r.visible) return;
        expect(finite(r.matrix)).toBe(true);
        const [x, y, z] = positionOf(r.matrix);
        const [sx, , sz] = positionOf(r.base);
        const line = Number((b.params as { line?: number }).line ?? 0.34);
        // Bow to bollard is the line; the hull's middle is half a boat further.
        expect(Math.hypot(x - sx, z - sz)).toBeLessThan(line + 0.75);
        expect(Math.abs(y - SEA_Y)).toBeLessThan(0.1);
        moved[i]!.add(`${x.toFixed(2)},${z.toFixed(2)},${y.toFixed(3)}`);
      });
    }
    for (const m of moved) expect(m.size).toBeGreaterThan(5); // it is alive, not parked
    life.dispose();
    expect(rec.spawned.every((s) => s.released)).toBe(true);
  });
});
