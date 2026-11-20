// L59 · tier 2 · The harvest. Every wheat field (R-G01) gets its cells that
// can be walked in as posts `harvest|field|<field id>` (at most
// HARVEST_CELLS, in seeded order), and, if a windmill can be walked to from
// it, the post `harvest|mill|<field id>` outside the nearest windmill's door.
// src/life/town/chains/harvest.ts cuts the field in late summer and autumn
// and carries the sheaves to the mill, where the miller (L51) takes them in.

import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { navOf, steps } from './people.lib';
import { doorPlace, joined, type Place } from './town.lib';

export const HARVEST_CELLS = 12;

interface Data {
  role: 'field' | 'mill';
  field: number;
  place: Place | null;
}

export default defineRule<Data>({
  id: 'L59.harvest',
  part: 'life',
  tier: 2,
  priority: 410,
  townWide: true,
  about: 'Reads: wheat fields, windmills, the walking graph. Emits: errand sockets harvest|field on the field’s cells and harvest|mill at the nearest windmill’s door.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const { facts, plan, seed } = ctx;
    const all = [...facts.structures.values()].sort((a, b) => a.id - b.id);
    const mills = all.filter((s) => s.kind === 'windmill').map((s) => doorPlace(nav, s.id)).filter((p): p is Place => p !== null);
    const out: Candidate<Data>[] = [];
    for (const f of all) {
      if (plan.roles.get(f.id)?.role !== 'wheat-field') continue;
      const cells = f.cells.filter((c) => nav.nodeAt.has(c)).sort((a, b) => hash(seed, 'harvest', a) - hash(seed, 'harvest', b) || a - b).slice(0, HARVEST_CELLS);
      if (cells.length === 0) continue;
      for (const c of cells) out.push({ anchor: c, key: `field:${f.id}:${c}`, data: { role: 'field', field: f.id, place: null } });
      const mill = mills.filter((m) => joined(nav, m.cell, cells[0]!)).sort((a, b) => steps(a.cell, cells[0]!) - steps(b.cell, cells[0]!) || a.cell - b.cell)[0];
      if (mill) out.push({ anchor: mill.cell, key: `mill:${f.id}`, data: { role: 'mill', field: f.id, place: mill } });
    }
    return out;
  },
  apply(c, out) {
    const d = c.data;
    out.socket({ type: 'errand', cell: c.anchor, ...(d.place ? { dir: d.place.dir, structure: d.place.structure } : { structure: d.field }), name: `harvest|${d.role}|${d.field}` });
  },
});
