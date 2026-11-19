// Town edge: the street dead ends that fray into a dirt trail (U06). A fact
// because D01, which runs earlier, must not stand the dead end's lamp in the
// mouth of the trail.
//
// A dead end frays when the two or three ground cells straight ahead of it
// are wild grass at the street's own level, with no use of their own (not a
// garden, a yard, a park or a field) and nothing claimed on them.

import { neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { slot } from '@/resolve/engine/api';
import { defineFact } from '@/resolve/facts/api';
import { wildGrass } from '@/resolve/facts/grass.fact';
import { leftovers } from '@/resolve/facts/leftovers.fact';
import { edgeBetween } from '@/resolve/facts/lib';
import { streets } from '@/resolve/facts/streets.fact';
import { onGround } from '../decoration/lib';
import { landUse } from './land-use.fact';

export interface FrayedEnd {
  /** The street's last cell. */
  end: CellKey;
  /** The way the trail runs on. */
  dir: Dir4;
  /** The grass cells it crosses, nearest first. */
  cells: readonly CellKey[];
}

export interface TownEdge {
  list: readonly FrayedEnd[];
  byEnd: ReadonlyMap<CellKey, FrayedEnd>;
}

export const townEdge = defineFact<TownEdge>('townEdge', (f) => {
  const grass = wildGrass(f);
  const uses = landUse(f);
  const left = leftovers(f);
  const claims = f.shape.claims;
  const list: FrayedEnd[] = [];
  for (const street of streets(f).list) {
    if (street.length < 3) continue;
    for (const end of street.deadEnds) {
      const links = street.links.get(end) ?? [];
      if (links.length !== 1 || !onGround(f, end)) continue;
      const dir = opposite(links[0]!.dir);
      const want = 2 + (hash(f.seed, 'town-edge', end) % 2);
      const cells: CellKey[] = [];
      let c = end;
      for (let k = 0; k < 3; k++) {
        if (edgeBetween(f, c, dir)) break;
        c = neighbor(c, dir);
        if (c === NO_CELL || !grass.has(c) || uses.byCell.has(c) || left.byCell.has(c) || claims.has(slot.floor(c, 'c'))) break;
        cells.push(c);
      }
      // "Facing wild grass": three clear cells ahead, of which the trail takes two or three.
      if (cells.length === 3) list.push({ end, dir, cells: cells.slice(0, want) });
    }
  }
  return { list, byEnd: new Map(list.map((e) => [e.end, e])) };
});
