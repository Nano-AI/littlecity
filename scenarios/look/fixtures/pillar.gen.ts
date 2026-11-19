// LOOK FIXTURE. The spike's pillar: a stack of pillar cells is one shaft
// with a base at the bottom and a capital at the top.

import { CELL_H, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import { translation, type Mat4Like } from '@/core/mat4';
import { defineGenerator } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { PALETTE, rampColor } from '@/style/palette';

export default defineGenerator({
  kind: 'pillar',
  build(s, plan) {
    const anchors: Record<string, Mat4Like> = {};
    const out = new MeshBuilder({ ink: s.id });
    const isPillar = (c: CellKey): boolean => plan.kinds.get(c) === 'pillar';
    for (const cell of s.cells) {
      const x = keyX(cell), y = keyY(cell), z = keyZ(cell);
      let lo = cell, hi = cell;
      while (isPillar(lo - (1 << 12))) lo -= 1 << 12;
      while (isPillar(hi + (1 << 12))) hi += 1 << 12;
      const n = keyY(hi) - keyY(lo) + 1;
      const bottom = lo === cell, top = hi === cell;
      const b = new MeshBuilder({ ink: `pillar:${x}:${z}:${keyY(lo)}` });
      const stone = rampColor('pillar', s.color);
      // The shaft tapers over the whole stack, so each cell asks where it sits in it.
      const radius = (yy: number): number => 0.15 + (0.012 * n + 0.008) * (1 - (yy - keyY(lo) * CELL_H) / (n * CELL_H));
      b.at(translation(x + 0.5, 0, z + 0.5), () => {
        const y0 = y * CELL_H, y1 = y0 + CELL_H;
        const s0 = bottom ? y0 + 0.15 : y0, s1 = top ? y1 - 0.12 : y1;
        b.with({ color: stone, pattern: PATTERN.marble, ink: 'shaft' }, () => b.lathe([[radius(s0), s0], [radius(s1), s1]], { segments: 16 }));
        if (bottom) {
          b.with({ color: PALETTE.stoneShade, ink: 'base' }, () => b.boxAt([0, y0, 0], [0.5, 0.1, 0.5], { skip: ['bottom'] }));
          b.with({ color: stone, ink: 'base-collar' }, () => b.boxAt([0, y0 + 0.1, 0], [0.42, 0.05, 0.42], { skip: ['bottom'] }));
        }
        if (top) {
          b.with({ color: stone, ink: 'cap-collar' }, () => b.boxAt([0, y1 - 0.12, 0], [0.42, 0.05, 0.42]));
          b.with({ color: PALETTE.stoneShade, ink: 'cap' }, () => b.boxAt([0, y1 - 0.07, 0], [0.5, 0.07, 0.5]));
        }
      });
      out.add(b);
    }
    return { mesh: out.build(), anchors };
  },
});
