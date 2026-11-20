// D36 · tier 3 · Wayside shrine (discovery round 1, DC-01).
//
// A country crossroads carries a cross or a little shrine with flowers. A
// street junction (the streets fact: three or more ways out) with no
// building, square, stall or fountain within 4 gets, on a free corner of the
// junction cell, a stone calvary on stepped stones or a roofed niche on a
// post (seeded), with fresh flowers. It runs before D26, so the fingerpost
// still stands beside it on another corner.
// Must not: a junction in town (anything built within 4, the countryside
// fact's frontage), on a bridge or a pier (not on the ground), in the
// walking line (corners only).
//
// Stability: seeded by the junction's own cell.
//
// Reads: streets (junctions), countryside (frontage), clearways. Claims: the
// corner slot it stands on.

import { keyX, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { streets } from '@/resolve/facts/streets.fact';
import type { CellPos } from '@/resolve/plan';
import { countryside } from '../urban/countryside.fact';
import { clearways } from './clearways.fact';
import { onGround } from './lib';

const RULE = 'D36.wayside-shrine';
const CLEAR = 4;
const CORNERS: readonly [CellPos, Dir4][] = [['nw', 2], ['ne', 2], ['sw', 0], ['se', 0]];

export default defineRule<{ pos: CellPos; face: Dir4 }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 745,
  about: 'Reads: street junctions, countryside (nothing built within 4), clearways. Claims: the corner slot of the junction cell it stands on.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const country = countryside(facts);
    const out: Candidate<{ pos: CellPos; face: Dir4 }>[] = [];
    for (const street of streets(facts).list) {
      for (const j of street.junctions) {
        if ((street.branches.get(j)?.length ?? 0) < 3 || !onGround(facts, j)) continue;
        if (country.frontage(keyX(j), keyZ(j)) <= CLEAR) continue;
        const start = hash(seed, RULE, 'corner', j) % 4;
        for (let k = 0; k < 4; k++) {
          const [pos, face] = CORNERS[(start + k) % 4]!;
          if (clear.free(j, pos) && clear.headroom(j, pos)) {
            out.push({ anchor: j, data: { pos, face } });
            break;
          }
        }
      }
    }
    return out;
  },
  claims: (c) => [slot.floor(c.anchor, c.data.pos)],
  apply(c, out, { rand }) {
    out.prop({ type: 'wayside-shrine', variant: rand('kind') < 0.55 ? 'calvary' : 'niche', at: { cell: c.anchor as CellKey, pos: c.data.pos, face: c.data.face }, params: { look: Math.floor(rand('look') * 1000) } });
  },
});
