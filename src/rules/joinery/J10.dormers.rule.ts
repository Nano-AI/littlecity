// J10 · tier 2 · Dormers, and with them everything else that breaks up a
// long roof. No eave of a gable or hip roof runs more than three cells with
// nothing on the slope above it:
//
//   a cross gable     over the main door, when the door is under an eave of a
//                     big roof (9+ cells, or an eave of 4+ cells) or a manor
//   dormers           one per two cells of eave: always on an eave of 4+
//                     cells, on a big roof and on a manor; otherwise p = 0.3,
//                     and then on one side only. A dormer needs two cells of
//                     roof behind the eave to sit on.
//   roof lights       on an eave of 4+ cells with only one cell behind it,
//                     one per three cells
//
// Chimneys (J11) keep off every cell used here.
import { above, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type RuleContext } from '@/resolve/engine/api';
import { solid } from '@/resolve/facts/lib';
import { roofRegions, type RoofRegion } from '@/resolve/facts/roofs.fact';
import { houseFacts } from './houses.fact';
import { houseStructures, roleOf, roofOf } from './houses.lib';

interface Run {
  cells: CellKey[];
  /** There is a second cell of roof behind every cell of the eave. */
  deep: boolean;
}

/** The straight runs of free eave on side `dir` of a region, each in order along the eave. */
function eaveRuns(ctx: RuleContext, region: RoofRegion, structure: number, dir: Dir4): Run[] {
  const pierced = new Set(region.pierced);
  const cells = new Set(region.cells.filter((k) => !pierced.has(k)));
  const free = (k: CellKey): boolean => {
    const n = neighbor(k, dir);
    return n !== NO_CELL && !cells.has(n) && ctx.facts.structureAt.get(n) !== structure && !solid(ctx.facts, n);
  };
  const deep = (k: CellKey): boolean => {
    const back = neighbor(k, opposite(dir));
    return back !== NO_CELL && cells.has(back);
  };
  const along: Dir4 = dir === 0 || dir === 2 ? 1 : 2;
  const runs: Run[] = [];
  for (const k of [...cells].sort((a, b) => a - b)) {
    if (!free(k)) continue;
    const prev = neighbor(k, opposite(along));
    if (prev !== NO_CELL && cells.has(prev) && free(prev)) continue; // not the start of a run
    const run: CellKey[] = [];
    for (let c = k; c !== NO_CELL && cells.has(c) && free(c); c = neighbor(c, along)) run.push(c);
    runs.push({ cells: run, deep: run.every(deep) });
  }
  return runs;
}

export default defineRule<{ region: RoofRegion }>({
  id: 'J10.dormers',
  part: 'joinery',
  tier: 2,
  priority: 900,
  local: 1, // apply reads only its roof regions and the cells beside them (RuleDef.local)
  about: 'Reads: roofRegions, roof features, the main door, roles. Emits: dormer features (gabled, cross-gable, skylight) on eave cells.',
  find(ctx) {
    const regions = roofRegions(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      const role = roleOf(ctx.plan, s.id);
      if (role === 'chapel' || role === 'greenhouse' || role === 'stilt-house') continue;
      for (const region of regions.byStructure.get(s.id) ?? []) {
        if (region.cells.length < 2) continue;
        const roof = roofOf(ctx.plan, region);
        if (!roof || (roof.variant !== 'gable' && roof.variant !== 'hip')) continue;
        out.push({ anchor: region.cells[0]!, structure: s.id, key: region.index, data: { region } });
      }
    }
    return out;
  },
  apply(c, out, ctx) {
    const { region } = c.data;
    const structure = c.structure!;
    const manor = roleOf(ctx.plan, structure) === 'manor';
    const roof = roofOf(ctx.plan, region)!;
    const ridge = (roof.params as { ridge?: 'x' | 'z' } | undefined)?.ridge;
    const hip = roof.variant === 'hip';
    // Eaves: both sides of a gable's ridge; every side of a hip. Sunny sides first.
    const sides: Dir4[] = hip ? [2, 1, 0, 3] : ridge === 'z' ? [1, 3] : [2, 0];
    const runs = new Map<Dir4, Run[]>(sides.map((d) => [d, eaveRuns(ctx, region, structure, d)]));
    const big = region.cells.length - region.pierced.length >= 9;
    const used = new Set<CellKey>();
    // Cells a roof door will take (J26, later): leave them alone.
    const roofDoor = houseFacts(ctx.facts).roofDoorAt;

    // A cross gable over the main door.
    const door = (ctx.plan.featuresByStructure.get(structure) ?? []).find((f) => f.type === 'door' && (f.params as { main?: number } | undefined)?.main === 1);
    if (door && door.cell !== undefined && door.dir !== undefined && sides.includes(door.dir)) {
      let top = door.cell, flush = true;
      for (;;) {
        const out1 = neighbor(top, door.dir);
        if (out1 === NO_CELL || ctx.facts.structureAt.get(out1) === structure) flush = false;
        const up = above(top);
        if (up === NO_CELL || ctx.facts.structureAt.get(up) !== structure) break;
        top = up;
      }
      const run = (runs.get(door.dir) ?? []).find((r) => r.cells.includes(top));
      if (flush && run && roofDoor(top) === undefined && (manor || big || run.cells.length >= 4)) {
        // Not on a hip's end cell: the hip crosses it.
        const end = hip && (run.cells[0] === top || run.cells[run.cells.length - 1] === top) && run.cells.length > 1;
        if (!end) {
          out.feature({ type: 'dormer', structure, cell: top, dir: door.dir, variant: 'cross-gable' });
          used.add(top);
        }
      }
    }

    const chance = ctx.rand('any') < 0.3;
    let sidesUsed = 0;
    for (const dir of sides) {
      for (const run of runs.get(dir) ?? []) {
        const n = run.cells.length;
        const always = manor || big || n >= 4;
        if (n < 2 || (!always && (!chance || sidesUsed > 0))) continue;
        // A hip's end cells are left alone: the hips cross them.
        const usable = (hip ? run.cells.slice(1, -1) : run.cells).filter((k) => !used.has(k) && roofDoor(k) === undefined);
        if (usable.length === 0) continue;
        if (!run.deep) {
          // One cell of roof behind the eave: no room for a dormer, so roof lights.
          if (n < 4) continue;
          const count = Math.floor(n / 3);
          for (let i = 0; i < count; i++) {
            const at = usable[Math.min(usable.length - 1, Math.floor(((i + 0.5) * usable.length) / count))]!;
            if (used.has(at)) continue;
            used.add(at);
            out.feature({ type: 'dormer', structure, cell: at, dir, variant: 'skylight' });
          }
          continue;
        }
        const count = Math.max(1, Math.floor(n / 2));
        let placed = 0;
        for (let i = 0; i < count; i++) {
          const at = usable[Math.min(usable.length - 1, Math.floor(((i + 0.5) * usable.length) / count))]!;
          // Not beside the cross gable or another dormer on this eave: they would touch.
          if (used.has(at)) continue;
          used.add(at);
          out.feature({ type: 'dormer', structure, cell: at, dir, variant: 'gabled' });
          placed++;
        }
        if (placed > 0 && !always) sidesUsed++;
      }
    }
  },
});
