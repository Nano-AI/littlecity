// DEMO FIXTURE. A feature part: a box chimney whose top is its 'chimney-top' socket.
import { CELL_H } from '@/core/grid';
import { translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';

export default definePart({
  feature: 'chimney',
  build(item, ctx) {
    const height = item.params?.height ?? (item.variant === 'tall-flue' ? 0.9 : 0.4);
    const b = ctx.mesh();
    b.setColor('#d98a6c').setPattern(PATTERN.brick).setInk('stack');
    b.boxAt([0.2, CELL_H, 0.1], [0.2, height, 0.2]);
    return { mesh: b.build(), anchors: { 'chimney-top': translation(0.2, CELL_H + height, 0.1) } };
  },
});
