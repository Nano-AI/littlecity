// R-P01 · tier 1 · Tree species (first match wins):
//   on sand within 1 of water        → palm
//   within 1 of water                → willow
//   terrain level ≥ 4                → pine
//   on or beside a plaza             → clipped tree in a planter
//   on a garden floor                → fruit tree
//   part of 5+ touching trees        → grove tree with undergrowth
//   otherwise                        → the seeded mix of round, cypress and bush
//
// "Touching" trees stand side by side (4-connected), on one level or one
// terrain step apart. Palms, willows and pines only grow from the ground: a
// tree on a deck or a roof falls through to the later lines.

import { columnIndex, key, keyX, keyY, keyZ, neighbor, NO_CELL, SIZE_Y, type CellKey, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import type { RolesOf } from '@/core/vocab';
import { MAT } from '@/core/world';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { openWater } from '@/resolve/facts/lib';
import { TREE } from '@/style/ground';

type TreeRole = RolesOf<'tree'>;
const DIRS: readonly Dir4[] = [0, 1, 2, 3];

/** The size of the group of touching trees each tree belongs to. */
export function groveSizes(f: Facts): Map<CellKey, number> {
  const trees: CellKey[] = [];
  for (const [c, k] of f.kinds) if (k === 'tree') trees.push(c);
  trees.sort((a, b) => a - b);
  const isTree = new Set(trees);
  const onGround = (c: CellKey): boolean => keyY(c) === f.terrain.height[columnIndex(keyX(c), keyZ(c))];
  const size = new Map<CellKey, number>();
  for (const start of trees) {
    if (size.has(start)) continue;
    const group = [start];
    const seen = new Set(group);
    for (let i = 0; i < group.length; i++) {
      const c = group[i]!;
      for (const d of DIRS) {
        const n = neighbor(c, d);
        if (n === NO_CELL) continue;
        const reach = [n];
        if (onGround(c)) {
          // One terrain step up or down.
          for (const dy of [1, -1]) {
            const y = keyY(n) + dy;
            if (y < 0 || y >= SIZE_Y) continue;
            const m = key(keyX(n), y, keyZ(n));
            if (onGround(m)) reach.push(m);
          }
        }
        for (const m of reach) {
          if (isTree.has(m) && !seen.has(m)) {
            seen.add(m);
            group.push(m);
          }
        }
      }
    }
    for (const c of group) size.set(c, group.length);
  }
  return size;
}

export function treeSpecies(f: Facts, cell: CellKey, groves: ReadonlyMap<CellKey, number>): TreeRole {
  const x = keyX(cell), y = keyY(cell), z = keyZ(cell);
  const col = columnIndex(x, z);
  const ground = f.terrain.height[col]!;
  const rooted = y === ground;
  // Within 1 of water: open water in a side-neighbouring column (asked directly: no distance field needed).
  const nearWater = openWater(f, x, z - 1) || openWater(f, x + 1, z) || openWater(f, x, z + 1) || openWater(f, x - 1, z);
  if (rooted && nearWater && f.terrain.material[col] === MAT.sand) return 'palm';
  if (rooted && nearWater) return 'willow';
  if (rooted && ground >= TREE.pineLevel) return 'pine';
  if (f.world.floors.get(cell) === 'plaza' || DIRS.some((d) => f.world.floors.get(neighbor(cell, d)) === 'plaza')) return 'planter-tree';
  if (f.world.floors.get(cell) === 'garden') return 'fruit-tree';
  if ((groves.get(cell) ?? 1) >= TREE.grove) return 'grove-tree';
  const roll = rand(f.seed, 'R-P01', cell);
  return roll < TREE.mixRound ? 'round-tree' : roll < TREE.mixRound + TREE.mixCypress ? 'cypress' : 'bush';
}

export default defineRule<{ role: TreeRole }>({
  id: 'R-P01.tree-species',
  part: 'roles',
  tier: 1,
  priority: 3990,
  about: 'Reads: terrain height and material, open water beside the column, floors in and beside the cell, groups of touching trees. Claims: the tree’s role.',
  find({ facts }) {
    const groves = groveSizes(facts);
    const out: Candidate<{ role: TreeRole }>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'tree') continue;
      const cell = s.cells[0]!;
      out.push({ anchor: cell, structure: s.id, data: { role: treeSpecies(facts, cell, groves) } });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, c.data.role);
  },
});
