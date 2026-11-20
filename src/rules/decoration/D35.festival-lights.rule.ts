// D35 · tier 2 · The midwinter festival (Seasons, design section 13a).
//
//   Eaves: every house's top storey gets a string of small coloured bulbs under its eaves, on every
//   side that faces open air (one prop per top cell, its sides in a mask).
//   Doors: a wreath on every main door.
//   Streets: across a street between facing houses, on every second cell (where bunting or laundry
//   has not already taken the air).
//   Squares: from lamp head to lamp head round every square (where bunting does not already hang).
//   The main square: the biggest square gets the town's tree, with a star.
//
// They are placed whatever the season, like any decoration: the rules never read the clock. The
// festival system (src/life/seasons/festival.system.ts) keeps them hidden until the festival, puts
// them up house by house, and lights them from dusk. This rule runs after every other decoration and
// claims only slots of its own (and the air across a street, which only D04 and D05 also want), so it
// changes nothing that any other rule decides.
//
// Reads: occupancy, structures (houses' top storeys), door features and sockets, streets, plazas, D02's
// lamps. Claims: festival slots of its own; the air between two wall faces.

import { key, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { occupancy } from '@/resolve/facts/occupancy.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import { streets } from '@/resolve/facts/streets.fact';
import type { Slot } from '@/resolve/plan';
import { airSlot } from './D05.laundry-line.rule';
import { onGround } from './lib';

const RULE = 'D35.festival-lights';
const LEVEL = 1 << 12;

type Festive =
  | { kind: 'eave'; cell: CellKey; faces: number }
  | { kind: 'wreath'; socket: string; steps: number }
  | { kind: 'street'; from: CellKey; to: CellKey; dir: Dir4; claim: Slot }
  | { kind: 'square'; a: string; b: string }
  | { kind: 'tree'; cell: CellKey };

export default defineRule<Festive>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 650,
  about: 'The midwinter festival, placed all year and shown by the festival system. Reads: houses (top storeys), occupancy, main doors and their sockets, streets, plazas, D02’s lamps. Claims: festival slots of its own, the air between two wall faces, the line between two lamp heads.',
  find({ facts, plan, dressing }) {
    const out: Candidate<Festive>[] = [];
    const occ = occupancy(facts);
    const isHouse = (c: CellKey): boolean => c !== NO_CELL && occ.kindAt(c) === 'house';
    // Eaves: the top storey of every column of a house.
    for (const s of plan.structures.values()) {
      if (s.kind !== 'house') continue;
      for (const c of s.cells) {
        if (isHouse(c + LEVEL)) continue;
        let faces = 0;
        for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
          const n = neighbor(c, d);
          if (n === NO_CELL || !occ.kind[n]) faces |= 1 << d;
        }
        if (faces) out.push({ anchor: c, structure: s.id, key: 'eave', data: { kind: 'eave', cell: c, faces } });
      }
    }
    // Wreaths on main doors.
    for (const f of plan.features) {
      const params = f.params as { main?: number; steps?: number } | undefined;
      if (f.type !== 'door' || f.cell === undefined || params?.main !== 1 || f.variant === 'shop') continue;
      const socket = (plan.socketsByOwner.get(f.id) ?? []).find((s) => s.type === 'door');
      if (socket) out.push({ anchor: f.cell, structure: f.structure, key: `wreath${f.dir ?? 0}`, data: { kind: 'wreath', socket: socket.id, steps: params.steps ?? 0 } });
    }
    // Across streets, between facing houses.
    for (const street of streets(facts).list) {
      for (const seg of street.segments) {
        if (seg.length < 2) continue;
        const [a, b]: [Dir4, Dir4] = seg.axis === 'x' ? [0, 2] : [3, 1];
        for (const c of seg.cells) {
          if (!onGround(facts, c)) continue;
          if ((seg.axis === 'x' ? keyX(c) : keyZ(c)) % 2 !== 1) continue;
          const wa = neighbor(c, a), wb = neighbor(c, b);
          if (wa === NO_CELL || wb === NO_CELL || !isHouse(wa) || !isHouse(wb)) continue;
          // Strung at the upper storey where both houses have one, else at the eaves of the lower.
          const up = isHouse(wa + LEVEL) && isHouse(wb + LEVEL) && !occ.kind[c + LEVEL] ? LEVEL : 0;
          out.push({ anchor: c, key: `st${seg.axis}`, data: { kind: 'street', from: wa + up, to: wb + up, dir: b, claim: airSlot(wa + up, b) } });
        }
      }
    }
    // Round squares, from lamp to lamp; the biggest square's tree.
    const lamps = (dressing?.props ?? []).filter((p) => p.rule === 'D02.square-lamps' && p.variant === 'post' && 'cell' in p.at);
    let main: { cells: readonly CellKey[] } | null = null;
    for (const plaza of plazas(facts).list) {
      if (!plaza.square) continue;
      if (!main || plaza.cells.length > main.cells.length) main = plaza;
      const inside = new Set(plaza.cells);
      const mine = lamps.filter((p) => 'cell' in p.at && inside.has(p.at.cell)).map((p) => ({ id: p.id, cell: (p.at as { cell: CellKey }).cell }));
      for (const p of mine) {
        for (const q of mine) {
          if (p.cell >= q.cell || keyY(p.cell) !== keyY(q.cell)) continue;
          const sameRow = keyZ(p.cell) === keyZ(q.cell), sameCol = keyX(p.cell) === keyX(q.cell);
          if (sameRow === sameCol) continue;
          const gap = sameRow ? keyX(q.cell) - keyX(p.cell) : keyZ(q.cell) - keyZ(p.cell);
          if (gap < 2 || gap > 7) continue;
          out.push({ anchor: p.cell, key: `sq${q.cell}`, data: { kind: 'square', a: `${p.id}/lamp-head`, b: `${q.id}/lamp-head` } });
        }
      }
    }
    if (main) {
      // The free paving nearest the square's middle; the tree stands at that cell's corner nearest it.
      let sx = 0, sz = 0;
      for (const c of main.cells) {
        sx += keyX(c) + 0.5;
        sz += keyZ(c) + 0.5;
      }
      sx /= main.cells.length;
      sz /= main.cells.length;
      // Not where something already stands (the square's lamp, a statue, a bench).
      const taken = new Set<CellKey>();
      for (const p of dressing?.props ?? []) if ('cell' in p.at) taken.add(p.at.cell);
      let best: CellKey = NO_CELL, bestD = Infinity;
      for (const c of main.cells) {
        if (occ.kind[c]) continue;
        // Keep the corner's other three cells free too, so the tree stands in the open.
        const x = keyX(c), z = keyZ(c), y = keyY(c);
        const around = [key(x - 1, y, z), key(x, y, z - 1), key(x - 1, y, z - 1)];
        if (around.some((n) => !main!.cells.includes(n) || occ.kind[n] || taken.has(n)) || taken.has(c)) continue;
        const d = Math.hypot(x - sx, z - sz);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best !== NO_CELL) out.push({ anchor: best, key: 'tree', data: { kind: 'tree', cell: best } });
    }
    return out;
  },
  claims: (c) => {
    const d = c.data;
    if (d.kind === 'street') return [d.claim];
    if (d.kind === 'square') return [slot.custom(RULE, d.a, d.b), slot.line(d.a, d.b)];
    return [slot.custom(RULE, c.anchor, d.kind)];
  },
  apply(c, out, ctx) {
    const look = hash(ctx.seed, RULE, c.anchor) % 1000;
    const d = c.data;
    if (d.kind === 'eave') {
      // Hung from a socket on top of the storey (no dir: the centre of the cell's top, world axes).
      const top = out.socket({ type: 'festival-anchor', cell: d.cell, structure: c.structure });
      out.prop({ type: 'festival-lights', variant: 'eave', at: { socket: top }, params: { faces: d.faces, look } });
    } else if (d.kind === 'wreath') {
      out.prop({ type: 'wreath', at: { socket: d.socket }, params: { look, steps: d.steps } });
    } else if (d.kind === 'street') {
      const from = out.socket({ type: 'festival-anchor', cell: d.from, dir: d.dir, structure: ctx.plan.structureAt.get(d.from) });
      const to = out.socket({ type: 'festival-anchor', cell: d.to, dir: opposite(d.dir), structure: ctx.plan.structureAt.get(d.to) });
      out.prop({ type: 'festival-lights', variant: 'street', at: { from, to }, params: { look, drop: -0.22 } });
    } else if (d.kind === 'square') {
      out.prop({ type: 'festival-lights', variant: 'square', at: { from: d.a, to: d.b }, params: { look, drop: 0.06 } });
    } else {
      out.prop({ type: 'festival-tree', at: { cell: d.cell, pos: 'nw' }, params: { look } });
    }
  },
});

