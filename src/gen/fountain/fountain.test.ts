import { describe, expect, test } from 'vitest';
import { CELL_H, key, keyX, keyZ } from '@/core/grid';
import { positionOf, transformDir } from '@/core/mat4';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allParts } from '@/gen/discover';
import { MeshBuilder, meshBounds, triangleCount } from '@/gen/mesh';
import { resolveTown } from '@/resolve/index';
import fountainRule, { fountainRole } from '@/rules/roles/R-F01.fountain.rule';
import { fountainSocketId, fountainSockets, type FountainRole } from '@/rules/roles/ground-props';
import { flatTerrain, TownBuilder } from '@/scenario';
import { FOUNTAIN } from '@/style/props';
import { emptyWorld } from '@/world/world';
import fountainGen, { drawFountain, FOUNTAIN_ROLES } from './fountain.gen';

const SEEDS = [1, 2, 3, 17, 404, 9001];
/** Triangles per fountain. The tiered fountain is the round, many-moulded one. */
const BUDGET: Record<FountainRole, number> = { 'tiered-fountain': 760, 'well': 420, 'birdbath': 400, 'basin': 400 };
/** Separately outlined surfaces. */
const INK: Record<FountainRole, number> = { 'tiered-fountain': 8, 'well': 10, 'birdbath': 3, 'basin': 9 };
const TALL: Record<FountainRole, [number, number]> = {
  'tiered-fountain': [0.7, 0.82],
  'well': [0.8, 0.95],
  'birdbath': [0.4, 0.55],
  'basin': [0.5, 0.65],
};

const terrain = flatTerrain(5);
function town(build: (b: TownBuilder) => void) {
  const b = new TownBuilder(emptyWorld(5), terrain);
  build(b);
  return resolveTown(b.world, terrain, { rules: [fountainRule] });
}

describe('the four fountains', () => {
  test.each(FOUNTAIN_ROLES)('%s: a sound mesh, in budget, inside its cell', (role) => {
    for (const seed of SEEDS) {
      const b = new MeshBuilder({ ink: seed });
      const anchors = drawFountain(b, role, seed);
      const mesh = b.build();
      expect(validateMesh(mesh)).toEqual([]);
      expect(findDuplicateFaces(mesh)).toBe(0);
      expect(triangleCount(mesh)).toBeLessThanOrEqual(BUDGET[role]);
      expect(inkGroups(mesh).size).toBe(INK[role]);
      const { min, max } = meshBounds(mesh);
      for (const v of [min[0], min[2], max[0], max[2]]) expect(Math.abs(v)).toBeLessThanOrEqual(0.49);
      expect(min[1]).toBeGreaterThanOrEqual(0);
      expect(max[1]).toBeGreaterThanOrEqual(TALL[role][0]);
      expect(max[1]).toBeLessThanOrEqual(TALL[role][1]);
      // Every socket the rule declares for this fountain has a frame, inside the piece.
      for (const s of fountainSockets(role)) {
        const at = anchors[s.name];
        expect(at, `${role} ${s.name}`).toBeDefined();
        const p = positionOf(at!);
        expect(Math.hypot(p[0], p[2])).toBeLessThan(0.5);
        expect(p[1]).toBeGreaterThan(0.1);
        expect(p[1]).toBeLessThanOrEqual(max[1] + 1e-6);
      }
    }
  });

  test('water lies flat and still: no sway anywhere on a fountain but the birdbath’s flowers', () => {
    for (const role of FOUNTAIN_ROLES) {
      const b = new MeshBuilder();
      drawFountain(b, role, 3);
      const moving = b.build().sway.filter((s) => s > 0).length;
      if (role === 'birdbath') expect(moving).toBeGreaterThan(0);
      else expect(moving).toBe(0);
    }
  });

  test('jets set off the way the socket says: up from the finial, outward from a lip or a spout', () => {
    for (const role of ['tiered-fountain', 'basin'] as const) {
      const anchors = drawFountain(new MeshBuilder(), role, 7);
      for (const s of fountainSockets(role)) {
        if (s.type !== 'water-jet') continue;
        const m = anchors[s.name]!;
        const p = positionOf(m);
        const y = transformDir(m, [0, 1, 0]);
        if (s.name === 'top') {
          expect(y[1]).toBeCloseTo(1, 6);
          expect(p[1]).toBeCloseTo(FOUNTAIN.height, 6);
        } else {
          expect(y[1]).toBeCloseTo(0, 6);
          // Pointing away from the middle.
          expect(y[0] * p[0] + y[2] * p[2]).toBeGreaterThan(0);
        }
      }
    }
  });

  test('the same seed draws the same fountain; another seed, another', () => {
    const draw = (seed: number): Float32Array => {
      const b = new MeshBuilder({ ink: 1 });
      drawFountain(b, 'basin', seed);
      return b.build().position;
    };
    expect(draw(11)).toEqual(draw(11));
    const anchors = (seed: number) => drawFountain(new MeshBuilder(), 'tiered-fountain', seed).rim0!;
    expect(anchors(11)).not.toEqual(anchors(12));
  });
});

describe('R-F01 and the fountain generator together', () => {
  const plan = town((b) => {
    b.plaza(10, 10, 12, 12);
    b.put('fountain', 11, 11); //                       in a square
    b.fenceAround(16, 10, 18, 12, 'wall');
    b.put('fountain', 17, 11); //                       in a courtyard
    b.garden(22, 10, 24, 12);
    b.put('fountain', 23, 11); //                       on a garden
    b.put('fountain', 28, 11); //                       on bare ground
    b.plaza(32, 10, 33, 11);
    b.put('fountain', 32, 10); //                       on a plaza too small to be a square
    // Set down first, paved round afterwards: plaza of one square on three sides.
    b.put('fountain', 37, 16);
    b.plaza(36, 14, 38, 15).plaza(36, 16).plaza(38, 16).plaza(36, 17, 38, 19);
  }).shape;
  const roleAt = (x: number, z: number): string | undefined => plan.roles.get(plan.structureAt.get(key(x, 1, z))!)?.role;

  test('first match wins: square, courtyard, garden, otherwise a basin', () => {
    expect(roleAt(11, 11)).toBe('tiered-fountain');
    expect(roleAt(17, 11)).toBe('well');
    expect(roleAt(23, 11)).toBe('birdbath');
    expect(roleAt(28, 11)).toBe('basin');
    expect(roleAt(32, 10)).toBe('basin');
    expect(roleAt(37, 16)).toBe('tiered-fountain');
    expect(fountainRole(plan.facts, key(28, 1, 11))).toBe('basin');
  });

  test('a square beats a courtyard: a paved, walled court gets the tiered fountain', () => {
    const walled = town((b) => {
      b.plaza(10, 10, 12, 12);
      b.fenceAround(10, 10, 12, 12, 'wall');
      b.put('fountain', 11, 11);
    }).shape;
    expect(walled.roles.get(walled.structureAt.get(key(11, 1, 11))!)?.role).toBe('tiered-fountain');
  });

  test('every socket the rule declared gets its frame from the generator, on the fountain', () => {
    let fountains = 0;
    for (const s of plan.structures.values()) {
      if (s.kind !== 'fountain') continue;
      fountains++;
      const out = fountainGen.build(s, plan, allParts());
      expect(validateMesh(out.mesh)).toEqual([]);
      const cell = s.cells[0]!;
      const declared = plan.sockets.filter((k) => k.structure === s.id);
      const role = plan.roles.get(s.id)!.role as FountainRole;
      expect(declared.map((k) => k.id).sort()).toEqual(fountainSockets(role).map((k) => fountainSocketId(cell, k)).sort());
      for (const socket of declared) {
        const at = out.anchors[socket.id];
        expect(at, socket.id).toBeDefined();
        const p = positionOf(at!);
        expect(Math.abs(p[0] - (keyX(cell) + 0.5))).toBeLessThan(0.5);
        expect(Math.abs(p[2] - (keyZ(cell) + 0.5))).toBeLessThan(0.5);
        expect(p[1]).toBeGreaterThan(CELL_H);
        expect(p[1]).toBeLessThan(CELL_H * 2 + 0.2);
      }
    }
    expect(fountains).toBe(6);
  });

  test('with no role (rules not run) a fountain is still drawn, as a basin', () => {
    const b = new TownBuilder(emptyWorld(5), terrain);
    b.put('fountain', 20, 20);
    const bare = resolveTown(b.world, terrain, { rules: [] }).shape;
    const s = [...bare.structures.values()].find((k) => k.kind === 'fountain')!;
    const out = fountainGen.build(s, bare, allParts());
    expect(triangleCount(out.mesh)).toBeGreaterThan(100);
    expect(Object.keys(out.anchors).length).toBe(fountainSockets('basin').length);
  });
});
