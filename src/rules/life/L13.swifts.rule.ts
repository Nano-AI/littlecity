// L13 · tier 1 · Swifts (town-wide). If any tower or lighthouse has height
// ≥ 5, or total street length ≥ 20: clamp(street length ÷ 8, 3, 9) swifts
// loop round the tallest structures. They are shared out over the three
// that reach highest (buildings, not trees or fences); with nothing built
// at all, they loop over the middle of the longest street.

import { keyY, type CellKey } from '@/core/grid';
import type { StructureKind } from '@/core/kinds';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { streets } from '@/resolve/facts/streets.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { townFacts } from '@/resolve/facts/town.fact';
import { BIRDS } from '@/style/birds';

interface Swift {
  index: number;
  count: number;
  around: number | undefined;
  /** Top of what it loops, in levels. */
  height: number;
}

const ROOSTS: ReadonlySet<StructureKind> = new Set(['house', 'tower', 'lighthouse', 'windmill', 'marble', 'arch']);

export default defineRule<Swift>({
  id: 'L13.swifts',
  part: 'life',
  tier: 1,
  priority: 870,
  townWide: true,
  about: 'Town-wide. Reads: structure heights, total street length. Emits: swift actors (free-roaming; params around, home, height, index, count).',
  find({ facts }) {
    const info = [...structureInfo(facts).values()];
    const length = townFacts(facts).streetLength;
    const tall = info.some((s) => (s.kind === 'tower' || s.kind === 'lighthouse') && s.storeys >= BIRDS.swiftTower);
    if (!tall && length < BIRDS.swiftStreets) return [];
    const count = Math.min(BIRDS.swiftMax, Math.max(BIRDS.swiftMin, Math.floor(length / BIRDS.swiftPerStreet)));
    const roosts = info
      .filter((s) => ROOSTS.has(s.kind))
      .sort((a, b) => b.maxY - a.maxY || a.id - b.id)
      .slice(0, Math.max(1, BIRDS.swiftRoosts));

    const out: Candidate<Swift>[] = [];
    if (roosts.length === 0) {
      // Streets and nothing else: over the middle of the longest one.
      const longest = [...streets(facts).list].sort((a, b) => b.length - a.length || a.id - b.id)[0];
      if (!longest) return [];
      const mid: CellKey = longest.cells[Math.floor(longest.cells.length / 2)]!;
      for (let i = 0; i < count; i++) out.push({ anchor: mid, key: i, data: { index: i, count, around: undefined, height: keyY(mid) + 3 } });
      return out;
    }
    for (let i = 0; i < count; i++) {
      const s = roosts[i % roosts.length]!;
      // Its foot: the lowest cell of the structure, which stays put when the tower grows.
      const foot = s.cells.reduce((best, c) => (c < best ? c : best));
      out.push({ anchor: foot, structure: s.id, key: i, data: { index: i, count, around: s.id, height: s.maxY + 1 } });
    }
    return out;
  },
  apply(c, out) {
    const d = c.data;
    const params = { home: c.anchor, height: d.height, index: d.index, count: d.count };
    out.actor({ type: 'swift', at: null, params: d.around === undefined ? params : { ...params, around: d.around } });
  },
});
