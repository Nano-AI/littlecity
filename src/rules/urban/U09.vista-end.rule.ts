// U09 · tier 2 · Vista end. A straight street of DEPTH.vistaStreet cells or
// more that runs into the wall of a house makes that wall the end of a view,
// and a real town puts something there. The facade cell the street runs into
// gets one feature (`vista`), by what the house is:
//
//   its door is there            a grand doorway: pilasters and a pediment
//                                (a shop keeps its shopfront: an oriel over it)
//   a chapel                     a niche with a saint, on the upper storey
//   a manor or an inn            a clock, on the top storey
//   any other house of 2+        an oriel window on storey 2
//   a cottage of one storey      a niche
//   the town hall                nothing more: U11-F gave it a clock
//
// A shape-stage rule (part 'joinery'): features belong to the house's hash.
// It runs before J09 (910), which leaves the wall of a clock, niche or oriel
// without a window. Stability: depends on the street segment and the house
// it runs into (a street of 5 reaches 5 cells; the house is beside its end).
//
// Reads: streets (straight segments), facades, roles, doors, balconies.
// Claims: nothing (one candidate per facade cell, deduplicated).

import { above, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { streets } from '@/resolve/facts/streets.fact';
import { DEPTH } from '@/style/depth';

const RULE = 'U09.vista-end';
type Variant = 'clock' | 'niche' | 'doorway' | 'oriel';

export default defineRule<{ cell: CellKey; dir: Dir4; variant: Variant }>({
  id: RULE,
  part: 'joinery',
  tier: 2,
  priority: 915,
  about: 'Reads: streets (straight segments of 5+), facades, roles, door and balcony features. Emits: one vista feature (clock, niche, doorway or oriel) on the facade cell a long straight street runs into.',
  find({ facts, plan }) {
    const all = facades(facts);
    const min = Math.max(2, Math.round(DEPTH.vistaStreet));
    const out: Candidate<{ cell: CellKey; dir: Dir4; variant: Variant }>[] = [];
    const seen = new Set<number>();
    for (const street of streets(facts).list) {
      for (const seg of street.segments) {
        if (seg.length < min) continue;
        const ends: [CellKey, Dir4][] = seg.axis === 'x' ? [[seg.cells[0]!, 3], [seg.cells[seg.cells.length - 1]!, 1]] : [[seg.cells[0]!, 0], [seg.cells[seg.cells.length - 1]!, 2]];
        for (const [end, outward] of ends) {
          const wallCell = neighbor(end, outward);
          if (wallCell === NO_CELL || facts.kinds.get(wallCell) !== 'house') continue;
          const s = facts.structureAt.get(wallCell);
          if (s === undefined) continue;
          const dir = opposite(outward);
          const fc = all.at(wallCell, dir);
          if (!fc || fc.structure !== s || fc.touching) continue;
          const role = plan.roles.get(s)?.role;
          if (role === 'town-hall' || role === 'greenhouse') continue;
          const feats = plan.featuresByStructure.get(s) ?? [];
          const has = (type: string, cell: CellKey): boolean => feats.some((f) => f.type === type && f.cell === cell && f.dir === dir);
          // The wall above, storey by storey, while it is this house's and open to the street.
          const column: CellKey[] = [wallCell];
          for (let c = above(wallCell); facts.structureAt.get(c) === s && all.at(c, dir) && !all.at(c, dir)!.touching; c = above(c)) column.push(c);
          const upper = column.length >= 2 && !has('balcony', column[1]!) ? column[1]! : null;
          const top = column.length >= 2 ? column[column.length - 1]! : null;
          let pick: [CellKey, Variant] | null = null;
          if (has('door', wallCell)) pick = role === 'shop' ? (upper !== null ? [upper, 'oriel'] : null) : [wallCell, 'doorway'];
          else if (role === 'chapel') pick = [upper ?? wallCell, 'niche'];
          else if ((role === 'manor' || role === 'inn') && top !== null) pick = [top, 'clock'];
          else if (upper !== null) pick = [upper, 'oriel'];
          else if (column.length === 1) pick = [wallCell, 'niche'];
          if (!pick || has('vista', pick[0])) continue;
          const k = pick[0] * 4 + dir;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({ anchor: pick[0], structure: s, key: dir, data: { cell: pick[0], dir, variant: pick[1] } });
        }
      }
    }
    return out;
  },
  apply(c, out, ctx) {
    const { cell, dir, variant } = c.data;
    const look = Math.floor(ctx.rand('look') * 1000);
    const id = out.feature({ type: 'vista', variant, structure: c.structure!, cell, dir, params: { look } });
    if (variant === 'clock') out.socket({ type: 'clock-hands', owner: id, structure: c.structure, cell, dir });
  },
});
