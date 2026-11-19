// J10 · tier 2 · Dormers. A gable or hip roof with a straight eave of 2+
// cells, on a house at least two cells deep under that eave, gets (p = 0.3;
// always on a manor) one dormer per two cells of eave. They look out over
// the sunny eaves first (south, east); a manor has them on every long side.
import { neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { solid } from '@/resolve/facts/lib';
import { roofRegions, type RoofRegion } from '@/resolve/facts/roofs.fact';
import { houseStructures, roleOf, roofOf } from './houses.lib';

/** The cells of a region whose side `dir` is a free eave, as straight runs (in order along the eave). */
function eaveRuns(ctx: { facts: Parameters<typeof solid>[0] }, region: RoofRegion, structure: number, dir: Dir4): CellKey[][] {
  const cells = new Set(region.cells.filter((k) => !region.pierced.includes(k)));
  const free = (k: CellKey): boolean => {
    const n = neighbor(k, dir);
    if (n === NO_CELL || cells.has(n)) return false;
    if (ctx.facts.structureAt.get(n) === structure || solid(ctx.facts, n)) return false;
    // Two cells of roof behind the eave, or a dormer has no slope to sit on.
    const back = neighbor(k, ((dir + 2) & 3) as Dir4);
    return back !== NO_CELL && cells.has(back);
  };
  const along: Dir4 = dir === 0 || dir === 2 ? 1 : 2;
  const runs: CellKey[][] = [];
  for (const k of [...cells].sort((a, b) => a - b)) {
    if (!free(k)) continue;
    const prev = neighbor(k, ((along + 2) & 3) as Dir4);
    if (prev !== NO_CELL && cells.has(prev) && free(prev)) continue; // not the start of a run
    const run: CellKey[] = [];
    for (let c = k; c !== NO_CELL && cells.has(c) && free(c); c = neighbor(c, along)) run.push(c);
    runs.push(run);
  }
  return runs;
}

export default defineRule<{ region: RoofRegion; manor: boolean }>({
  id: 'J10.dormers',
  part: 'joinery',
  tier: 2,
  priority: 900,
  about: 'Reads: roofRegions, roof features, roles. Emits: dormer features on eave cells. Chimneys (J11) keep off those cells.',
  find(ctx) {
    const regions = roofRegions(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      const manor = roleOf(ctx.plan, s.id) === 'manor';
      for (const region of regions.byStructure.get(s.id) ?? []) {
        const roof = roofOf(ctx.plan, region);
        if (!roof || (roof.variant !== 'gable' && roof.variant !== 'hip')) continue;
        out.push({ anchor: region.cells[0]!, structure: s.id, key: region.index, data: { region, manor } });
      }
    }
    return out;
  },
  apply(c, out, ctx) {
    const { region, manor } = c.data;
    const structure = c.structure!;
    if (!manor && ctx.rand('any') >= 0.3) return;
    const roof = roofOf(ctx.plan, region)!;
    const ridge = (roof.params as { ridge?: 'x' | 'z' } | undefined)?.ridge;
    // Eaves that can carry dormers: both sides of a gable's ridge; every side of a hip.
    const sides: Dir4[] = roof.variant === 'hip' ? [2, 1, 0, 3] : ridge === 'z' ? [1, 3] : [2, 0];
    let placed = 0;
    for (const dir of sides) {
      // A cottage has them on one side only; a manor all round.
      if (!manor && placed > 0) break;
      for (const run of eaveRuns(ctx, region, structure, dir)) {
        if (run.length < 2) continue;
        // One per two cells, centred on the run (a hip's end cells are left alone: the hips cross them).
        const usable = roof.variant === 'hip' ? run.slice(1, -1) : run;
        const count = Math.floor(run.length / 2);
        if (usable.length === 0) continue;
        for (let i = 0; i < count; i++) {
          const at = usable[Math.min(usable.length - 1, Math.floor(((i + 0.5) * usable.length) / count))]!;
          out.feature({ type: 'dormer', structure, cell: at, dir });
          placed++;
        }
      }
    }
  },
});
