// The playing field: a clay tennis court beside a street of family houses.
// Residents come and play singles or doubles; passers-by stop to watch.

import { scenario } from '@/scenario';

export default scenario({
  name: 'field-tennis',
  seed: 4402,
  about: 'A street of family houses with a 5 × 2 clay tennis court beside it.',
  build(b) {
    b.path(6, 12, 34, 12);
    for (let i = 0; i < 6; i++) b.house(7 + i * 4, 9, { w: 2, d: 3, floors: 2, color: i });
    for (let i = 0; i < 4; i++) b.house(7 + i * 4, 13, { w: 3, d: 2, floors: 2, color: (i + 3) % 8 });
    b.floor('field', 24, 13, 28, 14);
  },
  cameras: [
    { name: 'court', yaw: 30, pitch: 34, zoom: 6, target: [26.5, 1, 14] },
    { name: 'street', yaw: 30, pitch: 36, zoom: 2.6, target: [20, 1, 13] },
  ],
  expect(plan, dressing, check) {
    const s = check.floorStructure(24, 1, 13);
    check.equal(plan.roles.get(s.id)?.role, 'tennis-court', 'the court');
    check.ok(dressing.props.some((p) => p.type === 'court-net'), 'a net');
  },
});
