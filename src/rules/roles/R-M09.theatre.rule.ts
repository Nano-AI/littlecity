// R-M09 · Theatre (RC-07). A marble mass that is all tiers of seats facing
// one way onto a level floor is a theatre:
//
//   R-M04's shape cuts 2 or more rows of it into steps (with the uncut top
//   row that makes 3 tiers or more), one way downhill, 4 or more wide;
//   the top row leads nowhere: nothing stands or lies on it, and the ground
//   or block behind it is lower (it is the back of the cavea, not the head
//   of a stair up to a platform, a door or a path);
//   the stage: in front of the lowest row (downhill, within 2) lie 4 or
//   more cells of plaza, or of open level ground with nothing on it;
//   3 or more of every 4 columns of the mass are steps or the top row (the
//   wings that step down at the ends are allowed: they are tiers too);
//   nothing of a castle touches it.
//
// Not: a stair that climbs to a platform (R-M04, R-M08), a keep.
//
// Draws: the steps as deep stone benches (the generator, by role), a stone
// balustrade along the back where it drops 2 or more; the stage dressing
// (a painted backdrop frame with two masks, braziers at its corners) is
// R-H98's. The seats R-M04 makes are where the audience sits.

import { above, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { columnCount, grandSteps } from './R-M04.steps';
import { castleBeside, podiumRails } from './R-M08.podium.rule';

export interface Theatre {
  /** Downhill: from the seats toward the stage. */
  facing: Dir4;
  /** The stage cells in front of the lowest row (floor level cells). */
  stage: CellKey[];
}

export function theatreOf(s: Structure, plan: ShapePlan): Theatre | null {
  if (s.kind !== 'marble' || s.cells.length < 8) return null;
  const steps = grandSteps(s, plan);
  if (steps.length < 8) return null;
  // One way downhill: the commonest direction, and it must be most of them.
  const count = [0, 0, 0, 0];
  for (const st of steps) count[st.dir]!++;
  const facing = count.indexOf(Math.max(...count)) as Dir4;
  if (count[facing]! * 4 < steps.length * 3) return null;
  const mine = new Set(s.cells);
  const top = new Map<number, CellKey>();
  for (const c of s.cells) {
    const col = columnIndex(keyX(c), keyZ(c));
    const t = top.get(col);
    if (t === undefined || keyY(c) > keyY(t)) top.set(col, c);
  }
  const levels = new Set([...top.values()].map(keyY));
  if (levels.size < 3) return null;
  const highest = Math.max(...levels);
  const rows = [...top.values()].filter((c) => keyY(c) === highest);
  // The top row is the back: nothing on it, and lower behind it.
  for (const c of rows) {
    const up = above(c);
    if (plan.kinds.has(up) || plan.world.floors.has(up)) return null;
    const behind = neighbor(c, opposite(facing));
    if (behind === NO_CELL) continue;
    const behindTop = top.get(columnIndex(keyX(behind), keyZ(behind)));
    if (behindTop !== undefined && keyY(behindTop) >= highest) return null;
    const ground = plan.terrain.height[columnIndex(keyX(behind), keyZ(behind))]!;
    if (ground > highest) return null;
    if (behindTop === undefined && plan.kinds.has(above(behind)) && ground === highest) return null;
  }
  // 4 or more wide: the widest row of steps facing that way.
  const widths = new Map<number, number>();
  for (const st of steps) {
    if (st.dir !== facing) continue;
    const line = facing === 0 || facing === 2 ? keyZ(st.cell) * 64 + keyY(st.cell) : keyX(st.cell) * 64 + keyY(st.cell);
    widths.set(line, (widths.get(line) ?? 0) + 1);
  }
  if (Math.max(0, ...widths.values()) < 4) return null;
  // Mostly tiers: 3 of every 4 columns stand one level above or below a neighbouring column of the mass
  // (a big level platform does not; wings stepping down at the ends do).
  let tiered = 0;
  for (const c of top.values()) {
    let step = false;
    for (let d = 0 as Dir4; d < 4 && !step; d = (d + 1) as Dir4) {
      const n = neighbor(c, d);
      const t = n === NO_CELL ? undefined : top.get(columnIndex(keyX(n), keyZ(n)));
      if (t !== undefined && Math.abs(keyY(t) - keyY(c)) === 1) step = true;
    }
    if (step) tiered++;
  }
  if (tiered * 4 < columnCount(s) * 3) return null;
  // The stage: level, open cells within 2 in front of the lowest steps.
  const lowest = Math.min(...[...top.values()].map(keyY));
  const stage = new Set<CellKey>();
  for (const c of top.values()) {
    if (keyY(c) !== lowest) continue;
    let n = c;
    for (let k = 0; k < 2; k++) {
      n = neighbor(n, facing);
      if (n === NO_CELL || mine.has(n)) break;
      const g = plan.terrain.height[columnIndex(keyX(n), keyZ(n))]!;
      if (g !== keyY(c) || plan.kinds.has(n)) break;
      const floor = plan.world.floors.get(n);
      if (floor !== undefined && floor !== 'plaza') break;
      stage.add(n);
    }
  }
  if (stage.size < 4) return null;
  if (castleBeside(s, plan)) return null;
  return { facing, stage: [...stage].sort((a, b) => a - b) };
}

export default defineRule<Theatre>({
  id: 'R-M09.theatre',
  part: 'roles',
  tier: 2,
  priority: 5977,
  about:
    'Reads: marble structures with no role whose columns are tiers of steps facing one way (R-M04 shape, 3+ tiers, 4+ wide), the top row leading nowhere, 4+ open level cells in front. ' +
    'Emits: role theatre; a balustrade along drops of 2+ round its top.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'marble' || plan.roles.has(s.id)) continue;
      const t = theatreOf(s, plan);
      if (t) out.push({ anchor: s.cells[0]!, structure: s.id, data: t });
    }
    return out;
  },
  apply(c, out, ctx) {
    const s = ctx.plan.structures.get(c.structure!)!;
    out.role(s.id, 'theatre');
    podiumRails(ctx, s, out);
  },
});
