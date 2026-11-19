// D26 · tier 3 · Fingerpost. Half the street junctions with three or more
// branches (DEPTH.fingerpost) get a white fingerpost on a free corner of the
// junction cell, with an arm down each branch. Each arm carries a little
// picture of what lies that way within a dozen cells: the sea, a church, the
// hills, or (none of those) the town.
//
// Stability: the roll is the junction's own; the pictures read the dozen
// cells down each branch, which is the fingerpost's whole subject.
//
// Reads: streets (junctions, links), roles (chapels, steeples), open water,
// terrain heights, clearways. Claims: the corner slot it stands on.

import { DIR4, keyX, keyY, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { openWater } from '@/resolve/facts/lib';
import { streets } from '@/resolve/facts/streets.fact';
import type { CellPos } from '@/resolve/plan';
import { DEPTH } from '@/style/depth';
import { clearways } from './clearways.fact';
import { heightAt, lucky } from './lib';

const RULE = 'D26.fingerpost';
const CORNERS: readonly CellPos[] = ['se', 'sw', 'ne', 'nw'];
const LOOK = 12;

export default defineRule<{ cell: CellKey; pos: CellPos; mask: number; signs: number }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 740,
  about: 'Reads: street junctions and their branches, chapels and steeples, open water, terrain, clearways. Claims: the corner slot of the junction cell the post stands on.',
  find({ facts, plan, seed }) {
    const clear = clearways(facts);
    // Columns holding a church (a chapel or its steeple).
    const church = new Set<number>();
    for (const [id, { role }] of plan.roles) {
      if (role !== 'chapel' && role !== 'steeple') continue;
      for (const c of facts.structures.get(id)?.cells ?? []) church.add(keyX(c) + keyZ(c) * 64);
    }
    const out: Candidate<{ cell: CellKey; pos: CellPos; mask: number; signs: number }>[] = [];
    for (const street of streets(facts).list) {
      for (const j of street.junctions) {
        const links = street.links.get(j) ?? [];
        if (links.length < 3 || !lucky(seed, RULE, j, 'post', DEPTH.fingerpost)) continue;
        const pos = CORNERS.find((p) => clear.free(j, p) && clear.headroom(j, p));
        if (!pos) continue;
        let mask = 0, signs = 0;
        for (const { dir } of links) {
          mask |= 1 << dir;
          signs |= sign(j, dir) << (dir * 2);
        }
        out.push({ anchor: j, key: 'post', data: { cell: j, pos, mask, signs } });
      }
    }
    return out;

    /** What lies down a branch: 1 the sea, 2 a church, 3 the hills, 0 the town. */
    function sign(from: CellKey, d: Dir4): number {
      const [dx, dz] = DIR4[d]!;
      const x0 = keyX(from), z0 = keyZ(from), y0 = keyY(from);
      for (let k = 1; k <= LOOK; k++) {
        const x = x0 + dx * k, z = z0 + dz * k;
        if (church.has(x + z * 64)) return 2;
        if (openWater(facts, x, z)) return 1;
        if (heightAt(facts, x, z) >= y0 + 2) return 3;
      }
      return 0;
    }
  },
  claims: (c) => [slot.floor(c.data.cell, c.data.pos)],
  apply(c, out, ctx) {
    const post = out.prop({ type: 'fingerpost', at: { cell: c.data.cell, pos: c.data.pos, face: 2 }, params: { mask: c.data.mask, signs: c.data.signs, look: Math.floor(ctx.rand('look') * 1000) } });
    out.socket({ type: 'perch', owner: post, cell: c.data.cell });
  },
});
