// Gardens (R-G01, J21). A garden region is one low bed with eased corners,
// and what grows on it is chosen by the region's role:
//
//   flower-garden    beds of earth in a lawn, planted in drifts of three colours (the default)
//   kitchen-garden   timber raised beds: cabbages, beans and pumpkins, leaf rows, cut flowers
//   wheat-field      one standing mass of wheat that ripples in the wind, with a scarecrow
//   herb-garden      clipped herb beds on gravel, four to a cell, round a sundial
//   reed-bed         wet ground, pools, reeds, cattails and flag irises
//   park-lawn        mown lawn inside a clipped hedge that opens where a path arrives
//
// Reads: the region's cells, which of them hold a block, its role and its
// features (floor-link, garden-piece). Nothing else.

import { CELL_H, keyX, keyY, keyZ } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { hash } from '@/core/rand';
import type { RolesOf } from '@/core/vocab';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { MeshBuilder } from '@/gen/mesh';
import { rngOf } from '@/parts/ground/kit';
import { FLOOR } from '@/style/ground';
import { flowerGarden, herbGarden, kitchenGarden, parkLawn, reedBed, roundBed, scarecrow, sundial, wheatField, type GardenCtx } from './gardens';
import { linksOf } from './sheet';

export type GardenRole = RolesOf<'garden'>;

const PLANT: Record<GardenRole, (c: GardenCtx, cell: number) => void> = {
  'flower-garden': flowerGarden,
  'kitchen-garden': kitchenGarden,
  'wheat-field': wheatField,
  'herb-garden': herbGarden,
  'reed-bed': reedBed,
  'park-lawn': parkLawn,
};
export const GARDEN_ROLES = Object.keys(PLANT) as GardenRole[];

export default defineGenerator({
  kind: 'garden',
  build(s, plan, parts) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: s.id });
    const given = plan.roles.get(s.id)?.role;
    const role: GardenRole = given !== undefined && given in PLANT ? (given as GardenRole) : 'flower-garden';
    const ctx: GardenCtx = { b, plan, s, cells: new Set(s.cells), links: linksOf(s, plan) };
    for (const cell of s.cells) PLANT[role](ctx, cell);
    for (const f of plan.featuresByStructure.get(s.id) ?? []) {
      if (f.type !== 'garden-piece' || f.cell === undefined) continue;
      const x = keyX(f.cell) + 0.5, y = keyY(f.cell) * CELL_H + FLOOR.gardenLift, z = keyZ(f.cell) + 0.5;
      const seed = hash(s.seed, f.cell, 'piece');
      if (f.variant === 'scarecrow') scarecrow(b, x, y, z, rngOf(seed));
      else if (f.variant === 'sundial') sundial(b, x, y, z);
      else roundBed(b, x, y, z, seed);
    }
    placeFeatures(b, anchors, s, plan, parts, (f) => (f.type === 'floor-link' || f.type === 'garden-piece' ? null : undefined));
    return { mesh: b.build(), anchors };
  },
});
