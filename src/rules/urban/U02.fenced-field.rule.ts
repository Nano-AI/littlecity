// U02 · tier 2 · Paddock, park or walled garden.
//
// Six or more cells of grass fully enclosed by fences or walls the player
// placed are a field, and what it is depends on what is in it:
//
//   3+ trees inside        a park: benches along the fence looking in, a
//                          worn loop track under the trees, a flowering
//                          shrub in a corner or two
//   enclosed by walls      a walled garden: flower borders and espalier
//                          fruit trees against the walls by turns, a round
//                          bed in the middle, a bench
//   otherwise              a paddock: two to four grazing animals (all
//                          sheep or all cows) and a drinking trough by the
//                          fence
//
// Which patches are fields, and of which kind, is the landUse fact's
// decision. The grazers stand still; an animal that wanders is Animation's
// (replace the 'grazer' prop with an actor on the same slot).
//
// Stability: seeded by the field's own cells.
//
// Reads: landUse.fields, clearways. Claims: the floor slot of everything it
// places.

import { keyX, keyZ, neighbor, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { DIRS } from '@/resolve/facts/lib';
import { clearways, cornerPos, edgePos } from '../decoration/clearways.fact';
import { landUse } from './land-use.fact';
import { claimsOf, emit, placer, plotOf, sidesWith, type Placed } from './plots';

const RULE = 'U02.fenced-field';

export default defineRule<Placed[]>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 980,
  about: 'Reads: landUse (fields: grass enclosed by placed fences or walls, the trees in them), clearways. Claims: the floor slots of its benches, tracks, beds, animals and trough.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<Placed[]>[] = [];
    for (const field of landUse(facts).fields) {
      const plot = plotOf(facts, field.cells, seed);
      const anchor = field.cells[0]!;
      const p = placer((c, pos) => clear.free(c, pos));
      const look = (k: string, c: CellKey): number => hash(seed, RULE, k, c) % 1000;
      const n = field.cells.length;
      // Cells along the boundary, with the side their fence or wall is on.
      const edge: [CellKey, Dir4][] = [];
      for (const c of plot.shuffled('edge')) {
        const d = sidesWith(plot, c, 'fence')[0];
        if (d !== undefined) edge.push([c, d]);
      }
      const bench = (count: number): void => {
        let done = 0;
        for (const [c, d] of edge) {
          if (done >= count) break;
          if (p.put({ type: 'bench', variant: 'wood', cell: c, pos: edgePos(d), face: opposite(d), seats: 2, params: { look: look('bench', c) } })) done++;
        }
      };

      if (field.kind === 'park') {
        // The loop: the ring of cells one in from the fence where the field is wide enough, else along it.
        const xs = field.cells.map(keyX), zs = field.cells.map(keyZ);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
        const inset = x1 - x0 >= 4 && z1 - z0 >= 4 ? 1 : 0;
        const ring = new Set(field.cells.filter((c) => Math.min(keyX(c) - x0, x1 - keyX(c), keyZ(c) - z0, z1 - keyZ(c)) === inset));
        if (ring.size >= 4 && x1 - x0 >= 2 && z1 - z0 >= 2) {
          for (const c of ring) {
            let mask = 0;
            for (const d of DIRS) if (ring.has(neighbor(c, d)) && plot.beyond(c, d) === 'in') mask |= 1 << d;
            if (mask) p.put({ type: 'worn-track', cell: c, pos: 'c', face: 2, params: { mask, look: look('track', c) } });
          }
        }
        bench(Math.max(1, Math.min(3, Math.floor(n / 8))));
        let shrubs = 0;
        for (const c of plot.shuffled('shrub')) {
          if (shrubs >= 2) break;
          const f = sidesWith(plot, c, 'fence');
          if (f.length >= 2 && f[0] !== opposite(f[1]!) && p.put({ type: 'shrub', variant: 'flowering', cell: c, pos: cornerPos(f[0]!, f[1]!), face: 2, params: { look: look('shrub', c) } })) shrubs++;
        }
      } else if (field.kind === 'walled-garden') {
        const flowers = hash(seed, RULE, 'flowers', anchor) % 5;
        bench(1);
        for (const c of field.cells) {
          for (const d of sidesWith(plot, c, 'fence')) {
            // Borders and espaliers by turns along each wall.
            if ((keyX(c) + keyZ(c) + d) % 2 === 0) p.put({ type: 'espalier', cell: c, pos: edgePos(d), face: opposite(d), params: { look: look('esp', c) + d, face: opposite(d) } });
            else p.put({ type: 'flower-bed', variant: 'border', cell: c, pos: edgePos(d), face: 2, params: { flowers, along: d === 0 || d === 2 ? 0 : 1, look: look('bed', c) + d } });
          }
        }
        // A round bed in the middle: the cell farthest from the walls.
        const inner = field.cells.filter((c) => sidesWith(plot, c, 'in').length === 4);
        const mid = (inner.length ? inner : field.cells)[Math.floor((inner.length ? inner.length : n) / 2)]!;
        p.put({ type: 'flower-bed', variant: 'round', cell: mid, pos: 'c', face: 2, params: { flowers: (flowers + 2) % 5, look: look('round', mid) } });
      } else {
        const variant = hash(seed, RULE, 'herd', anchor) % 3 === 0 ? 'cow' : 'sheep';
        const herd = Math.min(2 + (hash(seed, RULE, 'count', anchor) % 3), Math.max(2, Math.floor(n / 3)));
        let placed = 0;
        for (const c of plot.shuffled('herd')) {
          if (placed >= herd) break;
          if (p.put({ type: 'grazer', variant, cell: c, pos: 'c', params: { turn: hash(seed, RULE, 'turn', c) % 8, look: look('grazer', c) } })) placed++;
        }
        for (const [c, d] of edge) {
          if (p.put({ type: 'trough', cell: c, pos: edgePos(d), face: opposite(d) })) break;
        }
      }
      if (p.items.length) out.push({ anchor, data: p.items });
    }
    return out;
  },
  claims: (c) => claimsOf(c.data),
  apply: (c, out) => emit(out, c.data),
});
