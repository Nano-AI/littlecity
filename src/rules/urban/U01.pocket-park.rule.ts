// U01 · tier 2 · Pocket park.
//
// A leftover patch of grass (2 to DRESSING.parkMax cells, shut in by
// streets, houses, fences, cliffs or water) that touches a street or a
// square is nobody's garden, so the town makes it a little park:
//
//   a low clipped hedge along every side that faces the street or square,
//   with one way in;
//   a bench with its back to a house wall if there is one (else in the
//   middle of a cell with its back to the hedge), looking into the park;
//   a round flower bed, and from three cells up a shrub or two in the back
//   corners; a second bench and bed from eight cells.
//
// Which patches are pocket parks is the landUse fact's decision.
//
// Stability: everything is seeded by the patch's own cells; a patch changes
// only when its own outline does.
//
// Reads: landUse.pocketParks, clearways. Claims: the floor slot of each
// bench, bed and shrub (hedges stand on the cell line and claim nothing).

import { neighbor, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { DIRS } from '@/resolve/facts/lib';
import { clearways, cornerPos, edgePos } from '../decoration/clearways.fact';
import { landUse } from './land-use.fact';
import { claimsOf, emit, placer, plotOf, sidesWith, type Placed } from './plots';

const RULE = 'U01.pocket-park';

export default defineRule<Placed[]>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 990,
  about: 'Reads: landUse (pocket parks: leftovers touching a street or plaza), clearways. Claims: the floor slots of its bench, beds and shrubs.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<Placed[]>[] = [];
    for (const park of landUse(facts).pocketParks) {
      const plot = plotOf(facts, park.cells, seed);
      const anchor = park.cells[0]!;
      const p = placer((c, pos) => clear.free(c, pos));
      const look = (k: string, c: CellKey): number => hash(seed, RULE, k, c) % 1000;

      // The hedge: every street side, less one way in.
      const hedged: [CellKey, Dir4][] = [];
      for (const c of park.cells) for (const d of sidesWith(plot, c, 'street')) hedged.push([c, d]);
      const isHedged = (c: CellKey, d: Dir4): boolean => hedged.some(([hc, hd]) => hc === c && hd === d);
      const gate = hedged.length ? hedged[hash(seed, RULE, 'gate', anchor) % hedged.length]! : null;
      for (const [c, d] of hedged) {
        const minus = ((d + 3) % 4) as Dir4, plus = ((d + 1) % 4) as Dir4;
        // An end runs on if the next cell along is hedged too, or the hedge turns the corner of this cell.
        const end = (side: Dir4): number => {
          if (isHedged(c, side)) return 0;
          if (plot.beyond(c, side) !== 'in') return 1;
          return isHedged(neighbor(c, side), d) ? 0 : 1;
        };
        p.put({ type: 'hedge', variant: gate && gate[0] === c && gate[1] === d ? 'gap' : 'run', cell: c, pos: edgePos(d), face: opposite(d), claim: false, params: { from: end(minus), to: end(plus), look: look('hedge', c) + d } });
      }

      // Benches: against a wall, else in the open with their back to the street.
      const benches = park.cells.length >= 8 ? 2 : 1;
      let seated = 0;
      const benchCells = new Set<CellKey>();
      for (const c of plot.shuffled('bench')) {
        if (seated >= benches) break;
        const walls = sidesWith(plot, c, 'wall');
        const streets = sidesWith(plot, c, 'street');
        const ok = walls.length
          ? p.put({ type: 'bench', variant: 'wood', cell: c, pos: edgePos(walls[0]!), face: opposite(walls[0]!), seats: 2, params: { look: look('bench', c) } })
          : streets.length && park.cells.length <= 3
            ? p.put({ type: 'bench', variant: 'wood', cell: c, pos: 'c', face: opposite(streets[0]!), seats: 2, params: { look: look('bench', c) } })
            : false;
        if (ok) {
          seated++;
          benchCells.add(c);
        }
      }
      // No wall and a bigger patch: one bench in the middle of a cell, looking at the way in.
      if (!seated) {
        const c = plot.shuffled('bench2')[0]!;
        const face = gate ? gate[1] : DIRS[hash(seed, RULE, 'face', c) % 4]!;
        if (p.put({ type: 'bench', variant: 'wood', cell: c, pos: 'c', face, seats: 2, params: { look: look('bench', c) } })) benchCells.add(c);
      }

      // Beds in the middle of other cells; shrubs in corners away from the street.
      const beds = park.cells.length >= 8 ? 2 : 1;
      let bedded = 0;
      for (const c of plot.shuffled('bed')) {
        if (bedded >= beds) break;
        if (benchCells.has(c) && park.cells.length > 2) continue;
        if (p.put({ type: 'flower-bed', variant: 'round', cell: c, pos: 'c', face: 2, params: { flowers: hash(seed, RULE, 'flowers', anchor) % 5, look: look('bed', c) } })) bedded++;
      }
      const shrubs = park.cells.length >= 3 ? Math.min(3, Math.floor(park.cells.length / 3)) : 0;
      let planted = 0;
      for (const c of plot.shuffled('shrub')) {
        if (planted >= shrubs) break;
        for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]] as [Dir4, Dir4][]) {
          const ba = plot.beyond(c, a), bb = plot.beyond(c, b);
          if (ba === 'in' || bb === 'in' || ba === 'street' || bb === 'street') continue;
          if (p.put({ type: 'shrub', variant: hash(seed, RULE, 'kind', c) % 3 === 0 ? 'flowering' : 'round', cell: c, pos: cornerPos(a, b), face: 2, params: { look: look('shrub', c) } })) {
            planted++;
            break;
          }
        }
      }
      if (p.items.length) out.push({ anchor, data: p.items });
    }
    return out;
  },
  claims: (c) => claimsOf(c.data),
  apply: (c, out) => emit(out, c.data),
});
