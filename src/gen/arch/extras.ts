// Role features built onto an arch cell, drawn in the cell's local frame
// (u along the span, t across it from 0 to 1, +Y up from the cell's foot):
// the end posts of a stone bridge and, from tier 2, the portcullis of a
// gatehouse, a sky bridge's covered gallery, a buttress pinnacle and a
// loggia's balustrade.

import { CELL_H } from '@/core/grid';
import { compose, rotationY, translation, type Mat4Like } from '@/core/mat4';
import { MeshBuilder, PATTERN, type ColorInput } from '@/gen/mesh';
import type { Feature, ShapePlan } from '@/resolve/plan';
import { MONUMENTS } from '@/style/monuments';
import { PALETTE } from '@/style/palette';
import { ownSockets } from '@/parts/monuments/kit';
import type { ArchCellShape } from './arch.gen';

export interface ExtrasEnv {
  plan: ShapePlan;
  stone: ColorInput;
  humped: boolean;
}

/** A parapet end post with a little cap. Origin: its foot on the deck. */
function endPost(b: MeshBuilder, stone: ColorInput, height: number): void {
  b.with({ color: stone, pattern: PATTERN.stone, ink: 'post' }, () => b.boxAt([0, -0.1, 0], [0.18, height + 0.1, 0.18], { skip: ['bottom', 'top'] }));
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'post-cap' }, () => {
    b.boxAt([0, height, 0], [0.23, 0.04, 0.23]);
    b.at(compose(translation(0, height + 0.04, 0), rotationY(Math.PI / 4)), () => b.lathe([[0.14, 0], [0, 0.07]], { segments: 4, smooth: false }));
  });
}

/** Draws `f` if it is one of the arch's own features. Returns false for anything else. */
export function archExtras(b: MeshBuilder, anchors: Record<string, Mat4Like>, f: Feature, c: ArchCellShape, env: ExtrasEnv): boolean {
  const H = CELL_H;
  const sub = (name: string): MeshBuilder => new MeshBuilder({ ink: `${f.id}/${name}` });
  switch (f.type) {
    case 'bridge-end': {
      const lo = f.dir === c.dir.lo;
      const u = lo ? 0.09 : 0.91;
      const tall = MONUMENTS.parapet + 0.11;
      const sockets: Record<string, Mat4Like> = {};
      for (const front of [true, false]) {
        const t = front ? 1 - MONUMENTS.parapetThick / 2 + 0.01 : MONUMENTS.parapetThick / 2 - 0.01;
        const mb = sub(front ? 'f' : 'b');
        endPost(mb, env.stone, tall);
        const at = compose(c.frame, translation(u, H, t));
        b.add(mb, at);
        // The lamp stands on the left post at one end and the right at the other.
        if (front === lo) sockets['bridge-end'] = translation(u, H + tall + 0.11, t);
      }
      ownSockets(env.plan, anchors, f.id, c.frame, sockets);
      return true;
    }
    default:
      return false;
  }
}
