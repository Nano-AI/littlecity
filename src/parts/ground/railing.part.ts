// The `railing` feature (J19): one cell's length of railing along a cell
// face, guarding a drop. Variants follow the fence styles of R-E01: picket,
// rope, iron, balustrade.
//
// Frame (faceFrame): origin at the bottom centre of the cell face, +X along
// the face, +Z out over the drop. The railing stands FENCE.railInset inside
// the edge. `params.from` and `params.to` say how its −X and +X ends finish
// (src/vocab/ground-edges.vocab.ts), so a row of railings shares posts and a
// corner has exactly one:
//
//   0 nothing        1 a post on the line
//   2 outer corner: stop short by the inset, with the corner post     3 the same, no post
//   4 inner corner: run on by the inset, with the corner post          5 the same, no post
//   6 a joint in a straight line: a post, except in a picket fence
//
// Every railing of one style shares one ink group, so railings in a row draw
// as one object with no seam at the cell lines. About 100 triangles for
// pickets, 150 for iron, 90 for rope, 260 for a balustrade.

import { below, keyX, keyZ, NO_CELL } from '@/core/grid';
import { translation } from '@/core/mat4';
import type { FeatureVariant } from '@/core/vocab';
import { definePart } from '@/gen/api';
import { MeshBuilder } from '@/gen/mesh';
import { FENCE } from '@/style/edges';
import { rampColor } from '@/style/palette';
import { drawSpan, type FenceStyle } from './edge-draw';

const STYLE: Record<FeatureVariant<'railing'>, FenceStyle> = {
  picket: 'picket-fence',
  rope: 'rope-fence',
  iron: 'iron-railing',
  balustrade: 'stone-balustrade',
};

/** One ink id per style for every edge railing in the town. */
const shared = new MeshBuilder({ ink: 'edge-railing' });

export default definePart({
  feature: 'railing',
  build(item, ctx) {
    const b = ctx.mesh();
    const variant = item.variant ?? 'picket';
    const style = STYLE[variant] ?? 'picket-fence';
    b.setInkId(shared.inkOf(variant));
    const from = item.params?.from ?? 1, to = item.params?.to ?? 1;
    const inset = FENCE.railInset;
    const reach = (code: number): number => (code === 2 || code === 3 ? -inset : code === 4 || code === 5 ? inset : 0);
    const x0 = -0.5 - reach(from), x1 = 0.5 + reach(to);
    const length = x1 - x0;
    const posts: number[] = [];
    const clear: number[] = [];
    const hasPost = (code: number): boolean => code === 1 || code === 2 || code === 4 || (code === 6 && variant !== 'picket');
    const bare = (code: number): boolean => (code === 0 || code === 6) && variant === 'picket';
    if (hasPost(from)) posts.push(0);
    else if (!bare(from)) clear.push(0);
    if (hasPost(to)) posts.push(length);
    else if (!bare(to)) clear.push(length);
    // Pickets keep the rhythm of the grid: the phase is where this face starts along its own line.
    const cell = item.cell ?? 0;
    const lineStart = (item.dir ?? 0) % 2 === 0 ? keyX(cell) : keyZ(cell);
    // A balustrade takes the tint of the marble it stands on.
    const under = below(cell);
    const stone = rampColor('marble', (under === NO_CELL ? undefined : ctx.plan.world.blocks.get(under)?.color) ?? 0);
    b.at(translation(x0, 0, -inset), () => drawSpan(b, style, { length, posts, clear, phase: lineStart + (x0 + 0.5), stone, r: ctx.rand }));
    return { mesh: b.build() };
  },
});
