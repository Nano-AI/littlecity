// L55 · tier 2 · The night watchman (discovery LF-05). A town of 12 or more
// house structures with no garrison (L36: its sentries keep the night) gets
// a beat: up to WATCH_BEATS cells, the middles of its squares and streets in
// the part of the walking graph round its heart, in the order one person
// walks them (from the heart, always on to the nearest not yet walked).
// Posts `watch|beat|<order>`. src/life/town/chains/watch.ts walks it.

import { defineRule, type Candidate } from '@/resolve/engine/api';
import { plazas } from '@/resolve/facts/plazas.fact';
import { streets } from '@/resolve/facts/streets.fact';
import type { CellKey } from '@/core/grid';
import { homes, navOf, steps } from './people.lib';
import { heartOf, joined } from './town.lib';

export const WATCH_BEATS = 8;
/** House structures a town needs before it keeps a watchman. */
export const WATCH_HOUSES = 12;

export default defineRule<{ order: number }>({
  id: 'L55.watchman',
  part: 'life',
  tier: 2,
  priority: 450,
  townWide: true,
  about: 'Reads: houses, squares, streets, the garrison (L36), the walking graph. Emits: errand sockets watch|beat in walking order.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav || homes(ctx).length < WATCH_HOUSES) return [];
    if ((ctx.dressing?.actors ?? []).some((a) => a.type === 'garrison')) return [];
    const heart = heartOf(ctx);
    if (heart === null || !nav.nodeAt.has(heart)) return [];
    const middles: CellKey[] = [];
    for (const p of plazas(ctx.facts).list) middles.push(p.cells[p.cells.length >> 1]!);
    for (const s of streets(ctx.facts).list) if (s.length >= 3) middles.push(s.cells[s.cells.length >> 1]!);
    let left = [...new Set(middles)].filter((c) => nav.nodeAt.has(c) && joined(nav, c, heart)).sort((a, b) => steps(a, heart) - steps(b, heart) || a - b);
    left = left.slice(0, WATCH_BEATS);
    if (left.length < 2) return [];
    const round: CellKey[] = [left.shift()!];
    while (left.length > 0) {
      const from = round[round.length - 1]!;
      let best = 0;
      for (let i = 1; i < left.length; i++) if (steps(from, left[i]!) < steps(from, left[best]!) || (steps(from, left[i]!) === steps(from, left[best]!) && left[i]! < left[best]!)) best = i;
      round.push(left.splice(best, 1)[0]!);
    }
    return round.map((cell, order): Candidate<{ order: number }> => ({ anchor: cell, key: `beat${order}`, data: { order } }));
  },
  apply(c, out) {
    out.socket({ id: `L55.watchman@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, name: `watch|beat|${c.data.order}` });
  },
});
