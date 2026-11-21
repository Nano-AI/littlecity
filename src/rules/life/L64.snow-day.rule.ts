// L64 · tier 2 · A snow day. The town's biggest square (else its longest
// street) → posts where the children build a snowman and fight it out with
// snowballs: `snow|man|` at the free cell nearest its middle (two steps or
// more from the festival's snowman, D35, if it has one), and `snow|side|a`,
// `snow|side|b` two cells either side of it along the square's (or street's)
// longer way, each facing the snowman: the two sides of the snowball fight.
// src/life/town/chains/snow-day.ts holds the snow days.

import { DIR4, key, keyX, keyY, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { plazas } from '@/resolve/facts/plazas.fact';
import { streets } from '@/resolve/facts/streets.fact';
import { joined } from './town.lib';
import { navOf, steps } from './people.lib';

type Data = { role: 'man' | 'side'; side: string; dir: Dir4 | undefined };

export default defineRule<Data>({
  id: 'L64.snow-day',
  part: 'life',
  tier: 2,
  priority: 415,
  townWide: true,
  about: 'Reads: squares, streets, the walking graph, the festival snowman. Emits: errand sockets snow|man in the middle of the biggest square and snow|side either side of it.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const free = (c: CellKey): boolean => {
      const n = nav.nodeAt.get(c);
      return n !== undefined && !nav.nodes[n]!.clutter && nav.nodes[n]!.rot === undefined && nav.nodes[n]!.passage === undefined;
    };
    // Kept clear of the festival's snowman.
    const sockets = new Map([...ctx.plan.sockets, ...(ctx.dressing?.sockets ?? [])].map((s) => [s.id, s]));
    const festive: CellKey[] = [];
    for (const p of ctx.dressing?.props ?? []) {
      if (p.type !== 'snowman') continue;
      const at = p.at as { cell?: CellKey; socket?: string };
      const cell = at.cell ?? (at.socket ? sockets.get(at.socket)?.cell : undefined);
      if (cell !== undefined) festive.push(cell);
    }
    const clear = (c: CellKey): boolean => free(c) && festive.every((f) => steps(f, c) >= 2);
    // Where: the biggest square, else the longest street.
    const places: { cells: readonly CellKey[]; alongX: boolean; mx: number; mz: number }[] = [];
    for (const p of [...plazas(ctx.facts).list].sort((a, b) => b.area - a.area || a.id - b.id)) {
      const mx = p.cells.reduce((n, c) => n + keyX(c), 0) / p.cells.length, mz = p.cells.reduce((n, c) => n + keyZ(c), 0) / p.cells.length;
      places.push({ cells: p.cells, alongX: p.box.x1 - p.box.x0 >= p.box.z1 - p.box.z0, mx, mz });
    }
    for (const s of [...streets(ctx.facts).list].sort((a, b) => b.length - a.length || a.id - b.id)) {
      const mid = s.cells[s.cells.length >> 1]!;
      const xs = s.cells.map(keyX), zs = s.cells.map(keyZ);
      places.push({ cells: s.cells, alongX: Math.max(...xs) - Math.min(...xs) >= Math.max(...zs) - Math.min(...zs), mx: keyX(mid), mz: keyZ(mid) });
    }
    for (const place of places) {
      const near = [...place.cells].filter(clear).sort((a, b) => Math.hypot(keyX(a) - place.mx, keyZ(a) - place.mz) - Math.hypot(keyX(b) - place.mx, keyZ(b) - place.mz) || a - b);
      for (const man of near.slice(0, 6)) {
        const sideAt = (s: number): CellKey | null => {
          for (const k of [2, 3, 1]) {
            for (const dy of [0, 1, -1]) {
              const c = place.alongX ? key(keyX(man) + s * k, keyY(man) + dy, keyZ(man)) : key(keyX(man), keyY(man) + dy, keyZ(man) + s * k);
              if (clear(c) && joined(nav, c, man)) return c;
            }
          }
          return null;
        };
        const a = sideAt(-1), b = sideAt(1);
        if (a === null || b === null) continue;
        const face = (c: CellKey): Dir4 => {
          const dx = Math.sign(keyX(man) - keyX(c)), dz = Math.sign(keyZ(man) - keyZ(c));
          return DIR4.findIndex(([x, z]) => x === dx && z === dz) as Dir4;
        };
        return [
          { anchor: man, key: 'man', data: { role: 'man', side: '', dir: undefined } },
          { anchor: a, key: 'a', data: { role: 'side', side: 'a', dir: face(a) } },
          { anchor: b, key: 'b', data: { role: 'side', side: 'b', dir: face(b) } },
        ] satisfies Candidate<Data>[];
      }
    }
    return [];
  },
  apply(c, out) {
    out.socket({ id: `L64.snow-day@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, ...(c.data.dir !== undefined ? { dir: c.data.dir } : {}), name: `snow|${c.data.role}|${c.data.side}` });
  },
});
