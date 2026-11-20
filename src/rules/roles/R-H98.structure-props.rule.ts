// R-H98 · tier 2 · Structure props. The loose things the roles of
// discovery round 1 promise, which belong to a role rather than to any
// general decoration rule (as R-H99 does for the older house roles):
//
//   theatre (R-M09)   a painted backdrop with two masks at the back of the
//                     stage, facing the seats; a brazier at each end of it
//   barn (R-H18)      outside its big doors: hay bales, and on a farmstead
//                     a hand cart too
//   churchyard        rows of headstones facing east (two graves to a cell,
//   (R-G02, or bare   every other column of cells left as a mown walk), a
//   grass closed      stone cross in the middle, a dark yew in the corner
//   round beside a    farthest from the chapel, and a lychgate over each
//   chapel)           opening a path makes in its wall or fence (J20 gate)
//   smithy (R-H19)    an anvil on its block with a quench barrel outside the
//                     forge front; a hitching rail and trough by the door
//   stoa (R-M12)      goods for the booths on every other free ground cell
//                     under it, along its back
//   schoolhouse       a hopscotch court chalked on the middle of its yard
//   (R-H21)
//   warehouse (R-H17) crates, a barrel and a sack beside its loading door
//   watermill (R-H16) the water wheel (an actor) on the mill race's hub; a
//                     timber weir across the stream beside it; flour sacks
//                     at the land door
//
// A decoration-stage rule (props exist only there), kept with the role rules
// it serves. Priority 896: just before R-H99, and before the general
// doorstep dressing (D11), so these get their floor slots first.

import { columnIndex, edgeCells, edgeOf, key, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, turn, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { cellInfo } from '@/resolve/facts/cell.fact';
import type { Anchor, CellPos } from '@/resolve/plan';
import { theatreOf } from './R-M09.theatre.rule';
import { chapels, grassYard, isChurchyard } from './churchyard.lib';
import { riverAt } from './river.lib';
import { schoolYard } from './R-H21.schoolhouse.rule';

type Variant = 'backdrop' | 'brazier' | 'hay' | 'weir' | 'crates' | 'anvil' | 'hitching' | 'hopscotch' | 'headstone' | 'cross' | 'yew' | 'lychgate';
interface Data {
  variant: Variant | 'cart' | 'sacks' | 'wheel';
  at: Anchor;
  claim: string;
  span?: number;
  edge?: number;
}

export default defineRule<Data>({
  id: 'R-H98.structure-props',
  part: 'decoration',
  tier: 2,
  priority: 896,
  about: 'Reads: the roles of discovery round 1 (theatre, stoa, barn, smithy, warehouse, watermill, churchyard; chapels for bare-grass yards), J20 gates, main doors, the mill race, river water. Emits: structure-prop props, role-prop carts and sacks, the water-wheel actor. Claims: the floor slots they stand on.',
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
    // Churchyards: garden regions with the role, and bare grass closed round beside a chapel.
    const yards: { id: number; cells: CellKey[] }[] = [];
    for (const [id, { role }] of plan.roles) if (role === 'churchyard') yards.push({ id, cells: [...plan.structures.get(id)!.cells] });
    for (const { chapel, steeple } of chapels(plan)) {
      const church = new Set<number>(steeple === null ? [chapel] : [chapel, steeple]);
      const seen = new Set<CellKey>(yards.flatMap((y) => y.cells));
      for (const id of church) {
        for (const c of plan.structures.get(id)!.cells) {
          for (const d of [0, 1, 2, 3] as Dir4[]) {
            const n = neighbor(c, d);
            if (n === NO_CELL || seen.has(n)) continue;
            const cells = grassYard(ctx.facts, n);
            if (!cells) continue;
            for (const k of cells) seen.add(k);
            if (isChurchyard(ctx.facts, cells, church)) yards.push({ id: chapel, cells });
          }
        }
      }
    }
    for (const yard of yards) {
      const inYard = new Set(yard.cells);
      const x0 = Math.min(...yard.cells.map(keyX));
      const graves = yard.cells.filter((c) => !ctx.facts.kinds.has(c) && (keyX(c) - x0) % 2 === 0);
      // The yew: in the cell farthest from the chapel's middle, the cross in the middle of the graves.
      const church = plan.structures.get(yard.id)!;
      const cx = church.cells.reduce((a, c) => a + keyX(c), 0) / church.cells.length, cz = church.cells.reduce((a, c) => a + keyZ(c), 0) / church.cells.length;
      const far = [...yard.cells].filter((c) => !ctx.facts.kinds.has(c)).sort((a, b) => Math.hypot(keyX(b) - cx, keyZ(b) - cz) - Math.hypot(keyX(a) - cx, keyZ(a) - cz) || a - b)[0];
      const crossAt = graves.length >= 3 ? graves[Math.floor(graves.length / 2)] : undefined;
      for (const c of graves) {
        if (c === far) continue;
        if (c === crossAt) {
          add(c, yard.id, `cross${c}`, 'cross', { cell: c, pos: 'c', face: 1 }, slot.floor(c, 'c'));
          continue;
        }
        for (const pos of ['nw', 'sw'] as CellPos[]) add(c, yard.id, `stone${c}${pos}`, 'headstone', { cell: c, pos, face: 1 }, slot.floor(c, pos));
      }
      if (far !== undefined) add(far, yard.id, `yew${far}`, 'yew', { cell: far, pos: 'c' }, slot.floor(far, 'c'));
      // Lychgates: over a gate (J20) in a wall or fence run that opens into the yard.
      for (const f of plan.features) {
        if (f.type !== 'gate') continue;
        if (f.cell !== undefined) {
          const inner = ([0, 1, 2, 3] as Dir4[]).find((d) => inYard.has(neighbor(f.cell!, d)));
          if (inner === undefined) continue;
          add(f.cell, yard.id, `lych${f.cell}`, 'lychgate', { cell: f.cell, pos: 'c', face: opposite(inner) as Dir4 }, slot.custom('lychgate', f.cell));
        } else if (f.edge !== undefined) {
          const [a, b] = edgeCells(f.edge);
          // The side of the gate in the yard: a yard cell, or the path cell inside it that the gate opens onto.
          const touches = (c: CellKey, not: CellKey): boolean => inYard.has(c) || ([0, 1, 2, 3] as Dir4[]).some((d) => neighbor(c, d) !== not && inYard.has(neighbor(c, d)));
          const inside = touches(a, b) && !inYard.has(b) ? a : touches(b, a) ? b : NO_CELL;
          if (inside === NO_CELL) continue;
          const other = inside === a ? b : a;
          const d = ([0, 1, 2, 3] as Dir4[]).find((k) => neighbor(inside, k) === other)!;
          out.push({ anchor: inside, structure: yard.id, key: `lych-e${f.edge}`, data: { variant: 'lychgate', at: { cell: inside, pos: 'c', face: d }, claim: slot.custom('lychgate', inside, d), edge: 1 } });
        }
      }
    }
    for (const [id, { role }] of plan.roles) {
      if (role === 'schoolhouse') {
        // In the fenced part of the yard if it has one: a cell with a fence or wall on a side, or beyond one.
        const yardCells = schoolYard(ctx.facts, plan.structures.get(id)!).filter(free);
        const fenced = (c: CellKey): boolean =>
          ([0, 1, 2, 3] as Dir4[]).some((d) => {
            const e = edgeOf(c, d);
            const k = ctx.facts.kinds.get(neighbor(c, d));
            return (e !== NO_CELL && ctx.facts.world.edges.has(e)) || k === 'fence' || k === 'wall';
          });
        const inner = yardCells.filter(fenced);
        const pool = inner.length > 0 ? inner : yardCells;
        const at = pool[Math.floor(pool.length / 2)];
        if (at !== undefined) add(at, id, 'hopscotch', 'hopscotch', { cell: at, pos: 'c' }, slot.floor(at, 'c'));
      } else if (role === 'stoa') {
        const s = plan.structures.get(id)!;
        const tags = plan.tags.get(id);
        const front: Dir4 = tags?.has('stoa:n') ? 0 : tags?.has('stoa:e') ? 1 : tags?.has('stoa:w') ? 3 : 2;
        const back = opposite(front) as Dir4;
        const lowest = Math.min(...s.cells.map(keyY));
        const row = s.cells.filter((c) => keyY(c) === lowest).filter((c) => !s.cells.includes(neighbor(c, back)));
        row.sort((a, b) => a - b).forEach((c, i) => {
          if (i % 2 === 1) return;
          // The ground cell under it, on the terrain.
          const cell = key(keyX(c), ctx.facts.terrain.height[columnIndex(keyX(c), keyZ(c))]!, keyZ(c));
          if (keyY(cell) >= keyY(c) || !free(cell)) return;
          add(cell, id, `booth${cell}`, 'crates', { cell, pos: 'c', face: front }, slot.floor(cell, 'c'));
        });
      } else if (role === 'smithy') {
        const forge = (plan.featuresByStructure.get(id) ?? []).find((f) => f.type === 'forge-front');
        if (forge && forge.cell !== undefined && forge.dir !== undefined) {
          const out1 = neighbor(forge.cell, forge.dir as Dir4);
          if (free(out1)) add(out1, id, 'anvil', 'anvil', { cell: out1, pos: 'c', face: opposite(forge.dir as Dir4) as Dir4 }, slot.floor(out1, 'c'));
        }
        const y = yard(id);
        if (y) add(y.cell, id, 'hitching', 'hitching', { cell: y.cell, pos: CORNERS[y.dir][3], face: y.dir }, slot.floor(y.cell, CORNERS[y.dir][3]));
      } else if (role === 'warehouse') {
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
    else {
      const params = { ...(c.data.span !== undefined ? { span: c.data.span } : {}), ...(c.data.edge !== undefined ? { edge: c.data.edge } : {}) };
      out.prop({ type: 'structure-prop', variant: v, at: c.data.at, ...(Object.keys(params).length ? { params } : {}) });
    }
  },
});
