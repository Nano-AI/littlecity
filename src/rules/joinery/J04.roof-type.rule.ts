// J04 · tier 1 · Roof type, per roof region of a house (first match):
//
//   the role names one            townhouse → stepped gable, manor → hip,
//                                 chapel → gable (square: the ridge runs away
//                                 from the steeple, with a cross gable in the
//                                 middle of each eave; never a terrace: FX-05)
//   something stands or leads on  a path, plaza, garden, stairs or a piece on it → flat terrace
//   1 deep against a taller wall  lean-to against that wall
//   a rectangle ≤ 2 wide          gable, ridge along the long axis
//   otherwise                     hip (wide rectangles; every L, T, U and ring, however narrow)
//
// Also here, because they are properties of the roof: J03's ridge offset
// (touching houses of different colours get ridges at slightly different
// heights; a row house keeps the row's line) and the chapel's finial.
import { keyX, keyZ, neighbor, NO_CELL, opposite, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { solid } from '@/resolve/facts/lib';
import { roofRegions, type RoofRegion } from '@/resolve/facts/roofs.fact';
import { HOUSE } from '@/style/houses';
import { farGableEnd, houseStructures, roleOf, roofOf, steepleColumn } from './houses.lib';

type Variant = 'gable' | 'hip' | 'lean-to' | 'flat' | 'stepped-gable';

export default defineRule<{ region: RoofRegion }>({
  id: 'J04.roof-type',
  part: 'joinery',
  tier: 1,
  priority: 960,
  local: 1, // apply reads only its roof regions, the cells beside them and a touching steeple (RuleDef.local)
  about: 'Reads: roofRegions, roles, neighbours of the roof cells. Emits: one roof feature per region; a finial on a chapel.',
  find(ctx) {
    const regions = roofRegions(ctx.facts);
    return houseStructures(ctx).flatMap((s) =>
      (regions.byStructure.get(s.id) ?? []).map((region) => ({ anchor: region.cells[0]!, structure: s.id, key: region.index, data: { region } })),
    );
  },
  apply(c, out, ctx) {
    const { region } = c.data;
    const structure = c.structure!;
    const s = ctx.facts.structures.get(structure)!;
    const role = roleOf(ctx.plan, structure);
    const inRow = ctx.plan.tags.get(structure)?.has('in-row') ?? false;
    const pierced = new Set(region.pierced);
    const cells = region.cells.filter((k) => !pierced.has(k));
    if (cells.length === 0) return; // wholly under another structure: nothing to roof
    if (roofOf(ctx.plan, region)) return; // J05 made it a terrace
    const narrow = Math.min(region.width, region.depth);

    // Which ends of each axis are closed by a party wall or by a taller part: a ridge likes to run into those.
    const inRegion = new Set(region.cells);
    const closed = (d: Dir4): number =>
      cells.filter((k) => {
        const n = neighbor(k, d);
        return n !== NO_CELL && !inRegion.has(n) && (solid(ctx.facts, n) || ctx.facts.structureAt.get(n) === structure);
      }).length;
    const lift = inRow ? 0 : Math.round((rand(s.seed, 'roof-lift') * 2 - 1) * HOUSE.lift * 100) / 100;

    let variant: Variant;
    let ridge: 'x' | 'z' | undefined;
    let against: Dir4 | undefined;
    if (role === 'townhouse') variant = 'stepped-gable';
    else if (role === 'manor' || role === 'town-hall') variant = 'hip';
    // FX-05: a chapel keeps a church's roof: a steep gable, never a terrace (a path laid onto it is
    // ignored) and never a pyramid, however square it is.
    else if (role === 'chapel' && region.rectangular && region.pierced.length === 0) variant = 'gable';
    // R-H18: a barn's long gable roof, whatever its width (an L-shaped barn keeps the hip).
    else if (role === 'barn' && region.rectangular) variant = 'gable';
    else if (region.floors.length > 0 || region.pieces.length > 0 || region.stairsOnto.length > 0) variant = 'flat';
    else {
      // A lean-to: one cell deep, with the taller wall along its long side.
      const leanSides = region.againstTaller.filter((d) => (d === 0 || d === 2 ? region.depth === 1 : region.width === 1));
      const full = leanSides.find((d) => cells.every((k) => ctx.facts.structureAt.get(neighbor(k, d)) === structure && !inRegion.has(neighbor(k, d))));
      if (full !== undefined && !region.againstTaller.includes(opposite(full))) {
        variant = 'lean-to';
        against = full;
      } else variant = narrow <= 2 && region.rectangular ? 'gable' : 'hip';
    }
    if (variant === 'gable' || variant === 'stepped-gable') {
      const tower = role === 'chapel' && !region.longAxis ? steepleColumn(ctx, structure) : null;
      if (region.longAxis) ridge = region.longAxis;
      else if (tower) {
        // A square chapel: the nave runs away from its steeple.
        const cx = (region.box.x0 + region.box.x1 + 1) / 2, cz = (region.box.z0 + region.box.z1 + 1) / 2;
        ridge = Math.abs(tower[0] - cx) >= Math.abs(tower[1] - cz) ? 'x' : 'z';
      } else {
        // Square: run the ridge into party walls if there are any, else let the seed decide.
        const x = closed(1) + closed(3), z = closed(0) + closed(2);
        ridge = x > z ? 'x' : z > x ? 'z' : rand(s.seed, 'ridge', region.index) < 0.5 ? 'x' : 'z';
      }
    }
    out.feature({
      type: 'roof',
      structure,
      region: region.index,
      variant,
      params: { ...(ridge ? { ridge } : {}), ...(lift !== 0 && variant !== 'flat' ? { lift } : {}), ...(against !== undefined ? { against } : {}) },
    });

    // R-H14: a weathervane on the ridge of a lookout cottage.
    if (ridge && (ctx.plan.tags.get(structure)?.has('weathervane') ?? false)) {
      const end = farGableEnd(ctx, structure, region, ridge);
      if (end) out.feature({ type: 'finial', structure, cell: end.cell, dir: end.dir, variant: 'vane' });
    }
    // FX-05: a square chapel of 3 or more a side gets its transepts: a cross gable in the middle of each eave.
    if (role === 'chapel' && ridge && variant === 'gable' && region.width === region.depth && region.width >= 3) {
      const mid = ridge === 'x' ? region.box.x0 + Math.floor(region.width / 2) : region.box.z0 + Math.floor(region.depth / 2);
      for (const k of cells) {
        const along = ridge === 'x' ? keyX(k) : keyZ(k);
        if (along !== mid) continue;
        const across = ridge === 'x' ? keyZ(k) : keyX(k);
        const lo = ridge === 'x' ? region.box.z0 : region.box.x0, hi = ridge === 'x' ? region.box.z1 : region.box.x1;
        if (across === lo) out.feature({ type: 'dormer', structure, cell: k, dir: ridge === 'x' ? 0 : 3, variant: 'cross-gable' });
        if (across === hi) out.feature({ type: 'dormer', structure, cell: k, dir: ridge === 'x' ? 2 : 1, variant: 'cross-gable' });
      }
    }
    // R-H01: a finial on the gable end farthest from the steeple.
    if (role === 'chapel' && ridge) {
      const end = farGableEnd(ctx, structure, region, ridge);
      if (end) out.feature({ type: 'finial', structure, cell: end.cell, dir: end.dir, variant: 'cross' });
    }
  },
});
