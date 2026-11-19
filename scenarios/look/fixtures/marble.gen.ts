// LOOK FIXTURE. The spike's marble block: only faces that border something
// else are drawn, so a cluster is one seamless mass with soft veins and a
// bevel line under its top edges (`bevelTop` marks them for the shader).

import { CELL_H, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { defineGenerator } from '@/gen/api';
import { MeshBuilder, PATTERN, type BoxFace } from '@/gen/mesh';
import { rampColor } from '@/style/palette';

export default defineGenerator({
  kind: 'marble',
  build(s, plan) {
    const anchors: Record<string, Mat4Like> = {};
    // All marble of one colour is one surface: touching blocks show no seam even before structures merge.
    const b = new MeshBuilder({ ink: `marble:${s.color}` });
    const same = (c: CellKey): boolean => plan.kinds.get(c) === 'marble' && plan.world.blocks.get(c)?.color === s.color;
    b.setColor(rampColor('marble', s.color)).setPattern(PATTERN.marble).setInk('mass');
    for (const cell of s.cells) {
      const x = keyX(cell), y = keyY(cell) * CELL_H, z = keyZ(cell);
      const open = !same(cell + (1 << 12));
      const faces: BoxFace[] = [];
      if (open) faces.push('top');
      if (!same(cell - (1 << 12))) faces.push('bottom');
      if (!same(cell - (1 << 6))) faces.push('n');
      if (!same(cell + (1 << 6))) faces.push('s');
      if (!same(cell + 1)) faces.push('e');
      if (!same(cell - 1)) faces.push('w');
      b.box([x, y, z], [x + 1, y + CELL_H, z + 1], { only: faces, bevelTop: open });
    }
    return { mesh: b.build(), anchors };
  },
});
