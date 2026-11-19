// L11 · tier 1 · Gulls. count = clamp(1 + waterfront dock cells ÷ 4, 1, 8),
// in any town that has open water. Each gull gets a home (a dock cell on
// the water; with no docks yet, a cell of the shore) to circle near, and,
// where there is one, a perch of its own close to the water: a mooring
// pile, the crane's jib, the lighthouse rail, a pillar standing in the sea.
//
// Homes are the pool's cells in a seeded order, so building more dock adds
// gulls without moving the ones already there.

import { below, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { distToWater } from '@/resolve/facts/distance.fact';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { waterfront } from '@/resolve/facts/waterfront.fact';
import { BIRDS } from '@/style/birds';

interface Gull {
  index: number;
  count: number;
  perch: string;
}

export default defineRule<Gull>({
  id: 'L11.gulls',
  part: 'life',
  tier: 1,
  priority: 890,
  about: 'Reads: waterfront (dock cells on open water, else shore cells), perch sockets within 2 steps of water. Emits: gull actors (free-roaming; params home, index, count, perch).',
  find({ facts }) {
    const front = waterfront(facts);
    // A waterfront cell exists only where there is open water beside something to stand on.
    const docks = front.cells.filter((c) => keyY(c) === 1 && facts.kinds.get(below(c)) === 'dock');
    const pool = docks.length > 0 ? docks : front.cells;
    if (pool.length === 0) return [];
    const count = Math.min(BIRDS.gullMax, Math.max(1, 1 + Math.floor(docks.length / BIRDS.gullPerDock)));
    const ordered = [...pool].sort((a, b) => hash(facts.seed, 'gull-home', a) - hash(facts.seed, 'gull-home', b) || a - b);

    // Perches near the water, each for one gull: the nearest free one to its home.
    const water = distToWater(facts);
    const perches = socketsOfType(facts, 'perch').filter((s) => water.at(keyX(s.cell), keyZ(s.cell)) <= 2 && !s.id.startsWith('dove-holes'));
    const taken = new Set<string>();
    const perchFor = (home: CellKey): string => {
      let best = '';
      let bestDist = BIRDS.gullReach + 0.001;
      for (const s of perches) {
        if (taken.has(s.id)) continue;
        const d = Math.hypot(keyX(s.cell) - keyX(home), keyZ(s.cell) - keyZ(home));
        if (d < bestDist) {
          best = s.id;
          bestDist = d;
        }
      }
      if (best) taken.add(best);
      return best;
    };

    const out = [];
    for (let i = 0; i < count; i++) {
      const home = ordered[i % ordered.length]!;
      // More gulls than cells: the second on a cell needs a key of its own.
      const round = Math.floor(i / ordered.length);
      out.push({ anchor: home, key: round === 0 ? undefined : round, data: { index: i, count, perch: perchFor(home) } });
    }
    return out;
  },
  apply(c, out) {
    out.actor({ type: 'gull', at: null, params: { home: c.anchor, index: c.data.index, count: c.data.count, perch: c.data.perch } });
  },
});
