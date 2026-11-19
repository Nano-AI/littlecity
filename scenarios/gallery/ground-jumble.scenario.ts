// Gallery: a jumble. Ground pieces, floors and edge pieces dropped at random
// (seeded) wherever the game allows, on a shore with two terraces: trees in
// gardens, fences across paths, stairs against walls, stalls on docks. It is
// not meant to be pretty; it is where to look for pieces that meet badly
// (z-fighting, floating ends, a run that should have joined), the cases
// nobody thinks to build on purpose.

import { columnIndex, edgeKey, key } from '@/core/grid';
import type { EdgeKind, FloorKind, PlacedKind } from '@/core/kinds';
import { rand, randInt } from '@/core/rand';
import type { Edit, Rot } from '@/core/world';
import { scenario } from '@/scenario';
import { canApply } from '@/world/world';

const SEED = 91;
const BLOCKS: readonly PlacedKind[] = ['tree', 'tree', 'tree', 'fountain', 'stall', 'fence', 'fence', 'wall', 'wall', 'stairs', 'dock', 'dock', 'dock', 'house', 'marble', 'marble'];
const FLOORS: readonly FloorKind[] = ['path', 'path', 'path', 'plaza', 'garden', 'garden'];
const EDGES: readonly EdgeKind[] = ['fence', 'fence', 'wall'];

export default scenario({
  name: 'ground-jumble',
  seed: SEED,
  about: 'Ground pieces dropped at random on a shore with terraces: the place to look for pieces that meet badly.',
  terrain(t) {
    t.rect(10, 10, 34, 30, 1);
    t.rect(10, 10, 34, 17, 2);
    t.rect(10, 10, 20, 13, 3);
    t.water(18, 26, 27, 30); // a bay
  },
  build(b) {
    const attempt = (e: Edit): void => {
      if (canApply(b.world, b.terrain, e).ok) b.edit(e);
    };
    for (let i = 0; i < 520; i++) {
      const x = randInt(10, 34, SEED, 'x', i), z = randInt(10, 31, SEED, 'z', i);
      let y = b.terrain.height[columnIndex(x, z)]!;
      while (y < 31 && b.world.blocks.has(key(x, y, z))) y++;
      const roll = rand(SEED, 'what', i);
      if (roll < 0.4) {
        const kind = BLOCKS[randInt(0, BLOCKS.length - 1, SEED, 'kind', i)]!;
        attempt({ type: 'placeBlock', cell: key(x, kind === 'dock' ? 0 : y, z), kind, color: randInt(0, 7, SEED, 'color', i), from: null, rot: randInt(0, 3, SEED, 'rot', i) as Rot });
      } else if (roll < 0.75) {
        const kind = FLOORS[randInt(0, FLOORS.length - 1, SEED, 'floor', i)]!;
        const len = randInt(1, 6, SEED, 'len', i), alongX = rand(SEED, 'axis', i) < 0.5;
        for (let k = 0; k < len; k++) {
          const fx = x + (alongX ? k : 0), fz = z + (alongX ? 0 : k);
          if (fx > 34 || fz > 31) break;
          let fy = b.terrain.height[columnIndex(fx, fz)]!;
          while (fy < 31 && b.world.blocks.has(key(fx, fy, fz))) fy++;
          attempt({ type: 'placeFloor', cell: key(fx, fy, fz), floor: kind });
          if (fy > 0) attempt({ type: 'placeFloor', cell: key(fx, fy - 1, fz), floor: kind });
        }
      } else {
        const kind = EDGES[randInt(0, EDGES.length - 1, SEED, 'edge', i)]!;
        const len = randInt(1, 4, SEED, 'elen', i), side = rand(SEED, 'side', i) < 0.5 ? 'E' : 'S';
        for (let k = 0; k < len; k++) {
          const ex = x + (side === 'S' ? k : 0), ez = z + (side === 'E' ? k : 0);
          if (ex > 34 || ez > 31) break;
          attempt({ type: 'placeEdge', edge: edgeKey(ex, y, ez, side), kind });
        }
      }
    }
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 38, zoom: 2.1, target: [22, 1, 20.5] },
    { name: 'back', yaw: 225, pitch: 38, zoom: 2.1, target: [22, 1, 20.5] },
    { name: 'west', yaw: 135, pitch: 36, zoom: 3.4, target: [17, 2, 16] },
    { name: 'east', yaw: 315, pitch: 36, zoom: 3.4, target: [28, 1, 22] },
    { name: 'bay', yaw: 45, pitch: 34, zoom: 3.6, target: [22.5, 1, 26] },
  ],
  expect(plan, _dressing, check) {
    check.ok(plan.world.blocks.size > 60, `blocks were dropped (${plan.world.blocks.size})`);
    check.ok(plan.world.floors.size > 120, `floors were laid (${plan.world.floors.size})`);
    check.ok(plan.world.edges.size > 40, `edge pieces were set (${plan.world.edges.size})`);
    // Every ground structure has a role where its kind has role rules.
    for (const s of plan.structures.values()) {
      if (['tree', 'fountain', 'stall', 'fence', 'wall', 'dock', 'garden'].includes(s.kind)) check.ok(plan.roles.has(s.id), `${s.kind} ${s.id} has a role`);
    }
  },
});
