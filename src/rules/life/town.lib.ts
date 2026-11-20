// Shared by the living-town rules (L51 and up): where a chain's posts stand.
// Not a rule file.

import { neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import type { RuleContext } from '@/resolve/engine/api';
import { plazas } from '@/resolve/facts/plazas.fact';
import { streets } from '@/resolve/facts/streets.fact';
import { usableDoors } from '@/resolve/nav';
import type { NavGraph, StructureId } from '@/resolve/plan';
import { steps } from './people.lib';

/** A post: the walking-graph cell to stand in, and the way to face there (toward the thing). */
export interface Place {
  cell: CellKey;
  dir: Dir4;
  structure: StructureId;
}

/** Outside a building's door, facing it. Null if it has no door onto the graph. */
export function doorPlace(nav: NavGraph, structure: StructureId): Place | null {
  const d = usableDoors(nav, structure).find((x) => x.dir !== undefined);
  if (!d) return null;
  // The door opens toward `dir`; whoever stands outside faces back the other way.
  return { cell: nav.nodes[d.node]!.cell, dir: opposite(d.dir!), structure };
}

/** In front of a stall's counter, facing it. Null if that cell is not walkable or the stall has no front. */
export function stallPlace(ctx: RuleContext, nav: NavGraph, structure: StructureId): Place | null {
  const s = ctx.facts.structures.get(structure);
  const tags = ctx.plan.tags.get(structure);
  if (!s) return null;
  const front = (['front:n', 'front:e', 'front:s', 'front:w'] as const).findIndex((t) => tags?.has(t));
  if (front < 0) return null;
  const cell = neighbor(s.cells[0]!, front as Dir4);
  if (cell === NO_CELL || !nav.nodeAt.has(cell)) return null;
  return { cell, dir: opposite(front as Dir4), structure };
}

/** Beside a fountain, well or basin, facing it: every walkable cell next to it (at most `n`, seeded order kept stable). */
export function besidePlaces(nav: NavGraph, cells: readonly CellKey[], structure: StructureId, n: number): Place[] {
  const out: Place[] = [];
  for (const c of cells) {
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const at = neighbor(c, d);
      if (at === NO_CELL || !nav.nodeAt.has(at) || cells.includes(at) || out.some((o) => o.cell === at)) continue;
      out.push({ cell: at, dir: opposite(d), structure });
    }
  }
  out.sort((a, b) => a.cell - b.cell);
  return out.slice(0, n);
}

/** The town's heart: the middle of its biggest square, else of its longest street; null if it has neither. */
export function heartOf(ctx: RuleContext): CellKey | null {
  const square = [...plazas(ctx.facts).list].sort((a, b) => b.area - a.area || a.id - b.id)[0];
  if (square) return square.cells[square.cells.length >> 1]!;
  const street = [...streets(ctx.facts).list].sort((a, b) => b.length - a.length || a.id - b.id)[0];
  return street ? street.cells[street.cells.length >> 1]! : null;
}

/** Same part of the walking graph (one can walk from one to the other). */
export function joined(nav: NavGraph, a: CellKey, b: CellKey): boolean {
  const na = nav.nodeAt.get(a), nb = nav.nodeAt.get(b);
  return na !== undefined && nb !== undefined && nav.part[na] === nav.part[nb];
}

/** Sorts by distance from a cell, ties by cell key. */
export function byNearness<T extends { cell: CellKey }>(from: CellKey, list: T[]): T[] {
  return list.sort((a, b) => steps(a.cell, from) - steps(b.cell, from) || a.cell - b.cell);
}

