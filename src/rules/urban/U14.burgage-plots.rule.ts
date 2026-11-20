// U14 · tier 2 · Burgage plots (discovery round 1, UF-01).
//
// Fenced land behind a row of houses is their back gardens: one long plot
// per house, running from the back wall out to the far fence, the oldest
// pattern in European towns. The landUse fact decides which land this is:
// more than DRESSING.yardMax cells of grass, shut in by placed fences or
// walls and the backs (sides with no main door) of two or more houses on one
// side. Smaller patches are U04's back yards; land with three or more trees
// is U02's park; land with no house against it is U02's paddock.
//
// Each column of land (across the row) belongs to the house whose back wall
// it lies behind, else the nearest one along the row. A low picket fence runs
// out from each party line to the far fence. Each plot, from the house out:
// a bench against the back if the garden faces south (it gets the sun), a
// vegetable patch, a washing pole, another patch, then a shed or a compost
// heap, and at the far end a fruit tree, apples or pears.
//
// Stability: seeded by the plot's own cells and house; a plot changes only
// when its land, its fences or its row change.
//
// Reads: landUse.burgages, clearways. Claims: the slot of everything it
// places (party fences stand on the cell line and claim nothing).
// Sockets: a 'seat' pair on each bench; 'activity'/'hang-washing' on each
// washing pole.

import { keyX, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { clearways, edgePos } from '../decoration/clearways.fact';
import { landUse } from './land-use.fact';
import { claimsOf, emit, placer, plotOf, type Placed } from './plots';

const RULE = 'U14.burgage-plots';

export default defineRule<Placed[]>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 860,
  about: 'Reads: landUse (burgages: fenced land behind the backs of a row of houses), clearways. Claims: the slots of its benches, patches, poles, sheds, heaps and fruit trees; party fences claim nothing.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<Placed[]>[] = [];
    for (const land of landUse(facts).burgages) {
      const plot = plotOf(facts, land.cells, seed);
      const p = placer((c, pos) => clear.free(c, pos));
      const look = (k: string, c: CellKey): number => hash(seed, RULE, k, c) % 1000;
      const D = land.dir;
      const acrossX = D === 0 || D === 2; // the row runs along x, the plots run along z
      const along = (c: CellKey): number => (acrossX ? keyX(c) : keyZ(c));
      const depthOf = (c: CellKey): number => {
        const v = acrossX ? keyZ(c) : keyX(c);
        const all = land.cells.map((k) => (acrossX ? keyZ(k) : keyX(k)));
        // Depth 0 is the row against the houses.
        return D === 0 || D === 3 ? v - Math.min(...all) : Math.max(...all) - v;
      };
      // Whose plot each cell is.
      const owner = new Map<CellKey, number>();
      for (const c of land.cells) {
        const a = along(c);
        let best = land.houses[0]!, bestD = Infinity;
        for (const h of land.houses) {
          const d = Math.min(...h.along.map((v) => Math.abs(v - a)));
          if (d < bestD) [best, bestD] = [h, d];
        }
        owner.set(c, best.id);
      }
      // Party fences, run out from the row to the far fence, drawn by the cell on the lower side.
      const fenced = new Set<string>();
      const up: Dir4 = acrossX ? 1 : 2; // toward the next plot
      for (const c of land.cells) {
        const n = neighbor(c, up);
        if (n !== NO_CELL && plot.has(n) && plot.beyond(c, up) === 'in' && owner.get(n) !== owner.get(c)) fenced.add(`${c}`);
      }
      const face = opposite(up);
      const minus = ((face + 1) % 4) as Dir4; // the fence piece's −X end
      for (const c of land.cells) {
        if (!fenced.has(`${c}`)) continue;
        const prev = neighbor(c, minus);
        const from = prev !== NO_CELL && fenced.has(`${prev}`) ? 0 : 1;
        p.put({ type: 'garden-fence', variant: 'picket', cell: c, pos: edgePos(up), face, claim: false, params: { from, to: 1, look: look('fence', c) } });
      }
      // Each plot: its cells by depth, keeping to the column nearest its middle.
      const ids = [...new Set(land.cells.map((c) => owner.get(c)!))].sort((a, b) => a - b);
      for (const id of ids) {
        const cells = land.cells.filter((c) => owner.get(c) === id);
        const cols = [...new Set(cells.map(along))].sort((a, b) => a - b);
        const mid = cols[Math.floor((cols.length - 1) / 2)]!;
        const spine = cells.filter((c) => along(c) === mid).sort((a, b) => depthOf(a) - depthOf(b));
        if (spine.length < 2) continue;
        const salt = hash(seed, RULE, 'plot', id, spine[0]!);
        const far = spine[spine.length - 1]!;
        const sunny = D === 0; // the house is north of its garden: the garden faces south
        // At the far end, the fruit tree.
        p.put({ type: 'fruit-tree', cell: far, pos: 'c', face: 2, params: { fruit: (salt % 3 === 0 ? 1 : 0) as 0 | 1, look: look('tree', far) } });
        // Before it, a shed or a compost heap against the party fence or the plot's side.
        const sideCell = spine.length >= 3 ? spine[spine.length - 2]! : far;
        const sides: Dir4[] = acrossX ? [1, 3] : [0, 2];
        const sideDir = sides.find((d) => plot.beyond(sideCell, d) !== 'in' || owner.get(neighbor(sideCell, d)) !== id) ?? sides[salt % 2]!;
        if (salt % 2 === 0) p.put({ type: 'shed', cell: sideCell, pos: edgePos(sideDir), face: opposite(sideDir), params: { look: look('shed', sideCell) } });
        else p.put({ type: 'compost', cell: sideCell, pos: edgePos(sideDir), face: opposite(sideDir), params: { look: look('compost', sideCell) } });
        // From the house out: a bench in the sun, then patches and the washing.
        const near = spine[0]!;
        if (sunny) p.put({ type: 'bench', variant: 'wood', cell: near, pos: edgePos(D), face: opposite(D), seats: 2, params: { look: look('bench', near) } });
        const middle = spine.slice(0, spine.length >= 3 ? -2 : -1);
        let washed = false;
        middle.forEach((c, i) => {
          const wash = !washed && (i + salt) % 3 === 1;
          if (wash) {
            washed = p.put({ type: 'washing-pole', cell: c, pos: 'c', face: (acrossX ? 1 : 2) as Dir4, activities: ['hang-washing'], params: { look: look('wash', c) } });
          } else p.put({ type: 'veg-patch', cell: c, pos: 'c', face: 2, params: { look: look('veg', c) } });
        });
      }
      if (p.items.length) out.push({ anchor: land.cells[0]!, data: p.items });
    }
    return out;
  },
  claims: (c) => claimsOf(c.data),
  apply: (c, out) => emit(out, c.data),
});
