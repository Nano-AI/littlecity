// L59 · The harvest. A windmill with a wheat field beside it, a lane to a
// few cottages: in late summer and autumn the farmhands cut the field, the
// stooks stand, and the sheaves go to the mill.
//
//   node src/life/testing/sequence.mjs L59.harvest --season autumn --warm 30000 --zoom 7 --target 22,1,18 --frames 12 --every 4000

import { scenario } from '@/scenario';

export default scenario({
  name: 'L59.harvest',
  seed: 59,
  about: 'A windmill and its wheat field, and cottages for the farmhands.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.put('windmill', 19, 16).put('windmill', 19, 16);
    b.garden(21, 15, 25, 18);
    b.path(19, 17, 19, 21).path(20, 19, 28, 19);
    for (let i = 0; i < 3; i++) b.house(21 + i * 3, 20, { floors: 1, w: 2, d: 2, color: i + 1 });
  },
  cameras: [{ name: 'field', yaw: 40, pitch: 36, zoom: 5, target: [22, 1, 18] }],
  expect(plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('harvest|'));
    const field = posts.filter((s) => s.name!.startsWith('harvest|field|'));
    check.ok(field.length >= 4, `the field's cells (${field.length})`);
    check.ok(field.every((s) => s.structure !== undefined && plan.roles.get(s.structure)?.role === 'wheat-field'), 'all on the wheat field');
    check.ok(posts.some((s) => s.name!.startsWith('harvest|mill|')), 'the mill');
  },
});
