// U23 · tier 2 · Belvedere garden on a bare podium (discovery round 1, UF-11).
//
// A big raised platform with nothing on it is, in any real town, a terrace
// garden. A marble terrace (R-M07) with 9 or more walkable top cells, its top
// 2 or more levels above the ground at its foot, and nothing at all on top
// (no floor, no piece) gets potted citrus trees on a grid (every other cell
// of its inner cells) and in a row along the parapet, a pergola with a table
// at its middle, and benches looking out from the middle of its edges.
// Must not: a keep, a quay wall, a temple, a plinth (other roles), a house's
// roof terrace (houses are not marble), a terrace a player has started to
// furnish (a floor or a piece on top), a low one (it is a step, not a view).
//
// The way up (a derived external stair, walkable) is not built: it would add
// a walking-graph link, which is the life builder's (see the request note).
//
// Stability: depends only on the terrace's own top.
//
// Reads: roles (terrace), the terrace's top cells, clearways. Claims: the
// slots of its pots, pergola and benches.

import { columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { DIRS, standable } from '@/resolve/facts/lib';
import { clearways, edgePos } from '../decoration/clearways.fact';
import { claimsOf, emit, placer, type Placed } from './plots';

const RULE = 'U23.belvedere';
const MIN_TOP = 9;
const MIN_RISE = 2;

export default defineRule<Placed[]>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 770,
  about: 'Reads: marble terraces (role), their top cells, the ground at their foot, clearways. Claims: the slots of its citrus pots, pergola and benches.',
  find({ facts, plan, seed }) {
    const clear = clearways(facts);
    const out: Candidate<Placed[]>[] = [];
    for (const [id, { role }] of plan.roles) {
      if (role !== 'terrace') continue;
      const s = facts.structures.get(id);
      if (!s) continue;
      const top = new Map<number, CellKey>();
      for (const c of s.cells) {
        const col = columnIndex(keyX(c), keyZ(c));
        const t = top.get(col);
        if (t === undefined || keyY(c) > keyY(t)) top.set(col, c);
      }
      const tops: CellKey[] = [];
      let bare = true, rise = 99;
      for (const t of top.values()) {
        const up = t + (1 << 12);
        if (facts.kinds.has(up) || facts.world.floors.has(up)) bare = false;
        if (standable(facts, up)) tops.push(up);
        rise = Math.min(rise, keyY(up) - facts.terrain.height[columnIndex(keyX(t), keyZ(t))]!);
      }
      if (!bare || tops.length < MIN_TOP || rise < MIN_RISE) continue;
      tops.sort((a, b) => a - b);
      const set = new Set(tops);
      const p = placer((c, pos) => clear.free(c, pos));
      const look = (k: string, c: CellKey): number => hash(seed, RULE, k, c) % 1000;
      const inner = tops.filter((c) => DIRS.every((d) => set.has(neighbor(c, d))));
      const mx = tops.reduce((a, c) => a + keyX(c), 0) / tops.length, mz = tops.reduce((a, c) => a + keyZ(c), 0) / tops.length;
      const middle = [...(inner.length ? inner : tops)].sort((a, b) => Math.hypot(keyX(a) - mx, keyZ(a) - mz) - Math.hypot(keyX(b) - mx, keyZ(b) - mz) || a - b)[0]!;
      p.put({ type: 'pergola', cell: middle, pos: 'c', face: 2, seats: 2, params: { look: look('pergola', middle) } });
      for (const c of inner) {
        if (c === middle || (keyX(c) - keyX(middle)) % 2 !== 0 || (keyZ(c) - keyZ(middle)) % 2 !== 0) continue;
        p.put({ type: 'citrus-pot', cell: c, pos: 'c', face: 2, params: { look: look('pot', c) } });
      }
      // Benches looking out from the middle of each edge.
      for (const d of DIRS) {
        const edge = tops.filter((c) => !set.has(neighbor(c, d)));
        if (!edge.length) continue;
        const along = (c: CellKey): number => (d === 0 || d === 2 ? keyX(c) : keyZ(c));
        edge.sort((a, b) => along(a) - along(b));
        const c = edge[Math.floor(edge.length / 2)]!;
        if (neighbor(c, d) === NO_CELL) continue;
        p.put({ type: 'bench', variant: 'stone', cell: c, pos: edgePos(d), face: d, seats: 2, params: { look: look('bench', c) } });
      }
      // A row of potted trees along the parapet, every other cell.
      for (const c of tops) {
        const d = DIRS.find((e) => !set.has(neighbor(c, e)));
        if (d === undefined || (keyX(c) + keyZ(c)) % 2 !== 0) continue;
        p.put({ type: 'citrus-pot', cell: c, pos: edgePos(d), face: 2, params: { look: look('edge', c) } });
      }
      if (p.items.length) out.push({ anchor: tops[0]!, structure: id, data: p.items });
    }
    return out.sort((a, b) => a.anchor - b.anchor);
  },
  claims: (c) => claimsOf(c.data),
  apply: (c, out) => emit(out, c.data),
});
