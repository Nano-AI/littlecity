// LOOK FIXTURE. The spike's stairs: four stone steps rising one storey over
// one cell, each with a proud nosing. They climb north (toward −z) at rot 0.

import { CELL_H, keyX, keyY, keyZ } from '@/core/grid';
import { compose, rotationY, translation, type Mat4Like } from '@/core/mat4';
import { defineGenerator } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { PALETTE, rampColor } from '@/style/palette';

const STEPS = 4;

export default defineGenerator({
  kind: 'stairs',
  build(s, plan) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: s.id });
    for (const cell of s.cells) {
      const rot = plan.world.blocks.get(cell)?.rot ?? 0;
      b.at(compose(translation(keyX(cell) + 0.5, keyY(cell) * CELL_H, keyZ(cell) + 0.5), rotationY((-rot * Math.PI) / 2)), () => {
        for (let i = 0; i < STEPS; i++) {
          const h = ((i + 1) * CELL_H) / STEPS, zc = 0.375 - i * 0.25;
          // The treads share one ink group: the creases between them are the drawing.
          b.with({ color: rampColor('stairs', s.color), pattern: PATTERN.stone, ink: 'steps' }, () =>
            b.boxAt([0, 0, zc], [0.8, h, 0.25], { skip: i < STEPS - 1 ? ['bottom', 'n'] : ['bottom'] }),
          );
          b.with({ color: PALETTE.stoneShade, ink: `nosing${i}` }, () => b.boxAt([0, h - 0.026, zc], [0.84, 0.03, 0.27]));
        }
      });
    }
    return { mesh: b.build(), anchors };
  },
});
