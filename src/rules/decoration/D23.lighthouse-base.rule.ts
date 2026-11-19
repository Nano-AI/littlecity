// D23 · tier 2 · Lighthouse base.
//
//   a fog bell   in a little timber frame on the ground beside every
//                lighthouse, on the side toward the water if it has one
//   rocks        where the lighthouse stands on the waterfront: two or three
//                big boulders tumbled at the water's edge round its foot
//
// Stability: depends on the lighthouse's foot and the eight columns round it.
//
// Reads: lighthouse structures (lowest cells), terrain heights, open water,
// clearways. Claims: the slot of the bell and of each rock.

import { DIR4, key, keyX, keyY, keyZ, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { DIRS, openWater } from '@/resolve/facts/lib';
import type { CellPos } from '@/resolve/plan';
import { emit, type Placed } from '../urban/plots';
import { clearways, cornersOn, edgePos } from './clearways.fact';
import { heightAt } from './lib';

const RULE = 'D23.lighthouse-base';

export default defineRule<Placed>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 770,
  about: 'Reads: lighthouses (their lowest cells), terrain, open water, clearways. Claims: the slot of the fog bell and of each rock.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<Placed>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'lighthouse') continue;
      let foot = s.cells[0]!;
      for (const c of s.cells) if (keyY(c) < keyY(foot)) foot = c;
      const x = keyX(foot), z = keyZ(foot);
      // The ground cells beside the foot, with whether open water lies beyond each.
      const beside: { cell: CellKey; d: Dir4; wet: boolean }[] = [];
      for (const d of DIRS) {
        const [dx, dz] = DIR4[d]!;
        const h = heightAt(facts, x + dx, z + dz);
        if (h <= 0 || h !== keyY(foot)) continue;
        const cell = key(x + dx, h, z + dz);
        const wet = DIRS.some((e) => openWater(facts, x + dx + DIR4[e]![0], z + dz + DIR4[e]![1]));
        beside.push({ cell, d, wet });
      }
      const look = hash(seed, RULE, foot) % 1000;
      // The bell: toward the water if it can be, in the middle of that cell.
      const order = [...beside].sort((a, b) => Number(b.wet) - Number(a.wet) || a.d - b.d);
      const bell = order.find((b) => clear.free(b.cell, 'c') && clear.headroom(b.cell, 'c'));
      if (bell) out.push({ anchor: bell.cell, structure: s.id, key: 'bell', data: { type: 'fog-bell', cell: bell.cell, pos: 'c', face: bell.d, params: { look } } });
      // Rocks at the water's edge round the foot: a tumble of big boulders on the water side.
      let rocks = 0;
      for (const b of beside) {
        if (!b.wet) continue;
        for (const e of DIRS) {
          if (e === opposite(b.d)) continue;
          const [ex, ez] = DIR4[e]!;
          if (!openWater(facts, keyX(b.cell) + ex, keyZ(b.cell) + ez)) continue;
          for (const pos of [edgePos(e), ...cornersOn(e)] as CellPos[]) {
            if (rocks >= 4 || !clear.free(b.cell, pos) || (bell && bell.cell === b.cell && pos === 'c')) continue;
            out.push({ anchor: b.cell, structure: s.id, key: `rock${pos}`, data: { type: 'boulder', cell: b.cell, pos, params: { size: 0.8 + (hash(seed, RULE, b.cell, pos) % 20) / 100, look: hash(seed, RULE, 'r', b.cell, pos) % 1000 } } });
            rocks++;
          }
        }
      }
    }
    return out;
  },
  claims: (c) => [slot.floor(c.data.cell, c.data.pos)],
  apply: (c, out) => emit(out, [c.data]),
});
