// D01 · tier 1 · Street lamps.
//
// A street of DRESSING.lampStreet cells or more is lit: a lamp at each
// junction and each dead end, then one every `lampEvery` cells along the
// rest, on alternating sides, on the edge of the path and away from doors.
// Only on the ground: a path over a bridge or along a pier is lit by D20.
// Only in town: a street cell with no building, square, stall or fountain
// within a few cells (the countryside fact) stays dark; U13 gives the lane
// hedgerows and milestones instead.
//
// Stability. Lamps along a street are NOT counted from one of its ends (a
// street grown by one cell would then shuffle every lamp on it). They stand
// on a fixed lattice of the map, the cells where (x + (n − 1) · z) mod n is
// 0, so a lamp depends only on the few path cells round it: extending the
// street, or building anywhere else, never moves it.
//
// Reads: streets, clearways (doors, stairs, awnings, retaining walls), townEdge, countryside.
// Claims: the floor slot the lamp stands on, and one lamp per cell.

import { keyX, keyZ, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { DIRS } from '@/resolve/facts/lib';
import { streets, type Street } from '@/resolve/facts/streets.fact';
import type { CellPos } from '@/resolve/plan';
import { DRESSING } from '@/style/dressing';
import { clearways, cornerPos, edgePos, type Clearways } from './clearways.fact';
import { countryside } from '../urban/countryside.fact';
import { townEdge } from '../urban/town-edge.fact';
import { onGround } from './lib';
import { streetEnds } from './street-ends.fact';

type Spot = 'junction' | 'end' | 'run';

/** Path cells within `steps` of `from` along the street (including `from`). */
function near(street: Street, from: CellKey, steps: number): CellKey[] {
  const seen = new Set<CellKey>([from]);
  let frontier = [from];
  for (let k = 0; k < steps; k++) {
    const next: CellKey[] = [];
    for (const c of frontier) {
      for (const l of street.links.get(c) ?? []) {
        if (!seen.has(l.cell)) {
          seen.add(l.cell);
          next.push(l.cell);
        }
      }
    }
    frontier = next;
  }
  return [...seen];
}

/** The cells of a street that get a lamp, with why. Ascending by cell. */
export function lampCells(street: Street, clear: Clearways): Map<CellKey, Spot> {
  const every = Math.max(2, Math.round(DRESSING.lampEvery));
  const gap = Math.max(0, Math.round(DRESSING.lampGap));
  const chosen = new Map<CellKey, Spot>();
  const tooClose = (c: CellKey, steps: number): boolean => near(street, c, steps).some((n) => chosen.has(n));
  // The ways out of a cell: path neighbours, and a plaza, door, stair or deck the path runs on to.
  const ways = (c: CellKey): number => DIRS.filter((d) => clear.walked(c, edgePos(d))).length;
  // Junctions first, then dead ends, then the lattice; each keeps its distance from what is already there.
  for (const c of street.junctions) if (!tooClose(c, gap)) chosen.set(c, 'junction');
  for (const c of street.deadEnds) if (ways(c) <= 1 && !tooClose(c, gap)) chosen.set(c, 'end');
  // The lattice, then the half-way lattice wherever that left a long dark stretch
  // (a lattice lamp that fell beside a junction lamp was dropped).
  for (const [phase, clear2] of [[0, Math.max(gap, 1)], [Math.floor(every / 2), Math.max(gap, 1) + 1]] as const) {
    for (const c of street.cells) {
      const links = street.links.get(c)?.length ?? 0;
      if (links !== 2 || chosen.has(c)) continue;
      if ((keyX(c) + (every - 1) * keyZ(c)) % every !== phase) continue;
      if (!tooClose(c, clear2)) chosen.set(c, 'run');
    }
  }
  return new Map([...chosen].sort((a, b) => a[0] - b[0]));
}

/** The floor slots a lamp could take in its cell, best first. */
export function lampSlots(street: Street, cell: CellKey, spot: Spot): CellPos[] {
  const linked = new Set((street.links.get(cell) ?? []).map((l) => l.dir));
  const open = DIRS.filter((d) => !linked.has(d));
  const x = keyX(cell), z = keyZ(cell);
  const every = Math.max(2, Math.round(DRESSING.lampEvery));
  const flip = (Math.floor((x + (every - 1) * z) / every) & 1) === 1;
  const corners = (from: number): CellPos[] => {
    const all: CellPos[] = ['ne', 'se', 'sw', 'nw'];
    return [0, 1, 2, 3].map((i) => all[(i + from) % 4]!);
  };
  if (spot === 'junction') {
    // At the head of a T the lamp looks down the stem; at a crossing it takes a corner.
    return [...open.map(edgePos), ...corners((x * 7 + z * 13) % 4)];
  }
  if (spot === 'end') {
    const from = [...linked][0];
    if (from === undefined) return [];
    const ahead = opposite(from);
    const left = ((ahead + 3) % 4) as Dir4, right = ((ahead + 1) % 4) as Dir4;
    const sides = flip ? [right, left] : [left, right];
    return [edgePos(ahead), ...sides.map(edgePos), cornerPos(ahead, sides[0]!), cornerPos(ahead, sides[1]!)];
  }
  if (open.length === 2 && open[0] === opposite(open[1]!)) {
    // A straight run: alternate sides along it.
    // Where a door opens onto the cell both edges are its way out: a corner of the far side will do.
    const [a, b] = flip ? [open[1]!, open[0]!] : [open[0]!, open[1]!];
    const along = [...linked] as Dir4[];
    return [edgePos(a), edgePos(b), ...along.map((d) => cornerPos(a, d)), ...along.map((d) => cornerPos(b, d))];
  }
  if (open.length === 2) {
    // A bend: the outside of the corner, else one of its flanks.
    return [cornerPos(open[0]!, open[1]!), edgePos(open[0]!), edgePos(open[1]!)];
  }
  return open.map(edgePos);
}

export default defineRule<{ pos: CellPos }>({
  id: 'D01.street-lamps',
  part: 'decoration',
  tier: 1,
  priority: 990,
  about: 'Reads: streets (junctions, dead ends, links), clearways, countryside (no lamps out in the country). Claims: the floor slot of each lamp, one lamp per cell.',
  find({ facts }) {
    const clear = clearways(facts);
    const edge = townEdge(facts);
    const views = streetEnds(facts).views;
    const country = countryside(facts);
    const out: Candidate<{ pos: CellPos }>[] = [];
    for (const street of streets(facts).list) {
      if (street.length < DRESSING.lampStreet) continue;
      for (const [cell, spot] of lampCells(street, clear)) {
        // Street lamps stand on the ground. A bridge has its own lamps (D20), a pier its harbour lamp.
        if (!onGround(facts, cell)) continue;
        // Out in the country, with nothing built facing the street, a lane is not lit (U13 dresses it).
        if (country.isCountry(cell)) continue;
        // One candidate per slot it could take, best first; the first whose slot is free wins the cell.
        // A slot out in the open beats one tucked under a house's eaves.
        // Where the street frays into a trail (U06) the lamp keeps to the side: the way ahead stays open.
        // The same where a bench will look out from the end of the street (D03).
        const ahead = edge.byEnd.get(cell)?.dir ?? views.get(cell);
        const slots = lampSlots(street, cell, spot).filter((pos) => clear.free(cell, pos) && clear.headroom(cell, pos) && !(ahead !== undefined && pos.includes('nesw'[ahead]!)));
        for (const pos of [...slots.filter((p) => !clear.againstWall(cell, p)), ...slots.filter((p) => clear.againstWall(cell, p))]) {
          out.push({ anchor: cell, key: pos, data: { pos } });
        }
      }
    }
    return out;
  },
  claims: (c) => [slot.floor(c.anchor, c.data.pos), slot.custom('D01', c.anchor)],
  apply(c, out, { rand }) {
    const lamp = out.prop({ type: 'lamp', variant: 'post', at: { cell: c.anchor, pos: c.data.pos }, params: { look: Math.floor(rand('look') * 1000) } });
    out.socket({ type: 'lamp-head', owner: lamp, cell: c.anchor });
  },
});
