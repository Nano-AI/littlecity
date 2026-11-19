// L29: the moving door leaf sits exactly where the still door drew its leaf,
// for every door look and stoop, and swings out about its hinge.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import { multiply, translation } from '@/core/mat4';
import { findDuplicateFaces, validateMesh } from '@/gen/checks';
import { allParts } from '@/gen/discover';
import { meshBounds, transformMesh } from '@/gen/mesh';
import { towerDoor } from '@/parts/monuments/openings';
import { hatchLift, hingesOf, HATCH, leafLine, leafSwing, wallInSocket, type LeafKind } from '@/parts/openings/door-leaf';
import { MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { resolveTown } from '@/resolve/index';
import type { Actor, Feature } from '@/resolve/plan';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';

const SEED = 91;
const terrain = flatTerrain(SEED);
const b = new TownBuilder(emptyWorld(SEED), terrain);
b.house(10, 10, { floors: 2, color: 2 });
const plan = resolveTown(b.world, terrain).shape;
const house = plan.structures.get(plan.structureAt.get(key(10, 1, 10))!)!;
const parts = allParts();

const leaf = (variant: string, params: Record<string, number> = {}) =>
  parts.actor({ id: `door-leaf@test:${variant}`, type: 'door-leaf', variant, params, at: { socket: 'x' }, home: house.id, rule: 'test', hash: 1 } as Actor, { plan });

describe('door leaves (L29)', () => {
  test('the part exists, so doors draw a dark doorway and leave the leaf to it', () => {
    expect(parts.has('actor', 'door-leaf')).toBe(true);
  });

  test.each([
    ['plain', 0], ['plain', 1], ['plain', 3], ['deck', 0], ['shop', 0], ['shop', 2], ['double', 0], ['double', 1], ['double-right', 1],
  ] as const)('door-leaf/%s with %i steps stands on the wall where the still door drew it', (variant, steps) => {
    const kind = variant === 'double-right' ? 'double' : variant;
    const door = parts.feature({ id: `door@t:${kind}`, type: 'door', structure: house.id, cell: key(10, 1, 10), dir: 2, variant: kind, params: { main: 1, steps }, rule: 'test' } as Feature, { plan, structure: house });
    const out = leaf(variant, { steps });
    expect(validateMesh(out.mesh)).toEqual([]);
    expect(findDuplicateFaces(out.mesh)).toBe(0);
    // In the wall frame: the actor's frame is the door's socket.
    const placed = meshBounds(transformMesh(out.mesh, door.anchors!.door!));
    expect(placed.min[2]).toBeGreaterThan(0.03);
    expect(placed.max[2]).toBeLessThan(0.09);
    expect(placed.min[1]).toBeGreaterThan(-0.01);
    const h = hingesOf(kind)[variant === 'double-right' ? 1 : 0]!;
    const [lo, hi] = h.dir > 0 ? [h.hinge, h.hinge + h.width] : [h.hinge - h.width, h.hinge];
    expect(placed.min[0]).toBeCloseTo(lo, 2);
    expect(placed.max[0]).toBeGreaterThan(hi - 0.02);
    expect(placed.max[0]).toBeLessThan(hi + 0.02);
  });

  test("the tower door's leaf stands where towerDoor drew it", () => {
    const mb = new MeshBuilder({ ink: 1 });
    const socket = towerDoor(mb, PALETTE.stoneShade, PALETTE.wood).door!;
    const placed = meshBounds(transformMesh(leaf('tower').mesh, socket));
    expect(placed.min[0]).toBeCloseTo(-0.115, 2);
    expect(placed.min[2]).toBeGreaterThan(0.03);
    expect(placed.max[2]).toBeLessThan(0.09);
    expect(multiply(socket, wallInSocket('tower', 0))[14]).toBeCloseTo(0);
  });

  test.each(['plain', 'shop', 'double', 'tower'] as LeafKind[])('%s: shut is the drawing as built; open swings the free end out of the wall', (kind) => {
    for (const h of hingesOf(kind)) {
      leafSwing(h, 0).forEach((v, i) => expect(v).toBeCloseTo(translation(0, 0, 0)[i]!, 9));
      const m = leafSwing(h, h.swing);
      const end = [h.hinge + h.dir * h.width, 0, h.z];
      const x = m[0]! * end[0]! + m[8]! * end[2]! + m[12]!, z = m[2]! * end[0]! + m[10]! * end[2]! + m[14]!;
      const [, , lx, lz] = leafLine(h, h.swing);
      expect(x).toBeCloseTo(lx, 6);
      expect(z).toBeCloseTo(lz, 6);
      expect(z).toBeGreaterThan(0.2);
      // Past square: leaning back toward the wall, beyond the hinge on its own side.
      expect((x - h.hinge) * h.dir).toBeLessThan(0);
    }
  });

  test('a hatch lid flops over onto the terrace beyond its hinge', () => {
    const m = hatchLift(HATCH.lift);
    const near = [0, HATCH.y, HATCH.size / 2];
    const y = m[5]! * near[1]! + m[9]! * near[2]! + m[13]!, z = m[6]! * near[1]! + m[10]! * near[2]! + m[14]!;
    expect(z).toBeLessThan(HATCH.hinge - 0.2);
    expect(y).toBeGreaterThan(0.04);
    expect(validateMesh(leaf('hatch', { derived: 1 }).mesh)).toEqual([]);
    expect(validateMesh(leaf('hatch', { frame: 1 }).mesh)).toEqual([]);
  });
});
