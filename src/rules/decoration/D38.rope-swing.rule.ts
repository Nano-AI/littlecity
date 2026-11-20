// D38 · tier 3 · Rope swing from a riverside willow (discovery round 1, DC-06).
//
// A willow over a river always has a rope swing. A willow (R-P01) on the
// ground with river water right beside it gets, p = DEPTH.ropeSwing (0.4), a
// rope swing from a long bough out over the water, on that side. River water:
// open water with land again within 3 cells straight across (an opposite
// bank), so a channel 1 to 3 wide.
// Must not: a willow by the sea or a lagoon (no bank across within 3); a tree
// that already has D32's swing (they share its claim).
// The seat is a 'seat' socket: children (the life builder's) can swing.
//
// Stability: the roll and the side are the tree's own.
//
// Reads: tree roles (willow), open water, terrain. Claims: the tree's swing
// slot (shared with D32).

import { CELL_H, DIR4, keyX, keyY, keyZ, SEA_Y, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { openWater } from '@/resolve/facts/lib';
import { heightAt, lucky, onGround } from './lib';

const RULE = 'D38.rope-swing';
const CHANCE = 0.4;
const ACROSS = 3;

export default defineRule<{ face: Dir4 }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 620,
  about: 'Reads: willows (tree roles), open water and the bank across it. Claims: the tree’s swing slot (shared with D32).',
  find({ facts, plan, seed }) {
    const out: Candidate<{ face: Dir4 }>[] = [];
    for (const [id, { role }] of plan.roles) {
      if (role !== 'willow') continue;
      const s = facts.structures.get(id);
      const t = s?.cells[0];
      if (t === undefined || !onGround(facts, t) || !lucky(seed, RULE, t, 'swing', CHANCE)) continue;
      const start = hash(seed, RULE, 'side', t) % 4;
      for (let k = 0; k < 4; k++) {
        const d = ((start + k) % 4) as Dir4;
        const [dx, dz] = DIR4[d]!;
        const x = keyX(t) + dx, z = keyZ(t) + dz;
        if (!openWater(facts, x, z)) continue;
        // A bank across: land within ACROSS cells straight on.
        let bank = false;
        for (let j = 1; j <= ACROSS; j++) if (heightAt(facts, x + dx * j, z + dz * j) > 0) bank = true;
        if (!bank) continue;
        out.push({ anchor: t as CellKey, data: { face: d } });
        break;
      }
    }
    return out.sort((a, b) => a.anchor - b.anchor);
  },
  claims: (c) => [slot.custom('D32.under-the-trees', 'swing', c.anchor)],
  apply(c, out, { rand }) {
    const id = out.prop({ type: 'swing', variant: 'rope', at: { cell: c.anchor, pos: 'c', face: c.data.face }, params: { look: Math.floor(rand('look') * 1000), drop: Math.max(0, keyY(c.anchor) * CELL_H - SEA_Y) } });
    out.socket({ type: 'seat', owner: id, name: 'seat', cell: c.anchor, dir: c.data.face });
  },
});
