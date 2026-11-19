// Clearways: where a prop must never stand. Every decoration and urban rule
// that puts something on a floor slot asks this first, so dressing never
// blocks a door, a stair, a gate or the walking line of a path.
//
// A cell has nine floor slots (centre, four edges, four corners). A slot is
// kept clear when it lies on a line people walk:
//
//   a path cell            its centre, and the edge toward each cell the
//                          path runs on to (corners stay free: that is where
//                          lamps and bollards stand)
//   in front of a door     the centre, the whole door side (edge and both
//                          corners) and the edge straight ahead
//   a trail cell (J08)     the centre and both edges along the trail
//   foot or head of stairs the centre and the edge toward the flight
//   a gate, carved steps,  the centre and the edge toward it
//   broad steps, a ramp
//   where a trail meets a  the edge of the floor cell it arrives on
//   floor
//   a retaining wall (U07) the edge it stands on and both corners beside it
//
// Reads the finished shape plan (features), so it serves dressing-stage
// rules only.

import { above, DIR4_NAMES, edgeCells, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { slot } from '@/resolve/engine/api';
import { defineFact, type Facts } from '@/resolve/facts/api';
import { DIRS, standable } from '@/resolve/facts/lib';
import { BULKY, occupancy } from '@/resolve/facts/occupancy.fact';
import { streets } from '@/resolve/facts/streets.fact';
import type { CellPos } from '@/resolve/plan';
import { bankWalls } from '../urban/bank-walls.fact';

export const POSITIONS: readonly CellPos[] = ['c', 'n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'];
const BIT: Record<CellPos, number> = { c: 1, n: 2, e: 4, s: 8, w: 16, ne: 32, se: 64, sw: 128, nw: 256 };

/** The edge slot on side `d` of a cell. */
export const edgePos = (d: Dir4): CellPos => DIR4_NAMES[d] as CellPos;
/** The corner slot between two neighbouring sides. */
export function cornerPos(a: Dir4, b: Dir4): CellPos {
  const ns = a === 0 || b === 0 ? 'n' : 's';
  const ew = a === 1 || b === 1 ? 'e' : 'w';
  return `${ns}${ew}` as CellPos;
}
/** The two sides a corner slot lies between, [north or south, east or west]. */
export function cornerSides(pos: CellPos): readonly [Dir4, Dir4] | null {
  if (pos.length !== 2) return null;
  return [pos[0] === 'n' ? 0 : 2, pos[1] === 'e' ? 1 : 3];
}
/** The corner slots on side `d` of a cell. */
export function cornersOn(d: Dir4): readonly [CellPos, CellPos] {
  return d === 0 ? ['nw', 'ne'] : d === 2 ? ['sw', 'se'] : d === 1 ? ['ne', 'se'] : ['nw', 'sw'];
}

export interface Clearways {
  /** True if a prop may stand on this floor slot: the cell is standable and empty, and the slot is on nobody's way and not taken by the shape stage. */
  free(cell: CellKey, pos: CellPos): boolean;
  /** True if the slot lies on a walking line (whatever else is true of the cell). */
  walked(cell: CellKey, pos: CellPos): boolean;
  /** False under an awning or a hanging sign: no room there for anything tall (a lamp, a flagpole, a tree). */
  headroom(cell: CellKey, pos: CellPos): boolean;
  /** True if a building block stands right beside this slot (the neighbour on its side, or on either side of a corner). */
  againstWall(cell: CellKey, pos: CellPos): boolean;
  /** Cells right outside a door, with the side of that cell the door is on. */
  doorFronts: ReadonlyMap<CellKey, readonly Dir4[]>;
  /** Cells at the foot or head of a stair flight, steps or ramp, with the side the flight is on. */
  stairEnds: ReadonlyMap<CellKey, readonly Dir4[]>;
}

/** The standable cell at or below `cell` (a door with a stoop opens onto ground a little lower). */
function landing(f: Facts, cell: CellKey): CellKey {
  let c = cell;
  for (let k = 0; k < 3 && c >= 0; k++) {
    if (standable(f, c)) return c;
    c -= 1 << 12;
  }
  return cell;
}

export const clearways = defineFact<Clearways>('clearways', (f) => {
  const occ = occupancy(f);
  const blocked = new Map<CellKey, number>();
  const block = (cell: CellKey, ...pos: CellPos[]): void => {
    if (cell === NO_CELL || cell < 0) return;
    let m = blocked.get(cell) ?? 0;
    for (const p of pos) m |= BIT[p];
    blocked.set(cell, m);
  };
  const doorFronts = new Map<CellKey, Dir4[]>();
  const stairEnds = new Map<CellKey, Dir4[]>();
  const note = (m: Map<CellKey, Dir4[]>, cell: CellKey, d: Dir4): void => {
    const list = m.get(cell);
    if (list) {
      if (!list.includes(d)) list.push(d);
    } else m.set(cell, [d]);
  };

  // Paths: the centre line, out to each neighbour the path runs on to.
  for (const street of streets(f).list) {
    for (const cell of street.cells) {
      block(cell, 'c');
      for (const l of street.links.get(cell) ?? []) block(cell, edgePos(l.dir));
    }
  }

  const shape = f.shape;
  for (const ft of shape.features) {
    switch (ft.type) {
      case 'door': {
        if (ft.cell === undefined || ft.dir === undefined) break;
        const out = neighbor(ft.cell, ft.dir as Dir4);
        if (out === NO_CELL) break;
        const front = landing(f, out);
        const side = opposite(ft.dir as Dir4);
        block(front, 'c', edgePos(side), ...cornersOn(side), edgePos(ft.dir as Dir4));
        note(doorFronts, front, side);
        break;
      }
      case 'trail': {
        if (ft.cell === undefined) break;
        block(ft.cell, 'c');
        if (ft.dir !== undefined) {
          const d = ft.dir as Dir4;
          block(ft.cell, edgePos(d), edgePos(opposite(d)));
          // Where the trail arrives on a floor, people step onto it through that side.
          const on = neighbor(ft.cell, d);
          if (on !== NO_CELL && f.world.floors.has(on)) block(on, 'c', edgePos(opposite(d)));
        }
        break;
      }
      case 'floor-link': {
        // A path meeting a plaza, a garden, a stair, a door or a deck: the way runs through that side.
        if (ft.cell !== undefined && ft.dir !== undefined) block(ft.cell, 'c', edgePos(ft.dir as Dir4));
        break;
      }
      case 'gate': {
        if (ft.edge !== undefined) {
          const [a, b] = edgeCells(ft.edge);
          const side: Dir4 = ft.edge % 2 === 0 ? 1 : 2;
          block(a, 'c', edgePos(side));
          block(b, 'c', edgePos(opposite(side)));
        } else if (ft.cell !== undefined) {
          for (const d of DIRS) {
            const n = neighbor(ft.cell, d);
            if (n !== NO_CELL) block(n, 'c', edgePos(opposite(d)));
          }
        }
        break;
      }
      case 'terrain-steps':
      case 'broad-steps':
      case 'ramp':
      case 'quay-stair': {
        if (ft.cell === undefined || ft.dir === undefined) break;
        const d = ft.dir as Dir4;
        block(ft.cell, 'c', edgePos(d));
        const out = neighbor(ft.cell, d);
        if (out === NO_CELL) break;
        // The cell the steps arrive in, on either level.
        for (const c of [out, above(out), landing(f, out)]) {
          if (c === NO_CELL) continue;
          block(c, 'c', edgePos(opposite(d)));
          note(stairEnds, c, opposite(d));
        }
        break;
      }
      default:
        break;
    }
  }

  // Stairs blocks: the foot (low side) and the head (one level up, on the high side).
  for (const [cell, kind] of f.kinds) {
    if (kind !== 'stairs') continue;
    const rot = ((f.world.blocks.get(cell)?.rot ?? 0) & 3) as Dir4;
    const foot = neighbor(cell, opposite(rot));
    if (foot !== NO_CELL && f.kinds.get(foot) !== 'stairs') {
      block(foot, 'c', edgePos(rot), edgePos(opposite(rot)));
      note(stairEnds, foot, rot);
    }
    const up = above(cell);
    const head = up === NO_CELL ? NO_CELL : neighbor(up, rot);
    if (head !== NO_CELL && f.kinds.get(head) !== 'stairs') {
      block(head, 'c', edgePos(opposite(rot)), edgePos(rot));
      note(stairEnds, head, opposite(rot));
    }
  }

  // Retaining walls stand on the foot of a bank: nothing else may.
  const reserved = new Map<CellKey, number>();
  for (const w of bankWalls(f).list) {
    reserved.set(w.low, (reserved.get(w.low) ?? 0) | BIT[edgePos(w.dir)] | BIT[cornersOn(w.dir)[0]] | BIT[cornersOn(w.dir)[1]]);
  }

  // Awnings and hanging signs reach out over the cell in front of their wall.
  const low = new Map<CellKey, number>();
  for (const s of shape.sockets) {
    if ((s.type !== 'awning-mount' && s.type !== 'sign-bracket') || s.dir === undefined) continue;
    const out = neighbor(s.cell, s.dir);
    if (out === NO_CELL) continue;
    const side = opposite(s.dir);
    const mask = BIT[edgePos(side)] | BIT[cornersOn(side)[0]] | BIT[cornersOn(side)[1]];
    for (const c of [out, landing(f, out)]) low.set(c, (low.get(c) ?? 0) | mask);
  }

  const walked = (cell: CellKey, pos: CellPos): boolean => ((blocked.get(cell) ?? 0) & BIT[pos]) !== 0;
  const claims = shape.claims;
  return {
    walked,
    headroom: (cell, pos) => ((low.get(cell) ?? 0) & BIT[pos]) === 0,
    againstWall(cell, pos) {
      const sides: readonly Dir4[] = pos === 'c' ? [] : (cornerSides(pos) ?? [DIR4_NAMES.indexOf(pos as 'n') as Dir4]);
      return sides.some((d) => {
        const n = neighbor(cell, d);
        return n !== NO_CELL && (occ.flags[n]! & BULKY) !== 0 && occ.kind[n] !== 0;
      });
    },
    doorFronts,
    stairEnds,
    free(cell, pos) {
      if (cell === NO_CELL || cell < 0) return false;
      if (f.kinds.has(cell) || !standable(f, cell)) return false;
      if (walked(cell, pos) || (reserved.get(cell) ?? 0) & BIT[pos]) return false;
      return !claims.has(slot.floor(cell, pos));
    },
  };
});
