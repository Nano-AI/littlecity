// Whatever a player builds, the ground generators must draw it: no throw, a
// sound mesh, nothing flung off the map. Random towns (seeded, so a failure
// can be replayed) on real generated islands: every ground piece, floor and
// edge piece dropped wherever the game allows it, stacked on houses, docks
// and marble, erased again at random, then every ground structure is built
// with the real rules and the real parts.

import { describe, expect, test } from 'vitest';
import { columnIndex, edgeKey, key, SIZE_X, SIZE_Z } from '@/core/grid';
import type { EdgeKind, FloorKind, PlacedKind, StructureKind } from '@/core/kinds';
import { randInt, rand } from '@/core/rand';
import type { Edit, Rot } from '@/core/world';
import { validateMesh } from '@/gen/checks';
import { allGenerators, allParts } from '@/gen/discover';
import { meshBounds, triangleCount } from '@/gen/mesh';
import { resolveShape } from '@/resolve/index';
import { generateTerrain } from '@/terrain/terrain';
import { applyEdit, canApply, emptyWorld } from '@/world/world';

const GROUND: readonly StructureKind[] = ['tree', 'fountain', 'stall', 'fence', 'wall', 'stairs', 'dock', 'path', 'plaza', 'garden'];
const BLOCKS: readonly PlacedKind[] = ['tree', 'tree', 'fountain', 'stall', 'fence', 'fence', 'wall', 'wall', 'stairs', 'stairs', 'dock', 'dock', 'house', 'house', 'marble', 'marble', 'tower', 'arch', 'windmill', 'pillar', 'auto'];
const FLOORS: readonly FloorKind[] = ['path', 'path', 'plaza', 'garden', 'garden'];
const EDGES: readonly EdgeKind[] = ['fence', 'wall'];

function randomTown(seed: number, edits: number) {
  const terrain = generateTerrain(seed);
  let world = emptyWorld(seed);
  // Work in a patch of the island, so pieces meet each other.
  const cx = randInt(14, 33, seed, 'cx'), cz = randInt(14, 33, seed, 'cz');
  const tryEdit = (e: Edit): void => {
    if (canApply(world, terrain, e).ok) world = applyEdit(world, terrain, e);
  };
  for (let i = 0; i < edits; i++) {
    const x = cx + randInt(-7, 7, seed, 'x', i), z = cz + randInt(-7, 7, seed, 'z', i);
    if (x < 0 || z < 0 || x >= SIZE_X || z >= SIZE_Z) continue;
    const h = terrain.height[columnIndex(x, z)]!;
    // The first free level of the column, or now and then one above or below it.
    let y = h;
    while (y < 31 && world.blocks.has(key(x, y, z))) y++;
    y = Math.max(0, Math.min(31, y + (rand(seed, 'dy', i) < 0.15 ? randInt(-1, 1, seed, 'dyv', i) : 0)));
    const roll = rand(seed, 'what', i);
    if (roll < 0.5) {
      const kind = BLOCKS[randInt(0, BLOCKS.length - 1, seed, 'kind', i)]!;
      tryEdit({ type: 'placeBlock', cell: key(x, kind === 'dock' ? 0 : y, z), kind, color: randInt(0, 7, seed, 'color', i), from: null, rot: randInt(0, 3, seed, 'rot', i) as Rot });
    } else if (roll < 0.78) {
      // Floors go in runs, so regions form.
      const kind = FLOORS[randInt(0, FLOORS.length - 1, seed, 'floor', i)]!;
      const len = randInt(1, 5, seed, 'len', i), alongX = rand(seed, 'axis', i) < 0.5;
      for (let k = 0; k < len; k++) {
        const fx = x + (alongX ? k : 0), fz = z + (alongX ? 0 : k);
        if (fx >= SIZE_X || fz >= SIZE_Z) break;
        let fy = terrain.height[columnIndex(fx, fz)]!;
        while (fy < 31 && world.blocks.has(key(fx, fy, fz))) fy++;
        tryEdit({ type: 'placeFloor', cell: key(fx, fy, fz), floor: kind });
        // ... and sometimes under whatever stands there.
        if (fy > 0) tryEdit({ type: 'placeFloor', cell: key(fx, fy - 1, fz), floor: kind });
      }
    } else if (roll < 0.93) {
      const kind = EDGES[randInt(0, 1, seed, 'edge', i)]!;
      const len = randInt(1, 4, seed, 'elen', i), side = rand(seed, 'side', i) < 0.5 ? 'E' : 'S';
      for (let k = 0; k < len; k++) {
        const ex = x + (side === 'S' ? k : 0), ez = z + (side === 'E' ? k : 0);
        if (ex >= SIZE_X || ez >= SIZE_Z) break;
        tryEdit({ type: 'placeEdge', edge: edgeKey(ex, y, ez, side), kind });
      }
    } else {
      tryEdit({ type: 'eraseBlock', cell: key(x, Math.max(0, y - 1), z) });
      tryEdit({ type: 'eraseFloor', cell: key(x, y, z) });
    }
  }
  return { world, terrain };
}

describe('the ground generators draw whatever is built', () => {
  const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
  test.each(SEEDS)('a random town on island %i', (seed) => {
    const { world, terrain } = randomTown(seed, 260);
    const plan = resolveShape(world, terrain);
    const generators = allGenerators(), parts = allParts();
    let drawn = 0;
    for (const s of plan.structures.values()) {
      if (!GROUND.includes(s.kind)) continue;
      const out = generators.build(s, plan, parts);
      const where = `${s.kind} ${s.id} (seed ${seed})`;
      expect(validateMesh(out.mesh), where).toEqual([]);
      if (triangleCount(out.mesh) > 0) {
        const { min, max } = meshBounds(out.mesh);
        for (const v of [...min, ...max]) expect(Number.isFinite(v), where).toBe(true);
        expect(min[0], where).toBeGreaterThan(-2);
        expect(max[0], where).toBeLessThan(SIZE_X + 2);
        expect(min[2], where).toBeGreaterThan(-2);
        expect(max[2], where).toBeLessThan(SIZE_Z + 2);
        expect(min[1], where).toBeGreaterThan(-1.5);
        expect(max[1], where).toBeLessThan(32);
      }
      for (const m of Object.values(out.anchors)) for (let i = 0; i < 16; i++) expect(Number.isFinite(m[i]!), where).toBe(true);
      drawn++;
    }
    expect(drawn).toBeGreaterThan(10);
    // The same town draws the same meshes: generators are pure.
    const again = resolveShape(world, terrain);
    for (const s of plan.structures.values()) {
      if (!GROUND.includes(s.kind)) continue;
      expect(again.structures.get(s.id)!.hash).toBe(s.hash);
    }
  });
});
