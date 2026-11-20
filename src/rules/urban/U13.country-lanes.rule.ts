// U13 · tier 2 · Country lanes (discovery round 1, UF-04 and FX-04).
//
// Out of town a lane is not lit (D01 leaves the countryside fact's cells
// dark). Instead, along a run of four or more country cells:
//
//   a hedgerow down one side, on the grass verge, the same side all over the
//   town (a seeded hand: north or south of a lane running east–west, west or
//   east of one running north–south, falling back to the other side where
//   the verge is not free);
//   a field gate in the hedge every so often where the hedge runs on for
//   five pieces or more, and in any gap a player left in a fence along the
//   lane;
//   a stone milestone every eighth cell (a fixed lattice of the map) on the
//   other side of the lane.
//
// Must not: inside the town (the countryside fact: no building, square,
// stall or fountain within 3, no dock or arch within 2); on a verge that is
// a front garden, a field or another use (landUse), or that people walk
// across (a trail or a stair meets the lane there); against a placed fence
// or wall (it already bounds the lane). A rural junction is D36's.
//
// Stability: each piece depends on its lane cell, its verge and the cells
// along beside it; the lattice is fixed to the map, so extending a lane
// never moves a milestone.
//
// Reads: countryside, streets (links), wildGrass, landUse, clearways.
// Claims: the slot of each gate and milestone (hedges stand on the cell line
// and claim nothing).

import { keyX, keyY, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { wildGrass } from '@/resolve/facts/grass.fact';
import { streets } from '@/resolve/facts/streets.fact';
import { edgeBetween } from '@/resolve/facts/lib';
import { clearways, edgePos } from '../decoration/clearways.fact';
import { countryside } from './countryside.fact';
import { landUse } from './land-use.fact';
import { claimsOf, emit, placer, type Placed } from './plots';

const RULE = 'U13.country-lanes';
/** A milestone every this many cells. */
const MILE = 8;
/** A field gate breaks a hedge of this many pieces or more. */
const GATE_RUN = 5;
/** No two milestones nearer than this (two lanes' lattices can fall close by a crossing). */
const MILE_GAP = 5;

export default defineRule<Placed[]>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 870,
  about: 'Reads: countryside (lane cells with nothing built near), streets, wildGrass, landUse, clearways. Claims: the slots of its field gates and milestones; hedgerows claim nothing.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const grass = wildGrass(facts);
    const uses = landUse(facts);
    const country = countryside(facts);
    const hand = hash(seed, RULE, 'hand') % 2;
    const look = (k: string, c: CellKey, d = 0): number => hash(seed, RULE, k, c, d) % 1000;
    const out: Candidate<Placed[]>[] = [];

    // Helpers for a run: its links, the verge on a side, the hedge sides of a cell.
    const lane = (run: (typeof country.runs)[number]) => {
      const links = (c: CellKey): Dir4[] => (run.street.links.get(c) ?? []).map((l) => l.dir);
      // The verge on side d of a lane cell: level wild grass with no other use, no edge piece between.
      const verge = (c: CellKey, d: Dir4): CellKey => {
        if (links(c).includes(d) || edgeBetween(facts, c, d)) return NO_CELL;
        const n = neighbor(c, d);
        if (n === NO_CELL || !grass.has(n) || keyY(n) !== keyY(c) || uses.byCell.has(n)) return NO_CELL;
        if (clear.walked(n, edgePos(opposite(d)))) return NO_CELL;
        return n;
      };
      // The hedge side of each cell: the hand's side of each axis the lane runs along there.
      const sides = (c: CellKey): Dir4[] => {
        const ls = links(c);
        const out2: Dir4[] = [];
        const alongX = ls.includes(1) || ls.includes(3), alongZ = ls.includes(0) || ls.includes(2);
        if (alongX) out2.push(hand ? 0 : 2);
        if (alongZ) out2.push(hand ? 3 : 1);
        return out2;
      };
      return { links, verge, sides };
    };
    // First, every hedge in town (lane cell -> sides), so hedges of two lanes can meet at a corner.
    const hedged = new Map<CellKey, Dir4[]>();
    for (const run of country.runs) {
      const { links, verge, sides } = lane(run);
      for (const c of run.cells) {
        const want: Dir4[] = [];
        for (const d of sides(c)) {
          if (links(c).includes(d)) continue; // the inside of a bend: the lane itself turns that way
          if (verge(c, d) !== NO_CELL) want.push(d);
          else if (verge(c, opposite(d)) !== NO_CELL && !sides(c).includes(opposite(d))) want.push(opposite(d));
        }
        if (want.length) hedged.set(c, want);
      }
    }
    const isHedged = (c: CellKey, d: Dir4): boolean => c !== NO_CELL && (hedged.get(c)?.includes(d) ?? false);
    // Milestones keep apart: none within MILE_GAP of another, nor within 3 of a junction.
    const junctions: CellKey[] = streets(facts).list.flatMap((st) => [...st.junctions]);
    const miles: CellKey[] = [];
    const near = (a: CellKey, b: CellKey, k: number): boolean => Math.abs(keyX(a) - keyX(b)) + Math.abs(keyZ(a) - keyZ(b)) <= k;

    for (const run of country.runs) {
      const { links, verge } = lane(run);
      // A gap a player left in a fence along the lane: fenced on that side either side of it.
      const fenceGap = (c: CellKey, d: Dir4): boolean => {
        const a = neighbor(c, ((d + 1) % 4) as Dir4), b = neighbor(c, ((d + 3) % 4) as Dir4);
        return a !== NO_CELL && b !== NO_CELL && edgeBetween(facts, a, d) !== undefined && edgeBetween(facts, b, d) !== undefined;
      };

      const p = placer((c, pos) => clear.free(c, pos));
      for (const c of run.cells) {
        // Gaps in a placed fence take a gate whichever side they are on.
        for (const d of [0, 1, 2, 3] as Dir4[]) {
          const n = verge(c, d);
          if (n !== NO_CELL && fenceGap(c, d)) p.put({ type: 'field-gate', cell: n, pos: edgePos(opposite(d)), face: d, params: { open: (look('open', c, d) % 3 === 0 ? 1 : 0) as 0 | 1, look: look('gate', c, d) } });
        }
        for (const d of hedged.get(c) ?? []) {
          const n = verge(c, d);
          if (fenceGap(c, d)) continue;
          // How far the hedge runs on each way along the lane from here (for its ends and its gates).
          const minus = ((d + 3) % 4) as Dir4, plus = ((d + 1) % 4) as Dir4;
          const reach = (dir: Dir4): number => {
            let k = 0;
            for (let cur = neighbor(c, dir); cur !== NO_CELL && isHedged(cur, d) && k < GATE_RUN; cur = neighbor(cur, dir)) k++;
            return k;
          };
          const before = reach(minus), after = reach(plus);
          // A gate on a fixed lattice where the hedge runs on both ways: an opening into the field.
          const lattice = (keyX(c) * 3 + keyZ(c) * 5) % 11 === 0;
          if (lattice && before >= 2 && after >= 2) {
            p.put({ type: 'field-gate', cell: n, pos: edgePos(opposite(d)), face: d, params: { open: (look('open', c, d) % 3 === 0 ? 1 : 0) as 0 | 1, look: look('gate', c, d) } });
            continue;
          }
          // An end runs on if the next lane cell along is hedged on this side, or the hedge turns the corner here.
          // Or another lane's hedge meets it in the corner of the same verge cell (two lanes at a crossing).
          const end = (side: Dir4): number =>
            (isHedged(c, side) && side !== d) || isHedged(neighbor(c, side), d) || (n !== NO_CELL && isHedged(neighbor(n, side), opposite(side))) ? 0 : 1;
          // The frame faces away from the lane (+Z into the verge); its +X runs to the (face + 3) side.
          const face = d;
          const right = ((face + 3) % 4) as Dir4, left = ((face + 1) % 4) as Dir4;
          p.put({ type: 'hedge', variant: 'wild', cell: n, pos: edgePos(opposite(d)), face, claim: false, params: { from: end(left), to: end(right), look: look('hedge', c, d), face } });
        }
        // A milestone on the lattice, on a straight stretch, on the side away from the hedge.
        const ls = links(c);
        const straight = ls.length === 2 && ls[0] === opposite(ls[1]!);
        if (straight && (keyX(c) + keyZ(c) * (MILE - 1)) % MILE === 0 && !miles.some((m) => near(m, c, MILE_GAP)) && !junctions.some((j) => near(j, c, 3))) {
          const open = ([0, 1, 2, 3] as Dir4[]).filter((d) => !ls.includes(d) && !isHedged(c, d));
          for (const d of open) {
            if (p.put({ type: 'milestone', cell: c, pos: edgePos(d), face: opposite(d), params: { look: look('mile', c) } })) {
              miles.push(c);
              break;
            }
          }
        }
      }
      if (p.items.length) out.push({ anchor: run.cells[0]!, data: p.items });
    }
    return out;
  },
  claims: (c) => claimsOf(c.data),
  apply: (c, out) => emit(out, c.data),
});

