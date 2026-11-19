// D28 · tier 2 · Terrace furniture. A flat roof terrace on a house (J05:
// roof feature 'flat') is somebody's outdoor room. DEPTH.terrace of them get
// furnished, a thing to a cell, in this order: a parasol over a table and a
// chair, a striped deck chair, a cluster of flower pots. The pots go into a
// corner by the parapet; the others in the middle of their cell. Never on a
// roof garden (a floor) or a hatch, never in front of a door onto it.
//
// Stability: each terrace's roll and arrangement are seeded by its first cell.
//
// Reads: roof regions and roof features, door features (hatches), floors,
// clearways. Claims: the slot each piece stands on.

import { above, NO_CELL, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { roofRegions } from '@/resolve/facts/roofs.fact';
import type { CellPos } from '@/resolve/plan';
import { DEPTH } from '@/style/depth';
import { roofOf } from '../joinery/houses.lib';
import { emit, type Placed } from '../urban/plots';
import { clearways } from './clearways.fact';
import { lucky } from './lib';

const RULE = 'D28.terrace-furniture';
const SETS = ['parasol', 'lounger', 'pots'] as const;
const CORNERS: readonly CellPos[] = ['se', 'ne', 'sw', 'nw'];

export default defineRule<Placed>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 720,
  about: 'Reads: roof regions with a flat roof feature (terraces), hatches, floors, clearways. Claims: the slot each parasol, deck chair or cluster of pots stands on.',
  find({ facts, plan, seed }) {
    const clear = clearways(facts);
    const hatches = new Set<CellKey>();
    for (const f of plan.features) if (f.type === 'door' && f.variant === 'hatch' && f.cell !== undefined) hatches.add(f.cell);
    const out: Candidate<Placed>[] = [];
    for (const regions of roofRegions(facts).byStructure.values()) {
      for (const region of regions) {
        if (facts.structures.get(region.structure)?.kind !== 'house' || roofOf(plan, region)?.variant !== 'flat') continue;
        const tops = region.cells.map((c) => above(c)).filter((c) => c !== NO_CELL && !facts.world.floors.has(c) && !hatches.has(c) && !facts.kinds.has(c));
        if (!tops.length) continue;
        const first = tops[0]!;
        if (!lucky(seed, RULE, first, 'terrace', DEPTH.terrace)) continue;
        const order = [...tops].sort((a, b) => hash(seed, RULE, a) - hash(seed, RULE, b) || a - b);
        const color = hash(seed, RULE, 'colour', first) % 5;
        let k = 0;
        for (const c of order) {
          if (k >= SETS.length) break;
          const set = SETS[k]!;
          const pos = set === 'pots' ? CORNERS.find((p) => clear.free(c, p)) : clear.free(c, 'c') && !clear.doorFronts.has(c) ? ('c' as CellPos) : undefined;
          if (!pos) continue;
          out.push({ anchor: c, structure: region.structure, key: set, data: { type: 'terrace-set', variant: set, cell: c, pos, params: { color, look: hash(seed, RULE, 'look', c) % 1000 } } });
          k++;
        }
      }
    }
    return out;
  },
  claims: (c) => [slot.floor(c.data.cell, c.data.pos)],
  apply: (c, out) => emit(out, [c.data]),
});
