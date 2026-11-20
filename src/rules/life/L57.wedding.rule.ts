// L57 · tier 2 · A wedding at the chapel (discovery LF-01). A chapel (R-H01)
// whose door opens onto the walking graph with a square (else a street)
// within WEDDING_REACH steps that can be walked to → posts `wedding|door|`
// outside its door (facing it) and `wedding|square|` at the middle of that
// square or street. The chapel nearest the town's heart, if there are
// several. src/life/town/chains/wedding.ts holds the wedding once a day.

import { keyX, keyZ, type CellKey } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { plazas } from '@/resolve/facts/plazas.fact';
import { streets } from '@/resolve/facts/streets.fact';
import { navOf, steps } from './people.lib';
import { byNearness, doorPlace, heartOf, joined, type Place } from './town.lib';

export const WEDDING_REACH = 12;

export default defineRule<{ role: 'door' | 'square'; place: Place | null }>({
  id: 'L57.wedding',
  part: 'life',
  tier: 2,
  priority: 430,
  townWide: true,
  about: 'Reads: chapels, squares, streets, the walking graph. Emits: errand sockets wedding|door outside the chapel and wedding|square where the procession goes.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const chapels = [...ctx.facts.structures.values()]
      .filter((s) => ctx.plan.roles.get(s.id)?.role === 'chapel')
      .map((s) => doorPlace(nav, s.id))
      .filter((p): p is Place => p !== null);
    if (chapels.length === 0) return [];
    const heart = heartOf(ctx) ?? chapels[0]!.cell;
    for (const chapel of byNearness(heart, chapels)) {
      const middles: { cell: CellKey; square: boolean }[] = [
        ...plazas(ctx.facts).list.flatMap((p) => {
          // The walkable cell nearest the middle of the square, within reach of the chapel.
          const mx = p.cells.reduce((n, c) => n + keyX(c), 0) / p.cells.length, mz = p.cells.reduce((n, c) => n + keyZ(c), 0) / p.cells.length;
          const best = p.cells.filter((c) => nav.nodeAt.has(c) && !nav.nodes[nav.nodeAt.get(c)!]!.clutter && steps(c, chapel.cell) <= WEDDING_REACH).sort((a, b) => Math.hypot(keyX(a) - mx, keyZ(a) - mz) - Math.hypot(keyX(b) - mx, keyZ(b) - mz) || a - b)[0];
          return best !== undefined ? [{ cell: best, square: true }] : [];
        }),
        ...streets(ctx.facts).list.map((s) => ({ cell: s.cells[s.cells.length >> 1]!, square: false })),
      ].filter((m) => nav.nodeAt.has(m.cell) && m.cell !== chapel.cell && steps(m.cell, chapel.cell) <= WEDDING_REACH && joined(nav, m.cell, chapel.cell));
      const to = middles.sort((a, b) => Number(b.square) - Number(a.square) || steps(a.cell, chapel.cell) - steps(b.cell, chapel.cell) || a.cell - b.cell)[0];
      if (!to) continue;
      return [
        { anchor: chapel.cell, key: 'door', data: { role: 'door', place: chapel } },
        { anchor: to.cell, key: 'square', data: { role: 'square', place: null } },
      ] satisfies Candidate<{ role: 'door' | 'square'; place: Place | null }>[];
    }
    return [];
  },
  apply(c, out) {
    const p = c.data.place;
    out.socket({ id: `L57.wedding@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, ...(p ? { dir: p.dir, structure: p.structure } : {}), name: `wedding|${c.data.role}|` });
  },
});
