// L34 · tier 3 · Grazers. Wild grass of 30+ cells at least 4 cells from any
// structure is a meadow: 2–5 sheep graze it (2 + one per 40 meadow cells),
// wandering and hopping between terraces (src/life/small/sheep.behaviour.ts).
// And chickens by a vegetable patch beside a cottage: two by each patch
// (chance 0.7), at most 8 in town. The paddock's standing grazers (U02) are
// props; src/life/small/grazer.behaviour.ts gives them a little life.

import type { CellKey } from '@/core/grid';
import { keyX, keyZ } from '@/core/grid';
import { rand } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { distToStructure } from '@/resolve/facts/distance.fact';
import { wildGrass } from '@/resolve/facts/grass.fact';
import type { Facts } from '@/resolve/facts/api';

/** Meadow: wild grass this far (columns) from any structure. */
export const MEADOW_CLEAR = 4;
export const MEADOW_MIN = 30;
const CHICKENS = 8;

/** The meadow cells of a town (ascending). Pure. */
export function meadowOf(facts: Facts): CellKey[] {
  const far = distToStructure(facts);
  return wildGrass(facts).cells.filter((c) => far.at(keyX(c), keyZ(c)) >= MEADOW_CLEAR);
}

type Data = { kind: 'sheep' | 'chicken'; index: number };

export default defineRule<Data>({
  id: 'L34.grazers',
  part: 'life',
  tier: 3,
  priority: 660,
  about: 'Reads: wild grass far from structures, veg-patch props. Emits: 2–5 sheep on a meadow of 30+ cells; two chickens by a vegetable patch (at most 8).',
  find({ facts, dressing, seed }) {
    const out: { anchor: CellKey; key: string; data: Data }[] = [];
    const meadow = meadowOf(facts);
    if (meadow.length >= MEADOW_MIN) {
      const n = Math.min(5, 2 + Math.floor(meadow.length / 40));
      for (let i = 0; i < n; i++) out.push({ anchor: meadow[Math.floor(((i + 0.5) * meadow.length) / n)]!, key: `s${i}`, data: { kind: 'sheep', index: i } });
    }
    let hens = 0;
    for (const p of dressing?.props ?? []) {
      if (p.type !== 'veg-patch' || !('cell' in p.at) || hens >= CHICKENS) continue;
      if (rand(seed, 'L34', 'hens', p.id) >= 0.7) continue;
      for (let i = 0; i < 2 && hens < CHICKENS; i++, hens++) out.push({ anchor: p.at.cell, key: `c${p.id}:${i}`, data: { kind: 'chicken', index: i } });
    }
    return out;
  },
  apply(c, out, ctx) {
    const look = Math.floor(ctx.rand('look') * 6);
    if (c.data.kind === 'sheep') out.actor({ type: 'sheep', at: { cell: c.anchor, pos: 'c' }, params: { look } });
    else out.actor({ type: 'chicken', at: { cell: c.anchor, pos: c.data.index === 0 ? 'ne' : 'sw' }, params: { look } });
  },
});
