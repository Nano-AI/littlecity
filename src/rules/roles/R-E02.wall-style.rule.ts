// R-E02 · tier 1 · Wall style (first match wins, per wall run):
//   touching marble or a tower  → crenellated curtain wall, one storey tall
//                                 (people cannot walk on it)
//   around a garden             → low stone wall, with creepers p = 0.4
//   otherwise                   → the spike's low wall
//
// "Touching": a cell piece with marble or a tower beside it, or an edge
// piece with marble or a tower in one of the cells it separates, or in the
// cells beyond one of its free ends (the wall runs into it). Standing ON
// marble does not count: that is a parapet, and stays low.
// "Around a garden": a cell piece on or beside a garden cell, or an edge
// piece with a garden cell on either side.

import { edgeCells, neighbor, NO_CELL, type CellKey } from '@/core/grid';
import type { Tag } from '@/core/vocab';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import type { Structure } from '@/resolve/plan';
import { WALL } from '@/style/edges';
import { cellsBeyond, DIRS, edgeEndIsFree, type WallRole } from '../joinery/edges-lib';

export function wallRoleOf(f: Facts, s: Structure): WallRole {
  const castle = (c: CellKey): boolean => c !== NO_CELL && (f.kinds.get(c) === 'marble' || f.kinds.get(c) === 'tower');
  const garden = (c: CellKey): boolean => c !== NO_CELL && f.world.floors.get(c) === 'garden';
  let byGarden = false;
  for (const c of s.cells) {
    if (DIRS.some((d) => castle(neighbor(c, d)))) return 'curtain-wall';
    if (garden(c) || DIRS.some((d) => garden(neighbor(c, d)))) byGarden = true;
  }
  for (const e of s.edges) {
    const sides = edgeCells(e);
    if (sides.some(castle)) return 'curtain-wall';
    for (const end of [0, 1] as const) {
      if (edgeEndIsFree(f, e, end, 'wall') && cellsBeyond(e, end).some(castle)) return 'curtain-wall';
    }
    if (sides.some(garden)) byGarden = true;
  }
  return byGarden ? 'garden-wall' : 'low-wall';
}

/** The palette index of the tower (first choice) or marble a curtain wall touches: its stone. */
export function castleTint(f: Facts, s: Structure): number {
  const found: { tower?: number; marble?: number } = {};
  const look = (c: CellKey): void => {
    if (c === NO_CELL) return;
    const k = f.kinds.get(c);
    if (k !== 'tower' && k !== 'marble') return;
    found[k] ??= f.world.blocks.get(c)?.color ?? 0;
  };
  for (const c of s.cells) for (const d of DIRS) look(neighbor(c, d));
  for (const e of s.edges) {
    edgeCells(e).forEach(look);
    for (const end of [0, 1] as const) if (edgeEndIsFree(f, e, end, 'wall')) cellsBeyond(e, end).forEach(look);
  }
  return (((found.tower ?? found.marble ?? 0) % 8) + 8) % 8;
}

export default defineRule<{ role: WallRole; tint: number }>({
  id: 'R-E02.wall-style',
  part: 'roles',
  tier: 1,
  priority: 3980,
  about: 'Reads: marble and towers beside a wall run, garden floors on or beside it. Claims: the run’s role. Tags a garden wall with creepers by seeded chance, and a curtain wall with the stone of the tower or marble it touches.',
  find({ facts }) {
    const out: Candidate<{ role: WallRole; tint: number }>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'wall') continue;
      const role = wallRoleOf(facts, s);
      out.push({ anchor: s.cells[0] ?? s.edges[0]! >> 1, structure: s.id, data: { role, tint: role === 'curtain-wall' ? castleTint(facts, s) : 0 } });
    }
    return out;
  },
  apply(c, out, { rand }) {
    out.role(c.structure!, c.data.role);
    if (c.data.role === 'garden-wall' && rand('creepers') < WALL.creepers) out.tag(c.structure!, 'creepers');
    if (c.data.role === 'curtain-wall') out.tag(c.structure!, `stone:${c.data.tint}` as Tag);
  },
});
