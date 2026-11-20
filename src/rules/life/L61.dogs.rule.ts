// L61 · tier 3 · Dogs. One dog for every 6 house structures, at most
// DOGS_MAX: the houses taken in order of their front door's cell, every
// sixth from the fourth (so they are not the cats' houses, L33). Post
// `dog|home|<coat>` outside the door, `structure` the house; its people are
// the dog's. src/life/town/chains/dogs.ts walks it.

import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { homes, navOf } from './people.lib';
import { doorPlace, type Place } from './town.lib';

export const DOGS_MAX = 3;

export default defineRule<Place & { coat: number }>({
  id: 'L61.dogs',
  part: 'life',
  tier: 3,
  priority: 390,
  townWide: true,
  about: 'Reads: houses and their doors, the walking graph. Emits: an errand socket dog|home outside the door of every sixth house, at most 3.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const doors = homes(ctx)
      .map((s) => doorPlace(nav, s.id))
      .filter((p): p is Place => p !== null)
      .sort((a, b) => a.cell - b.cell || a.structure - b.structure);
    const n = Math.min(DOGS_MAX, Math.floor(doors.length / 6));
    const out: Candidate<Place & { coat: number }>[] = [];
    for (let i = 0; i < n; i++) {
      const d = doors[i * 6 + 3] ?? doors[i * 6]!;
      out.push({ anchor: d.cell, key: `dog${d.structure}`, data: { ...d, coat: hash(ctx.seed, 'dog', d.structure) % 4 } });
    }
    return out;
  },
  apply(c, out) {
    const d = c.data;
    out.socket({ id: `L61.dogs@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, dir: d.dir, structure: d.structure, name: `dog|home|${d.coat}` });
  },
});
