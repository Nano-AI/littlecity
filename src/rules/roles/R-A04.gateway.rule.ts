// R-A04 · Gateway. An arch standing on a walkable top with a floor in its
// own cell: a gate over a path. It gets a crenellated crown (tag 'arch:gate',
// drawn by the generator); the lantern hanging in it is D06's, on the
// 'arch-crown' socket J15 declares; walls join it through J20.
//
// Kept to small arches (one level, at most two cells, all standing), so a
// path under a long viaduct does not turn the viaduct into a gate.

import { keyY } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { archRuns } from '../joinery/J15.arch-runs.fact';

export default defineRule({
  id: 'R-A04.gateway',
  part: 'roles',
  tier: 1,
  priority: 6960,
  about: 'Reads: arch structures of 1–2 standing cells on one level, floors. Emits: role gateway, tag arch:gate.',
  find({ facts, plan }) {
    const out = [];
    const arches = archRuns(facts);
    for (const s of plan.structures.values()) {
      if (s.kind !== 'arch' || s.cells.length > 2) continue;
      if (keyY(s.cells[0]!) !== keyY(s.cells[s.cells.length - 1]!)) continue;
      if (!s.cells.every((c) => arches.at(c)?.standing)) continue;
      if (!s.cells.some((c) => plan.world.floors.has(c))) continue;
      out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'gateway');
    out.tag(c.structure!, 'arch:gate');
  },
});
