// Churchyards (RC-01, FX-07), for R-G02 (a garden region's role) and R-H98
// (the headstones, the yew and the lychgate). Not a rule file.
//
// A churchyard is ground of 2–40 cells beside a chapel (a cell of it side by
// side with the chapel or its steeple), closed round by wall or fence: of
// the sides of its cells that look out of it, other than onto the chapel and
// its steeple, at least 60% are a wall or fence (an edge piece on that side,
// or a wall or fence piece in the cell beyond). It is either a garden region
// (R-G02 gives it the role) or bare grass (the cells a flood from beside the
// chapel reaches without crossing an edge piece, a block or a floor).
//
// Not: within 2 of a windmill (that is a wheat field); ground that touches
// another house on 2 or more sides (the priest's garden); ground up on a
// roof.

import { columnIndex, edgeOf, inBounds, key, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { Facts } from '@/resolve/facts/api';
import type { ShapePlan, StructureId } from '@/resolve/plan';

const DIRS: readonly Dir4[] = [0, 1, 2, 3];
export const YARD_MAX = 40;

/** The chapel and steeple structures, from the plan's roles. */
export function chapels(plan: ShapePlan): { chapel: StructureId; steeple: StructureId | null }[] {
  const out: { chapel: StructureId; steeple: StructureId | null }[] = [];
  for (const [id, { role }] of plan.roles) {
    if (role !== 'chapel') continue;
    const s = plan.structures.get(id)!;
    let steeple: StructureId | null = null;
    for (const c of s.cells) {
      for (const d of DIRS) {
        const o = plan.structureAt.get(neighbor(c, d));
        if (o !== undefined && plan.roles.get(o)?.role === 'steeple') steeple = o;
      }
    }
    out.push({ chapel: id, steeple });
  }
  return out.sort((a, b) => a.chapel - b.chapel);
}

/** Whether ground of these cells, beside this chapel, is closed round enough to be its churchyard. */
export function isChurchyard(f: Facts, cells: readonly CellKey[], church: ReadonlySet<StructureId>): boolean {
  if (cells.length < 2 || cells.length > YARD_MAX) return false;
  const mine = new Set(cells);
  let sides = 0, closed = 0, touchesChurch = false;
  const houses = new Map<StructureId, number>();
  for (const c of cells) {
    // On the ground, not on a roof.
    if (keyY(c) !== f.terrain.height[columnIndex(keyX(c), keyZ(c))]) return false;
    for (const d of DIRS) {
      const n = neighbor(c, d);
      if (n !== NO_CELL && mine.has(n)) continue;
      const other = n === NO_CELL ? undefined : f.structureAt.get(n);
      if (other !== undefined && church.has(other)) {
        touchesChurch = true;
        continue;
      }
      if (other !== undefined && f.kinds.get(n) === 'house') houses.set(other, (houses.get(other) ?? 0) + 1);
      sides++;
      const e = edgeOf(c, d);
      const kind = n === NO_CELL ? undefined : f.kinds.get(n);
      if ((e !== NO_CELL && f.world.edges.has(e)) || kind === 'wall' || kind === 'fence') closed++;
    }
  }
  if (!touchesChurch || sides === 0 || closed < sides * 0.6) return false;
  if ([...houses.values()].some((n) => n >= 2)) return false;
  // No windmill within 2.
  for (const c of cells) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let y = keyY(c); y <= keyY(c) + 2; y++) {
          const x = keyX(c) + dx, z = keyZ(c) + dz;
          if (inBounds(x, y, z) && f.kinds.get(key(x, y, z)) === 'windmill') return false;
        }
      }
    }
  }
  return true;
}

/**
 * The bare-grass yard beside a chapel that starts at `from` (a free ground cell side by side with the
 * chapel): the cells a flood reaches without crossing an edge piece or entering a block or a floor, or
 * null if it runs past YARD_MAX (open ground).
 */
export function grassYard(f: Facts, from: CellKey): CellKey[] | null {
  const free = (c: CellKey): boolean =>
    c !== NO_CELL && !f.kinds.has(c) && !f.world.floors.has(c) && keyY(c) === f.terrain.height[columnIndex(keyX(c), keyZ(c))] && keyY(c) > 0;
  if (!free(from)) return null;
  const seen = new Set<CellKey>([from]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!;
    for (const d of DIRS) {
      const e = edgeOf(c, d);
      if (e !== NO_CELL && f.world.edges.has(e)) continue;
      const n = neighbor(c, d);
      if (seen.has(n) || !free(n)) continue;
      seen.add(n);
      queue.push(n);
      if (seen.size > YARD_MAX) return null;
    }
  }
  return [...seen].sort((a, b) => a - b);
}
