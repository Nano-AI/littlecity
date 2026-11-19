// L12 · tier 1 · Pigeons. Per plaza region: flock = clamp(cells ÷ 3, 0, 12).
// The flock feeds round one seeded cell of the plaza (its "spot"); each
// pigeon's own place is a floor slot of one of the free cells nearest it
// (free: no fountain, stall or tree standing in the cell), on a slot no
// decoration has taken. One pigeon in three gets a perch, where the plaza
// has one in or beside it (a birdbath's rim, a statue).
//
// Pigeons claim nothing: they walk round whatever stands on the square.

import { keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import { CELL_POSITIONS, type CellPos } from '@/resolve/plan';
import { BIRDS } from '@/style/birds';

interface Pigeon {
  pos: CellPos;
  index: number;
  count: number;
  plaza: number;
  spot: CellKey;
  perch: string;
}

export default defineRule<Pigeon>({
  id: 'L12.pigeons',
  part: 'life',
  tier: 1,
  priority: 880,
  about: 'Reads: plazas, blocks standing on them, floor slots taken by props, perch sockets in or beside the plaza. Emits: pigeon actors at plaza floor slots (params index, count, plaza, spot, perch).',
  find({ facts, dressing }) {
    const out: Candidate<Pigeon>[] = [];
    // Slots a lamp, a bench or a flagpole already stands on.
    const taken = new Set<string>();
    for (const p of dressing?.props ?? []) if ('cell' in p.at) taken.add(`${p.at.cell}:${p.at.pos}`);
    const perchSockets = [...socketsOfType(facts, 'perch'), ...(dressing?.sockets ?? []).filter((s) => s.type === 'perch')];
    const usedPerch = new Set<string>();

    for (const plaza of plazas(facts).list) {
      const count = Math.min(BIRDS.pigeonMax, Math.floor(plaza.area / BIRDS.pigeonPerCells));
      const free = plaza.cells.filter((c) => !facts.kinds.has(c));
      if (count <= 0 || free.length === 0) continue;
      const order = (c: CellKey): number => hash(facts.seed, 'pigeon-spot', c);
      const spot = free.reduce((best, c) => (order(c) < order(best) || (order(c) === order(best) && c < best) ? c : best));
      const dist = (c: CellKey): number => (keyX(c) - keyX(spot)) ** 2 + (keyZ(c) - keyZ(spot)) ** 2 + (keyY(c) - keyY(spot)) ** 2;
      const near = [...free].sort((a, b) => dist(a) - dist(b) || order(a) - order(b) || a - b);
      // In or right beside the plaza, on its level or just above (a fountain's rim).
      const perches = perchSockets
        .filter((s) => !usedPerch.has(s.id) && keyX(s.cell) >= plaza.box.x0 - 1 && keyX(s.cell) <= plaza.box.x1 + 1 && keyZ(s.cell) >= plaza.box.z0 - 1 && keyZ(s.cell) <= plaza.box.z1 + 1 && keyY(s.cell) >= plaza.box.y0 && keyY(s.cell) <= plaza.box.y1 + 1)
        .slice(0, Math.ceil(count / 3));
      for (const s of perches) usedPerch.add(s.id);

      for (let i = 0; i < count; i++) {
        // Spread over the nearest cells first, then double up on other slots.
        const cell = near[i % near.length]!;
        const slots = [...CELL_POSITIONS].sort((a, b) => hash(facts.seed, 'pigeon-slot', cell, a) - hash(facts.seed, 'pigeon-slot', cell, b));
        const pos = slots.find((p) => !taken.has(`${cell}:${p}`));
        if (!pos) continue;
        taken.add(`${cell}:${pos}`);
        out.push({ anchor: cell, structure: plaza.id, key: pos, data: { pos, index: i, count, plaza: plaza.id, spot, perch: perches[i]?.id ?? '' } });
      }
    }
    return out;
  },
  apply(c, out) {
    const d = c.data;
    out.actor({ type: 'pigeon', at: { cell: c.anchor, pos: d.pos }, params: { index: d.index, count: d.count, plaza: d.plaza, spot: d.spot, perch: d.perch } });
  },
});
