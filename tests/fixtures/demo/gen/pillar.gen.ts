// DEMO FIXTURE. A generator: a pillar structure (a vertical stack of cells)
// drawn as one shaft with one base and one capital, plus its features.
import { CELL_H, keyX, keyY, keyZ } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { translation } from '@/core/mat4';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { rampColor } from '@/style/palette';

export default defineGenerator({
  kind: 'pillar',
  build(s, plan, parts) {
    const b = new MeshBuilder({ ink: s.id });
    const anchors: Record<string, Mat4Like> = {};
    const bottom = s.cells[0]!;
    const height = s.cells.length * CELL_H;
    b.setColor(rampColor('pillar', s.color)).setPattern(PATTERN.marble);
    b.at(translation(keyX(bottom) + 0.5, keyY(bottom) * CELL_H, keyZ(bottom) + 0.5), () => {
      // One ink group for the shaft, so stacked cells show no seam; base and capital get their own outline.
      b.setInk('base').boxAt([0, 0, 0], [0.5, 0.1, 0.5]);
      b.setInk('shaft').lathe([[0.17, 0.1], [0.15, height - 0.12]], { segments: 10 });
      b.setInk('capital').lathe([[0.15, height - 0.12], [0.26, height - 0.04], [0.26, height]], { segments: 10, capTop: true });
    });
    placeFeatures(b, anchors, s, plan, parts);
    return { mesh: b.build(), anchors };
  },
});
