// The placed pillar (J14): a stack of pillar cells is one marble column with
// one base and one capital. Under a block the capital flares out to carry
// it; in the sea the column stands on a stone footing.

import { above, CELL_H, columnIndex, keyX, keyY, keyZ, SEA_Y } from '@/core/grid';
import { translation, type Mat4Like } from '@/core/mat4';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { MONUMENTS } from '@/style/monuments';
import { PALETTE, rampColor } from '@/style/palette';
import { drawColumn } from './column';

/** What J14 decides about a pillar stack, from what the generator may read. */
export function pillarFacts(s: Structure, plan: ShapePlan): { flared: boolean; inWater: boolean; storeys: number } {
  const bottom = s.cells[0]!;
  const top = s.cells[s.cells.length - 1]!;
  const ground = plan.terrain.height[columnIndex(keyX(bottom), keyZ(bottom))]!;
  return {
    flared: plan.kinds.has(above(top)),
    inWater: keyY(bottom) === 0 && ground === 0,
    storeys: s.cells.length,
  };
}

export default defineGenerator({
  kind: 'pillar',
  build(s, plan, parts) {
    const b = new MeshBuilder({ ink: s.id });
    const anchors: Record<string, Mat4Like> = {};
    const bottom = s.cells[0]!;
    const { flared, inWater, storeys } = pillarFacts(s, plan);
    const at = translation(keyX(bottom) + 0.5, keyY(bottom) * CELL_H, keyZ(bottom) + 0.5);
    b.at(at, () =>
      drawColumn(b, {
        height: storeys * CELL_H,
        radius: MONUMENTS.pillarRadius,
        swell: 0.008 + 0.012 * Math.min(storeys, 4),
        base: MONUMENTS.pillarBase,
        capital: flared ? 'flared' : 'plain',
        flare: MONUMENTS.pillarFlare,
        footing: inWater ? SEA_Y + MONUMENTS.footingRise : 0,
        color: rampColor('pillar', s.color),
        shade: PALETTE.stoneShade,
        pattern: PATTERN.marble,
        ink: '',
      }),
    );
    placeFeatures(b, anchors, s, plan, parts);
    return { mesh: b.build(), anchors };
  },
});
