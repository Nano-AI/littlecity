// D26 · tier 3 · Fingerpost. Half the street junctions with three or more
// branches (DEPTH.fingerpost) get a white fingerpost on a free corner of the
// junction cell, with an arm down each branch. Each arm carries a little
// picture of what lies that way within a dozen cells: the sea, a church, the
// hills, or (none of those) the town.
//
// A junction is the streets fact's: one cell per real junction, so a two-wide
// street is not a row of junctions (FX-03). Not at the mouth of a square (a
// junction within 1 of a plaza), and no two posts within FINGERPOST_GAP
// column steps: the one with the lower seeded rank wins.
//
// Stability: the roll is the junction's own; the pictures read the dozen
// cells down each branch, which is the fingerpost's whole subject; a post is
// displaced only by a better-ranked junction within FINGERPOST_GAP.
//
// Reads: streets (junctions, links), roles (chapels, steeples), open water,
// terrain heights, clearways. Claims: the corner slot it stands on.

import { DIR4, keyX, keyY, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { openWater } from '@/resolve/facts/lib';
import { plazas } from '@/resolve/facts/plazas.fact';
import { streets } from '@/resolve/facts/streets.fact';
import type { CellPos } from '@/resolve/plan';
import { DEPTH } from '@/style/depth';
import { clearways } from './clearways.fact';
import { columnSteps, heightAt, lucky } from './lib';

const RULE = 'D26.fingerpost';
const CORNERS: readonly CellPos[] = ['se', 'sw', 'ne', 'nw'];
const LOOK = 12;
/** Fewest column steps between two fingerposts. */
const FINGERPOST_GAP = 8;

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
    const plazaCols = new Set<number>();
    for (const p of plazas(facts).list) for (const c of p.cells) plazaCols.add(keyX(c) + keyZ(c) * 64);
    const nearPlaza = (c: CellKey): boolean => [[0, 0], ...DIR4].some(([dx, dz]) => plazaCols.has(keyX(c) + dx! + (keyZ(c) + dz!) * 64));
    const lucky1: { j: CellKey; dirs: readonly Dir4[]; rank: number }[] = [];
    for (const street of streets(facts).list) {
      for (const j of street.junctions) {
        const dirs = street.branches.get(j) ?? [];
        // A real junction (three ways out), not at the mouth of a square (the square is the sign).
        if (dirs.length < 3 || nearPlaza(j) || !lucky(seed, RULE, j, 'post', DEPTH.fingerpost)) continue;
        lucky1.push({ j, dirs, rank: hash(seed, RULE, j, 'rank') });
      }
    }
    // None within sight of another: the town's posts keep FINGERPOST_GAP apart. Ranked by their own
    // seeded roll, so a new junction can only displace a post near it.
    lucky1.sort((a, b) => a.rank - b.rank || a.j - b.j);
    const kept: CellKey[] = [];
    const out: Candidate<{ cell: CellKey; pos: CellPos; mask: number; signs: number }>[] = [];
    for (const { j, dirs } of lucky1) {
      if (kept.some((k) => columnSteps(k, j) < FINGERPOST_GAP)) continue;
      const pos = CORNERS.find((p) => clear.free(j, p) && clear.headroom(j, p));
      if (!pos) continue;
      let mask = 0, signs = 0;
      for (const dir of dirs) {
        mask |= 1 << dir;
        signs |= sign(j, dir) << (dir * 2);
      }
      kept.push(j);
      out.push({ anchor: j, key: 'post', data: { cell: j, pos, mask, signs } });
    }
    return out.sort((a, b) => a.anchor - b.anchor);

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
