// Hanging shop sign (Houses owner; dressed onto shops by D07). An iron
// bracket with a small board hanging from it, a pictogram of the trade on
// both faces: a loaf, a cup, a book, a flower, a fish, a spool, a wedge of
// cheese, a ball. The board swings in gusts (L29 moves the instance).
//
// Frame: the 'sign-bracket' socket: on the wall beside the door at head
// height, +Z out. The board hangs across the street's line of sight.

import type { ShopType } from '@/core/vocab';
import { definePart } from '@/gen/api';
import { PALETTE } from '@/style/palette';
import type { MeshBuilder } from '@/gen/mesh';

type P2 = readonly [number, number];

/** The trade's mark as an outline in the board's plane (z along the bracket, y up), about 0.1 across. */
const MARKS: Record<ShopType, { color: string; outline: P2[] }> = {
  bakery: { color: PALETTE.yellow, outline: [[-0.05, -0.02], [0.05, -0.02], [0.055, 0.01], [0.03, 0.035], [-0.03, 0.035], [-0.055, 0.01]] },
  cafe: { color: PALETTE.white, outline: [[-0.035, -0.035], [0.03, -0.035], [0.04, 0.03], [-0.045, 0.03]] },
  books: { color: PALETTE.red, outline: [[-0.045, -0.035], [0.045, -0.035], [0.045, 0.035], [-0.045, 0.035]] },
  flowers: { color: PALETTE.pink, outline: [[0, -0.045], [0.03, -0.02], [0.05, 0.01], [0.02, 0.04], [0, 0.025], [-0.02, 0.04], [-0.05, 0.01], [-0.03, -0.02]] },
  fish: { color: PALETTE.glass, outline: [[-0.055, 0], [-0.02, -0.03], [0.025, -0.012], [0.055, -0.035], [0.055, 0.035], [0.025, 0.012], [-0.02, 0.03]] },
  tailor: { color: PALETTE.magic, outline: [[-0.04, -0.04], [0.04, -0.04], [0.025, -0.02], [0.025, 0.02], [0.04, 0.04], [-0.04, 0.04], [-0.025, 0.02], [-0.025, -0.02]] },
  cheese: { color: PALETTE.yellow, outline: [[-0.055, -0.03], [0.055, -0.03], [0.055, 0.0], [-0.03, 0.04]] },
  toys: { color: PALETTE.red, outline: [[-0.04, 0], [-0.028, -0.028], [0, -0.04], [0.028, -0.028], [0.04, 0], [0.028, 0.028], [0, 0.04], [-0.028, 0.028]] },
};

function mark(b: MeshBuilder, outline: readonly P2[], x: number, cy: number, cz: number, flip: boolean): void {
  // Counter-clockwise seen from +X; reversed for the −X face.
  const pts = outline.map(([z, y]) => [x, cy + y, cz + (flip ? z : -z)] as const);
  b.polygon(flip ? [...pts].reverse() : pts);
}

export default definePart({
  prop: 'hanging-sign',
  build(item, ctx) {
    const b = ctx.mesh();
    const shop = item.params?.shop ?? 'bakery';
    const arm = 0.25, drop = 0.045;
    const bw = 0.19, bh = 0.15, cz = 0.14, top = -drop, cy = top - bh / 2;
    // Bracket: an arm and a brace, one piece of iron.
    b.with({ color: PALETTE.metal, ink: 'bracket' }, () => {
      b.box([-0.012, -0.012, 0], [0.012, 0.012, arm]);
      b.quad([-0.01, -0.1, 0], [0.01, -0.1, 0], [0.01, -0.012, 0.1], [-0.01, -0.012, 0.1]);
      b.box([-0.006, top, cz - 0.06], [0.006, 0, cz - 0.05]);
      b.box([-0.006, top, cz + 0.05], [0.006, 0, cz + 0.06]);
    });
    // Board: a wooden plaque with a pale face and the mark on both sides.
    b.with({ color: PALETTE.wood, ink: 'board' }, () => b.box([-0.014, top - bh, cz - bw / 2], [0.014, top, cz + bw / 2]));
    b.with({ color: PALETTE.white, ink: 'board' }, () => {
      const m = 0.018;
      b.quad([0.0145, top - bh + m, cz + bw / 2 - m], [0.0145, top - bh + m, cz - bw / 2 + m], [0.0145, top - m, cz - bw / 2 + m], [0.0145, top - m, cz + bw / 2 - m]);
      b.quad([-0.0145, top - bh + m, cz - bw / 2 + m], [-0.0145, top - bh + m, cz + bw / 2 - m], [-0.0145, top - m, cz + bw / 2 - m], [-0.0145, top - m, cz - bw / 2 + m]);
    });
    const { color, outline } = MARKS[shop];
    const tint = shop === 'cafe' ? PALETTE.redDark : color; // a white cup would vanish on the pale board
    b.with({ color: tint, ink: 'board' }, () => {
      mark(b, outline, 0.0165, cy, cz, false);
      mark(b, outline, -0.0165, cy, cz, true);
    });
    return { mesh: b.build(), animated: true };
  },
});
