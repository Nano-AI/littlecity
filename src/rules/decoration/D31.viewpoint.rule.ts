// D31 · tier 3 · Viewpoint. Town-wide: the highest place a walker can reach
// from the town's floors (a path, plaza or garden cell, or the ground right
// beside one, on the highest level any of them reach) gets a coin telescope
// at its edge, looking out the way the land falls away most, and a bench
// beside it facing the same view. Ties go to the cell with the longest drop
// in front of it, then the lowest cell key.
//
// Reads: floors, standable cells, terrain heights, clearways. Claims: the
// telescope's and the bench's slots.

import { DIR4, keyX, keyY, keyZ, neighbor, NO_CELL, turn, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot } from '@/resolve/engine/api';
import { DIRS, standable } from '@/resolve/facts/lib';
import { clearways, edgePos } from './clearways.fact';
import { heightAt } from './lib';

const RULE = 'D31.viewpoint';

interface View {
  cell: CellKey;
  dir: Dir4;
  bench: CellKey | null;
}

export default defineRule<View>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 690,
  townWide: true,
  about: 'Town-wide. Reads: floors and the ground beside them, terrain heights, clearways. Claims: the slots of a coin telescope and a bench at the highest walkable point.',
  find({ facts }) {
    const clear = clearways(facts);
    let best: { view: View; y: number; drop: number } | null = null;
    const consider = (c: CellKey): void => {
      if (c === NO_CELL || !standable(facts, c) || facts.kinds.has(c)) return;
      const y = keyY(c);
      if (best && y < best.y) return;
      // The way the land falls away most.
      let dir: Dir4 | null = null, drop = 0;
      for (const d of DIRS) {
        const h = heightAt(facts, keyX(c) + DIR4[d]![0], keyZ(c) + DIR4[d]![1]);
        const fall = y - h;
        if (fall > drop && clear.free(c, edgePos(d)) && clear.headroom(c, edgePos(d))) {
          drop = fall;
          dir = d;
        }
      }
      if (dir === null) return;
      if (best && y === best.y && (drop < best.drop || (drop === best.drop && c > best.view.cell))) return;
      // A bench on the cell beside it along the edge, looking the same way.
      let bench: CellKey | null = null;
      for (const side of [turn(dir, 1), turn(dir, -1)] as Dir4[]) {
        const n = neighbor(c, side);
        if (n !== NO_CELL && standable(facts, n) && !facts.kinds.has(n) && clear.free(n, edgePos(dir)) && heightAt(facts, keyX(n) + DIR4[dir]![0], keyZ(n) + DIR4[dir]![1]) < y) {
          bench = n;
          break;
        }
      }
      best = { view: { cell: c, dir, bench }, y, drop };
    };
    // Only the floors on the highest level any floor reaches, and the ground beside them, can win:
    // try the levels from the top down, so the slower test runs on a handful of cells.
    const byLevel = new Map<number, CellKey[]>();
    for (const c of facts.world.floors.keys()) {
      const list = byLevel.get(keyY(c));
      if (list) list.push(c);
      else byLevel.set(keyY(c), [c]);
    }
    const seen = new Set<CellKey>();
    for (const y of [...byLevel.keys()].sort((a, b) => b - a)) {
      for (const c of byLevel.get(y)!) {
        for (const n of [c, ...DIRS.map((d) => neighbor(c, d))]) {
          if (n === NO_CELL || seen.has(n)) continue;
          seen.add(n);
          consider(n);
        }
      }
      if (best) break;
    }
    const found = best as { view: View } | null;
    return found ? [{ anchor: found.view.cell, key: 'view', data: found.view }] : [];
  },
  claims: (c) => (c.data.bench === null ? [slot.floor(c.data.cell, edgePos(c.data.dir))] : [slot.floor(c.data.cell, edgePos(c.data.dir)), slot.floor(c.data.bench, edgePos(c.data.dir))]),
  apply(c, out, ctx) {
    const { cell, dir, bench } = c.data;
    out.prop({ type: 'coin-telescope', at: { cell, pos: edgePos(dir), face: dir } });
    if (bench !== null) {
      const id = out.prop({ type: 'bench', variant: 'wood', at: { cell: bench, pos: edgePos(dir), face: dir }, params: { look: Math.floor(ctx.rand('look') * 1000) } });
      for (const n of [0, 1]) out.socket({ type: 'seat', owner: id, name: `seat-${n}`, cell: bench, dir });
    }
  },
});
