// LOOK FIXTURE. Paths and plazas as flat sheets just above the ground, so
// the look scenes have somewhere to walk. A path narrows to a ribbon and
// reaches out to each neighbouring floor; a plaza fills its cell with one
// paving tile. Each kind is one ink group across the whole town: no seams.

import { CELL_H, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { defineGenerator } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';

const LIFT = 0.012;
const MARGIN = 0.14;

export const pathFixture = defineGenerator({
  kind: 'path',
  build(s, plan) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: 'look-path' });
    b.setColor(PALETTE.path).setPattern(PATTERN.dirt).setInk('path');
    const floor = (c: CellKey): boolean => plan.world.floors.has(c);
    for (const cell of s.cells) {
      const x = keyX(cell), y = keyY(cell) * CELL_H + LIFT, z = keyZ(cell);
      const rect = (x0: number, z0: number, x1: number, z1: number): void => {
        b.quad([x + x0, y, z + z1], [x + x1, y, z + z1], [x + x1, y, z + z0], [x + x0, y, z + z0]);
      };
      const a = MARGIN, c = 1 - MARGIN;
      rect(a, a, c, c);
      const e = floor(cell + 1), w = floor(cell - 1), so = floor(cell + (1 << 6)), n = floor(cell - (1 << 6));
      if (e) rect(c, a, 1, c);
      if (w) rect(0, a, a, c);
      if (so) rect(a, c, c, 1);
      if (n) rect(a, 0, c, a);
      // Where two neighbours meet round a corner, fill the corner too.
      if (e && so) rect(c, c, 1, 1);
      if (w && so) rect(0, c, a, 1);
      if (e && n) rect(c, 0, 1, a);
      if (w && n) rect(0, 0, a, a);
    }
    return { mesh: b.build(), anchors };
  },
});

export const plazaFixture = defineGenerator({
  kind: 'plaza',
  build(s) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: 'look-plaza' });
    b.setColor(PALETTE.plaza).setPattern(PATTERN.paving).setInk('plaza');
    for (const cell of s.cells) {
      const x = keyX(cell), y = keyY(cell) * CELL_H + LIFT, z = keyZ(cell);
      b.quad([x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [x, y, z]);
    }
    return { mesh: b.build(), anchors };
  },
});
