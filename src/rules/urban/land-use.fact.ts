// Land use: what each patch of bare ground inside the town IS. This is the
// heart of urban fill (catalogue part U): the game looks at an empty patch
// and knows what a real town would have there.
//
// It is a fact, not just the urban rules' own find(), for two reasons. The
// uses exclude each other (a cell is a front garden OR part of a pocket
// park, never both), so they are decided in one place, in priority order.
// And the decoration rules, which run BEFORE the urban rules, must know
// which ground is spoken for: wild grass (D24) does not grow in a front
// garden. `byCell` answers that.
//
// Each urban rule reads its own list from here and only dresses it.
//
// Reads the finished shape (door features), so it serves dressing-stage
// rules only.

import { keyY, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineFact } from '@/resolve/facts/api';
import { wildGrass } from '@/resolve/facts/grass.fact';
import { edgeBetween } from '@/resolve/facts/lib';
import type { StructureId } from '@/resolve/plan';
import { heightAt, onGround } from '../decoration/lib';

/** U03: the one grass cell between a house's main door and a street. */
export interface FrontGarden {
  cell: CellKey;
  /** The way the door looks: from the house, across the garden, to the street. */
  dir: Dir4;
  house: StructureId;
  door: CellKey;
  /**
   * Whether a fence closes each flank. In the order of the street fence's frame: [−X, +X], which
   * are the sides (dir + 3) % 4 and (dir + 1) % 4 of the garden cell.
   */
  closed: readonly [boolean, boolean];
}

export type LandUse = { use: 'front-garden'; garden: FrontGarden };

export interface LandUses {
  /** What a ground cell is used as; a cell with no entry is ordinary open ground. */
  byCell: ReadonlyMap<CellKey, LandUse>;
  frontGardens: readonly FrontGarden[];
}

export const landUse = defineFact<LandUses>('landUse', (f) => {
  const byCell = new Map<CellKey, LandUse>();
  const grass = wildGrass(f);
  const shape = f.shape;

  // ── U03 front gardens ──
  const gardens: FrontGarden[] = [];
  for (const ft of shape.features) {
    if (ft.type !== 'door' || ft.cell === undefined || ft.dir === undefined) continue;
    if ((ft.params as { main?: number } | undefined)?.main !== 1) continue;
    if (f.kinds.get(ft.cell) !== 'house') continue;
    const dir = ft.dir as Dir4;
    const cell = neighbor(ft.cell, dir);
    if (cell === NO_CELL || !grass.has(cell) || keyY(cell) !== keyY(ft.cell)) continue;
    const street = neighbor(cell, dir);
    if (street === NO_CELL || f.world.floors.get(street) !== 'path' || !onGround(f, street)) continue;
    // A fence somebody placed already does the job.
    if (edgeBetween(f, cell, dir)) continue;
    if (byCell.has(cell)) continue;
    gardens.push({ cell, dir, house: ft.structure, door: ft.cell, closed: [false, false] });
    byCell.set(cell, { use: 'front-garden', garden: gardens[gardens.length - 1]! });
  }
  // A flank is fenced where the ground beside the garden is open and level: not against a wall,
  // not at a bank, not where a placed fence stands, and only once between two gardens side by side
  // (the garden to the west or north draws the fence they share).
  for (const g of gardens) {
    const flank = (d: Dir4): boolean => {
      const n = neighbor(g.cell, d);
      if (n === NO_CELL || edgeBetween(f, g.cell, d)) return false;
      if (f.kinds.has(n) || heightAt(f, n & 63, (n >> 6) & 63) !== keyY(g.cell)) return false;
      const other = byCell.get(n);
      if (other && other.garden.dir === g.dir) return d === 1 || d === 2;
      return true;
    };
    const minus = ((g.dir + 3) % 4) as Dir4, plus = ((g.dir + 1) % 4) as Dir4;
    (g as { closed: readonly [boolean, boolean] }).closed = [flank(minus), flank(plus)];
  }

  return { byCell, frontGardens: gardens };
});
