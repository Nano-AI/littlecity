// L15 · tier 3 · Characters: doves at a dovecote (three at each dovecote
// perch); a stork on its nest on the tip of the tallest tower that has no
// weathervane; an owl at night on the observatory's tip, or else on the
// tallest tree; a duck with ducklings on sheltered water of 4+ cells; a crow
// on every scarecrow. src/life/birds/characters.behaviour.ts gives each its
// ways.

import { CELL_H, keyY, type CellKey } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { featuresOfType, socketsOfType } from '@/resolve/facts/plan-index.fact';
import { shelteredWater } from '@/resolve/facts/sheltered-water.fact';
import type { Anchor } from '@/resolve/plan';

type Kind = 'dove' | 'stork' | 'owl' | 'crow' | 'duck';
type Data = { kind: Kind; at: Anchor; height: number };

/** How high over its cell a one-cell tree's crown top is, by role (an owl sits there). */
const CROWN: Record<string, number> = { 'palm': 1.15, 'willow': 0.8, 'pine': 0.95, 'fruit-tree': 0.65, 'grove-tree': 0.75, 'round-tree': 0.75, 'cypress': 0.95 };

export default defineRule<Data>({
  id: 'L15.characters',
  part: 'life',
  tier: 3,
  priority: 850,
  townWide: true,
  about: 'Reads: dovecote perches, tower tips and their vanes, the observatory, trees, sheltered water, scarecrows. Emits: doves, a stork, an owl, a duck, crows.',
  find({ facts, plan, dressing }) {
    const out: { anchor: CellKey; key: string; data: Data }[] = [];
    const add = (anchor: CellKey, key: string, data: Data): void => void out.push({ anchor, key, data });
    // Doves: at each dovecote's perch.
    for (const s of socketsOfType(facts, 'perch')) {
      if (s.structure === undefined || plan.roles.get(s.structure)?.role !== 'dovecote') continue;
      for (let i = 0; i < 3; i++) add(s.cell, `dove:${s.id}:${i}`, { kind: 'dove', at: { socket: s.id }, height: 0 });
    }
    // The stork: the tip of the tallest tower that carries no weathervane (not the dovecote, not the observatory).
    const vaned = new Set((dressing?.actors ?? []).filter((a) => a.type === 'weathervane' && a.at && 'socket' in a.at).map((a) => (a.at as { socket: string }).socket));
    let nest: { id: string; cell: CellKey } | null = null;
    for (const s of socketsOfType(facts, 'tower-top')) {
      const role = s.structure === undefined ? undefined : plan.roles.get(s.structure)?.role;
      if (vaned.has(s.id) || role === 'dovecote' || role === 'observatory') continue;
      if (!nest || keyY(s.cell) > keyY(nest.cell) || (keyY(s.cell) === keyY(nest.cell) && s.id < nest.id)) nest = { id: s.id, cell: s.cell };
    }
    if (nest) add(nest.cell, 'stork', { kind: 'stork', at: { socket: nest.id }, height: 0 });
    // The owl: the observatory's tip, else the tallest tree.
    const tip = socketsOfType(facts, 'tower-top').find((s) => s.structure !== undefined && plan.roles.get(s.structure)?.role === 'observatory');
    if (tip) add(tip.cell, 'owl', { kind: 'owl', at: { socket: tip.id }, height: 0 });
    else {
      let best: { cell: CellKey; top: number } | null = null;
      for (const s of plan.structures.values()) {
        const crown = CROWN[plan.roles.get(s.id)?.role ?? ''];
        if (s.kind !== 'tree' || crown === undefined || s.cells.length === 0) continue;
        const top = keyY(s.cells[0]!) * CELL_H + (s.cells.length - 1) * CELL_H + crown;
        if (!best || top > best.top + 1e-9) best = { cell: s.cells[0]!, top };
      }
      if (best) add(best.cell, 'owl', { kind: 'owl', at: { cell: best.cell, pos: 'c' }, height: Math.round((best.top - keyY(best.cell) * CELL_H) * 100) / 100 });
    }
    // The duck: in the middle of the sheltered water, if there is room.
    const water = shelteredWater(facts).cells;
    if (water.length >= 4) {
      const c = water[Math.floor(water.length / 2)]!;
      add(c, 'duck', { kind: 'duck', at: { cell: c, pos: 'c' }, height: 0 });
    }
    // Crows: on every scarecrow.
    for (const f of featuresOfType(facts, 'garden-piece')) {
      if (f.variant !== 'scarecrow' || f.cell === undefined) continue;
      add(f.cell, `crow:${f.id}`, { kind: 'crow', at: { cell: f.cell, pos: 'c' }, height: 0.62 });
    }
    return out;
  },
  apply(c, out) {
    out.actor({ type: 'small-bird', variant: c.data.kind, at: c.data.at, params: { height: c.data.height } });
  },
});
