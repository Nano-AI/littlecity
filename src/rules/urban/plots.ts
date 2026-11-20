// Shared by the urban-fill rules: a patch of ground cells looked at side by
// side (what lies beyond each side of each cell), and a small list of props
// to place that a rule builds in find() and emits in apply().

import { neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import type { PropType } from '@/core/vocab';
import { slot, type RuleOut } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { DIRS, edgeBetween } from '@/resolve/facts/lib';
import { BULKY, occupancy } from '@/resolve/facts/occupancy.fact';
import type { CellPos, Slot } from '@/resolve/plan';

/** What lies beyond one side of a patch cell. */
export type Beyond = 'in' | 'street' | 'wall' | 'fence' | 'other';

export interface Plot {
  cells: readonly CellKey[];
  has(cell: CellKey): boolean;
  /** What is beyond side `d` of a cell of the patch. */
  beyond(cell: CellKey, d: Dir4): Beyond;
  /** The patch's cells in a seeded order that does not depend on anything outside it. */
  shuffled(salt: string): CellKey[];
}

export function plotOf(f: Facts, cells: readonly CellKey[], seed: number): Plot {
  const set = new Set(cells);
  const occ = occupancy(f);
  const beyond = (cell: CellKey, d: Dir4): Beyond => {
    const n = neighbor(cell, d);
    if (n !== NO_CELL && set.has(n) && !edgeBetween(f, cell, d)) return 'in';
    if (edgeBetween(f, cell, d)) return 'fence';
    if (n === NO_CELL) return 'other';
    const k = occ.kindAt(n);
    if (k === 'fence' || k === 'wall') return 'fence';
    if (k && occ.flags[n]! & BULKY) return 'wall';
    const floor = f.world.floors.get(n);
    if (!k && (floor === 'path' || floor === 'plaza')) return 'street';
    return 'other';
  };
  return {
    cells,
    has: (c) => set.has(c),
    beyond,
    shuffled: (salt) => [...cells].sort((a, b) => hash(seed, salt, a) - hash(seed, salt, b) || a - b),
  };
}

/** The sides of a cell that have `what` beyond them. */
export function sidesWith(plot: Plot, cell: CellKey, what: Beyond): Dir4[] {
  return DIRS.filter((d) => plot.beyond(cell, d) === what);
}

/** One prop a rule has decided to place on a floor slot. */
export interface Placed {
  type: PropType;
  variant?: string;
  cell: CellKey;
  pos: CellPos;
  face?: Dir4;
  params?: Record<string, number>;
  /** False for a piece that stands on the cell line and shares its slot with what is inside (a hedge, a fence). */
  claim?: boolean;
  /** Seat sockets to declare on it (benches). */
  seats?: number;
  /**
   * Activity sockets to declare on it (docs/swarm/requests/disc1-fill.md): each name is both the
   * socket's `name` (what a person does there) and the anchor the prop's part supplies its frame by.
   */
  activities?: readonly string[];
}

export function claimsOf(items: readonly Placed[]): Slot[] {
  return [...new Set(items.filter((i) => i.claim !== false).map((i) => slot.floor(i.cell, i.pos)))];
}

/** Emits the props (and their seat and activity sockets); returns their ids, in order. */
export function emit(out: RuleOut, items: readonly Placed[]): string[] {
  const ids: string[] = [];
  for (const i of items) {
    const at = i.face === undefined ? { cell: i.cell, pos: i.pos } : { cell: i.cell, pos: i.pos, face: i.face };
    // The list is built from typed literals in each rule; here it is emitted as loose records.
    const id = (out.prop as (p: object) => string)({ type: i.type, variant: i.variant, at, params: i.params });
    for (let s = 0; s < (i.seats ?? 0); s++) out.socket({ type: 'seat', owner: id, name: `seat-${s}`, cell: i.cell, dir: i.face });
    for (const name of i.activities ?? []) out.socket({ type: 'activity', owner: id, name, cell: i.cell, dir: i.face });
    ids.push(id);
  }
  return ids;
}

/** A list of placements that refuses a slot twice and anything a clearway forbids. */
export function placer(free: (cell: CellKey, pos: CellPos) => boolean): { items: Placed[]; put(p: Placed): boolean; taken(cell: CellKey, pos: CellPos): boolean } {
  const items: Placed[] = [];
  const used = new Set<string>();
  return {
    items,
    taken: (cell, pos) => used.has(`${cell}:${pos}`),
    put(p) {
      const k = `${p.cell}:${p.pos}`;
      if (p.claim !== false) {
        if (used.has(k) || !free(p.cell, p.pos)) return false;
        used.add(k);
      }
      items.push(p);
      return true;
    },
  };
}
