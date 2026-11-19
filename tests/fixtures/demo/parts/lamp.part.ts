// DEMO FIXTURE. A prop part: a post with a head; the head is its 'lamp-head' socket.
import { translation } from '@/core/mat4';
import { definePart } from '@/gen/api';

export default definePart({
  prop: 'lamp',
  build(item, ctx) {
    const b = ctx.mesh();
    b.setColor('#4b4a55').setInk('post');
    b.lathe([[0.03, 0], [0.03, 0.7]], { segments: 6 });
    b.setColor('#ffd96e').setInk('head');
    b.at(translation(0, 0.7, 0), () => b.lathe([[0, 0], [0.08, 0.06], [0, 0.14]], { segments: 6 }));
    if (item.variant === 'four-arm') b.boxAt([0, 0.6, 0], [0.4, 0.03, 0.03]);
    return { mesh: b.build(), anchors: { 'lamp-head': translation(0, 0.76, 0) } };
  },
});
