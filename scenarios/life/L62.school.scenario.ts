// L62 · The school at work. A street of family houses (big enough for
// children), and the one-storey house with a fenced yard that R-H21 makes the
// schoolhouse: the teacher calls the children in, they go in for the lesson
// and burst out to the hopscotch after.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L62.school',
  seed: 6202,
  about: 'Family houses on a street and a schoolhouse with its yard.',
  build(b) {
    b.path(6, 12, 34, 12);
    for (let i = 0; i < 6; i++) b.house(7 + i * 4, 9, { w: 2, d: 3, floors: 2, color: i });
    for (let i = 0; i < 5; i++) b.house(7 + i * 4, 13, { w: 3, d: 2, floors: 2, color: (i + 3) % 8 });
    b.house(28, 13, { w: 2, color: 2 });
    b.fenceAround(30, 13, 33, 16);
  },
  cameras: [{ name: 'school', yaw: 30, pitch: 32, zoom: 4.6, target: [29, 1, 13] }],
  expect(_plan, dressing, check) {
    check.ok(dressing.sockets.some((s) => s.type === 'errand' && s.name?.startsWith('school|door|')), 'the school door');
    check.ok(dressing.sockets.some((s) => s.type === 'errand' && s.name?.startsWith('school|yard|')), 'the school yard');
    check.ok(check.actors({ type: 'resident', variant: 'child' }).length >= 2, 'children to go to it');
  },
});
