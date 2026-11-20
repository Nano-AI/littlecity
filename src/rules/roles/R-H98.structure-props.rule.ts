// R-H98 · tier 2 · Structure props. The loose things the roles of
// discovery round 1 promise, which belong to a role rather than to any
// general decoration rule (as R-H99 does for the older house roles):
//
//   theatre (R-M09)   a painted backdrop with two masks at the back of the
//                     stage, facing the seats; a brazier at each end of it
//   barn (R-H18)      outside its big doors: hay bales, and on a farmstead
//                     a hand cart too
//
// A decoration-stage rule (props exist only there), kept with the role rules
// it serves. Priority 896: just before R-H99, and before the general
// doorstep dressing (D11), so these get their floor slots first.

import { keyX, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { cellInfo } from '@/resolve/facts/cell.fact';
import type { Anchor, CellPos } from '@/resolve/plan';
import { theatreOf } from './R-M09.theatre.rule';

type Variant = 'backdrop' | 'brazier' | 'hay';
interface Data {
  type?: 'role-prop';
  variant: Variant | 'cart';
  at: Anchor;
  claim: string;
}

export default defineRule<Data>({
  id: 'R-H98.structure-props',
  part: 'decoration',
  tier: 2,
  priority: 896,
  about: 'Reads: the roles of discovery round 1 (theatre, barn), main doors. Emits: structure-prop props (and a role-prop cart). Claims: the floor slots they stand on.',
  find(ctx) {
    const { plan } = ctx;
    const out: Candidate<Data>[] = [];
    const add = (anchor: CellKey, structure: number, key: string, variant: Data['variant'], at: Anchor, claim: string): void => {
      out.push({ anchor, structure, key, data: { variant, at, claim, ...(variant === 'cart' ? { type: 'role-prop' as const } : {}) } });
    };
    const info = cellInfo(ctx.facts);
    const free = (cell: CellKey): boolean => cell !== NO_CELL && !ctx.facts.kinds.has(cell) && info.at(cell).standable && ctx.facts.world.floors.get(cell) !== 'garden';
    /** The main door of a structure and the free level cell outside it, if there is one. */
    const yard = (id: number): { cell: CellKey; dir: Dir4 } | null => {
      const door = (plan.featuresByStructure.get(id) ?? []).find((f) => f.type === 'door' && (f.params as { main?: number } | undefined)?.main === 1);
      if (!door || door.cell === undefined || door.dir === undefined || ((door.params as { steps?: number } | undefined)?.steps ?? 0) > 0) return null;
      const cell = neighbor(door.cell, door.dir as Dir4);
      return free(cell) ? { cell, dir: door.dir as Dir4 } : null;
    };
    /** The floor corners of the cell outside a door on side d: the two by the wall, then the two away from it. */
    const CORNERS: Record<Dir4, readonly [CellPos, CellPos, CellPos, CellPos]> = {
      0: ['sw', 'se', 'nw', 'ne'],
      1: ['nw', 'sw', 'ne', 'se'],
      2: ['nw', 'ne', 'sw', 'se'],
      3: ['ne', 'se', 'nw', 'sw'],
    };
    for (const [id, { role }] of plan.roles) {
      if (role === 'barn') {
        const y = yard(id);
        if (!y) continue;
        const [a, , , d] = CORNERS[y.dir];
        add(y.cell, id, 'hay', 'hay', { cell: y.cell, pos: a, face: y.dir }, slot.floor(y.cell, a));
        if (plan.tags.get(id)?.has('farmstead')) add(y.cell, id, 'cart', 'cart', { cell: y.cell, pos: d, face: y.dir }, slot.floor(y.cell, d));
      } else if (role === 'theatre') {
        const t = theatreOf(plan.structures.get(id)!, plan);
        if (!t) continue;
        // The back of the stage: the row farthest from the seats, its middle cell and its two ends.
        const along = (c: CellKey): number => (t.facing === 0 || t.facing === 2 ? keyZ(c) : keyX(c)) * (t.facing === 0 || t.facing === 3 ? -1 : 1);
        const far = Math.max(...t.stage.map(along));
        const row = t.stage.filter((c) => along(c) === far).sort((a, b) => a - b);
        const face = opposite(t.facing) as Dir4;
        const mid = row[Math.floor((row.length - 1) / 2)]!;
        add(mid, id, 'backdrop', 'backdrop', { cell: mid, pos: 'c', face }, slot.floor(mid, 'c'));
        if (row.length >= 3) {
          for (const end of [row[0]!, row[row.length - 1]!]) add(end, id, `brazier${end}`, 'brazier', { cell: end, pos: 'c', face }, slot.floor(end, 'c'));
        }
      }
    }
    return out;
  },
  claims: (c) => [c.data.claim],
  apply(c, out) {
    if (c.data.variant === 'cart') out.prop({ type: 'role-prop', variant: 'cart', at: c.data.at });
    else out.prop({ type: 'structure-prop', variant: c.data.variant, at: c.data.at });
  },
});
