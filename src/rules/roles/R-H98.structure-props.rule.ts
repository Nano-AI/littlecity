// R-H98 · tier 2 · Structure props. The loose things the roles of
// discovery round 1 promise, which belong to a role rather than to any
// general decoration rule (as R-H99 does for the older house roles):
//
//   theatre (R-M09)   a painted backdrop with two masks at the back of the
//                     stage, facing the seats; a brazier at each end of it
//   barn (R-H18)      outside its big doors: hay bales, and on a farmstead
//                     a hand cart too
//   warehouse (R-H17) crates, a barrel and a sack beside its loading door
//   watermill (R-H16) the water wheel (an actor) on the mill race's hub; a
//                     timber weir across the stream beside it; flour sacks
//                     at the land door
//
// A decoration-stage rule (props exist only there), kept with the role rules
// it serves. Priority 896: just before R-H99, and before the general
// doorstep dressing (D11), so these get their floor slots first.

import { key, keyX, keyZ, neighbor, NO_CELL, opposite, turn, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { cellInfo } from '@/resolve/facts/cell.fact';
import type { Anchor, CellPos } from '@/resolve/plan';
import { theatreOf } from './R-M09.theatre.rule';
import { riverAt } from './river.lib';

type Variant = 'backdrop' | 'brazier' | 'hay' | 'weir' | 'crates';
interface Data {
  variant: Variant | 'cart' | 'sacks' | 'wheel';
  at: Anchor;
  claim: string;
  span?: number;
}

export default defineRule<Data>({
  id: 'R-H98.structure-props',
  part: 'decoration',
  tier: 2,
  priority: 896,
  about: 'Reads: the roles of discovery round 1 (theatre, barn, warehouse, watermill), main doors, the mill race, river water. Emits: structure-prop props, role-prop carts and sacks, the water-wheel actor. Claims: the floor slots they stand on.',
  find(ctx) {
    const { plan } = ctx;
    const out: Candidate<Data>[] = [];
    const add = (anchor: CellKey, structure: number, key: string, variant: Data['variant'], at: Anchor, claim: string): void => {
      out.push({ anchor, structure, key, data: { variant, at, claim } });
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
      if (role === 'warehouse') {
        const doors = (plan.featuresByStructure.get(id) ?? []).find((f) => f.type === 'loading-doors');
        const at = doors ? (plan.socketsByOwner.get(doors.id) ?? []).find((k) => k.type === 'loading-door') : undefined;
        if (at) add(at.cell, id, 'crates', 'crates', { socket: at.id }, slot.socket(at.id));
      } else if (role === 'watermill') {
        const race = (plan.featuresByStructure.get(id) ?? []).find((f) => f.type === 'mill-race');
        const hub = race ? (plan.socketsByOwner.get(race.id) ?? []).find((k) => k.type === 'wheel-hub') : undefined;
        if (race && hub && race.cell !== undefined && race.dir !== undefined) {
          add(race.cell, id, 'wheel', 'wheel', { socket: hub.id }, slot.socket(hub.id));
          // The weir: from the bank beside the wheel straight out across the stream, to the far bank.
          const dir = race.dir as Dir4;
          const water = neighbor(race.cell, dir);
          for (const side of [turn(dir, 3), turn(dir, 1)] as Dir4[]) {
            const start = neighbor(water, side);
            if (start === NO_CELL) continue;
            const base = key(keyX(start), 0, keyZ(start));
            if (!riverAt(ctx.facts.terrain, keyX(start), keyZ(start)) || ctx.facts.kinds.has(key(keyX(start), 0, keyZ(start)))) continue;
            let span = 0;
            for (let c = start; c !== NO_CELL && span < 5 && riverAt(ctx.facts.terrain, keyX(c), keyZ(c)); c = neighbor(c, dir)) span++;
            out.push({ anchor: base, structure: id, key: 'weir', data: { variant: 'weir', at: { cell: base, pos: 'c', face: dir }, claim: slot.custom('weir', id), span } });
            break;
          }
        }
        const y = yard(id);
        if (y) add(y.cell, id, 'sacks', 'sacks', { cell: y.cell, pos: CORNERS[y.dir][0], face: y.dir }, slot.floor(y.cell, CORNERS[y.dir][0]));
      } else if (role === 'barn') {
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
    const v = c.data.variant;
    if (v === 'cart' || v === 'sacks') out.prop({ type: 'role-prop', variant: v, at: c.data.at });
    else if (v === 'wheel') out.actor({ type: 'water-wheel', at: c.data.at, home: c.structure });
    else out.prop({ type: 'structure-prop', variant: v, at: c.data.at, ...(c.data.span !== undefined ? { params: { span: c.data.span } } : {}) });
  },
});
