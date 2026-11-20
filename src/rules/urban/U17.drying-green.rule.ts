// U17 · tier 2 · Drying green (discovery round 1, UF-12).
//
// Before back yards were walled, washing was laid out on a common green
// behind the cottages. The landUse fact finds it: a leftover patch of grass
// too big to be a back yard (more than DRESSING.yardMax cells, up to 20),
// with no fence or wall round it (fenced land behind a row is U14's), shut
// in by the backs of three or more houses and touching no street or square.
// Must not: a courtyard (buildings only, 2+ across both ways, up to 16: D17's
// cobbles), a park (3+ trees), any patch touching a street.
//
// Two or three washing lines on posts, each two cells long, stand across it
// ('activity'/'hang-washing' at each), a basket of washing by the first, and
// a sheet or two spread out on the grass to bleach. Each line's wash is its
// own prop with an L60 errand socket ('errand', `laundry|line|<prop id>`,
// owned by the nearest house), so the living town's washing day carries it
// out in the morning and takes it in at dusk; the posts stay.
//
// Stability: seeded by the patch's own cells.
//
// Reads: landUse.dryingGreens, clearways. Claims: the centre slots of both
// cells under each line, the basket's slot; sheets claim their cell's
// 'sheet' slot.

import { keyX, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import type { Slot, StructureId } from '@/resolve/plan';
import { clearways } from '../decoration/clearways.fact';
import { landUse } from './land-use.fact';
import { emit, placer, plotOf, type Placed } from './plots';

const RULE = 'U17.drying-green';

interface Line {
  cell: CellKey;
  next: CellKey;
  face: Dir4;
}

/** The house of the green nearest a cell (by its cells' column distance). */
function nearestHouse(facts: Facts, cell: CellKey, houses: readonly StructureId[]): StructureId | undefined {
  let best: StructureId | undefined, bestD = Infinity;
  for (const h of houses) {
    for (const c of facts.structures.get(h)?.cells ?? []) {
      const d = Math.abs(keyX(c) - keyX(cell)) + Math.abs(keyZ(c) - keyZ(cell));
      if (d < bestD) [best, bestD] = [h, d];
    }
  }
  return best;
}

export default defineRule<{ items: Placed[]; lines: Line[]; sheets: CellKey[]; houses: readonly StructureId[] }>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 830,
  about: 'Reads: landUse (drying greens: unfenced leftovers of 7–20 cells behind 3+ houses, off every street), clearways. Claims: the centre slots under each washing line, the basket’s slot, a sheet slot per sheet.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<{ items: Placed[]; lines: Line[]; sheets: CellKey[]; houses: readonly StructureId[] }>[] = [];
    for (const patch of landUse(facts).dryingGreens) {
      const plot = plotOf(facts, patch.cells, seed);
      const p = placer((c, pos) => clear.free(c, pos));
      const used = new Set<CellKey>();
      const lines: Line[] = [];
      const look = (k: string, c: CellKey): number => hash(seed, RULE, k, c) % 1000;
      const want = patch.cells.length >= 12 ? 3 : 2;
      for (const c of plot.shuffled('line')) {
        if (lines.length >= want) break;
        // Along x (+X east, face south) or along z (+X south, face west), whichever fits.
        for (const [d, face] of [[1, 2], [2, 3]] as const) {
          const n = neighbor(c, d);
          if (n === NO_CELL || !plot.has(n) || plot.beyond(c, d) !== 'in') continue;
          // Lines keep a cell apart.
          const near = [c, n].some((k) => used.has(k) || [0, 1, 2, 3].some((e) => used.has(neighbor(k, e as Dir4))));
          if (near || !clear.free(c, 'c') || !clear.free(n, 'c')) continue;
          if (!p.put({ type: 'drying-line', variant: 'posts', cell: c, pos: 'c', face, params: { span: 2, look: look('line', c) } })) continue;
          p.put({ type: 'drying-line', cell: c, pos: 'c', face, claim: false, activities: ['hang-washing'], params: { span: 2, look: look('line', c) } });
          lines.push({ cell: c, next: n, face });
          used.add(c).add(n);
          break;
        }
      }
      if (!lines.length) continue;
      // A basket of washing beside the first line.
      const first = lines[0]!;
      for (const pos of ['se', 'sw', 'ne', 'nw'] as const) if (p.put({ type: 'basket', variant: 'washing', cell: first.cell, pos, activities: ['basket'], params: { look: look('basket', first.cell) } })) break;
      // A sheet or two bleaching on the grass, where no line stands.
      const sheets: CellKey[] = [];
      for (const c of plot.shuffled('sheet')) {
        if (sheets.length >= 2) break;
        if (used.has(c) || !clear.free(c, 'c')) continue;
        p.put({ type: 'bleaching-sheet', cell: c, pos: 'nw', face: 2, claim: false, params: { look: look('sheet', c) } });
        sheets.push(c);
      }
      out.push({ anchor: patch.cells[0]!, data: { items: p.items, lines, sheets, houses: patch.houses } });
    }
    return out;
  },
  claims: (c): Slot[] => [
    ...c.data.lines.flatMap((l) => [slot.floor(l.cell, 'c'), slot.floor(l.next, 'c')]),
    ...c.data.items.filter((i) => i.type === 'basket').map((i) => slot.floor(i.cell, i.pos)),
    ...c.data.sheets.map((s) => slot.custom('sheet', s)),
  ],
  apply(c, out, { facts }) {
    const ids = emit(out, c.data.items);
    // Washing day (L60's laundry chain): each line's wash is carried out in the morning and taken in at
    // dusk by somebody from the nearest house, who stands at the line's first cell, facing along it.
    c.data.items.forEach((item, i) => {
      if (item.type !== 'drying-line' || item.variant === 'posts') return;
      const home = nearestHouse(facts, item.cell, c.data.houses);
      if (home === undefined) return;
      out.socket({ id: `${RULE}@${ids[i]}`, type: 'errand', cell: item.cell, dir: ((item.face! + 1) % 4) as Dir4, structure: home, name: `laundry|line|${ids[i]}` });
    });
  },
});
