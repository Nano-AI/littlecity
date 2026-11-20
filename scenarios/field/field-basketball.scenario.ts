// The playing field: a basketball court on a street of family houses.
// Residents come and play two or three a side; passers-by stop to watch.

import { scenario } from '@/scenario';

export default scenario({
  name: 'field-basketball',
  seed: 4401,
  about: 'A street of family houses with a 4 × 3 basketball court beside it.',
  build(b) {
    b.path(6, 12, 34, 12);
    for (let i = 0; i < 6; i++) b.house(7 + i * 4, 9, { w: 2, d: 3, floors: 2, color: i });
    for (let i = 0; i < 4; i++) b.house(7 + i * 4, 13, { w: 3, d: 2, floors: 2, color: (i + 3) % 8 });
    b.floor('field', 24, 13, 27, 15);
  },
  cameras: [
    { name: 'court', yaw: 30, pitch: 34, zoom: 6, target: [26, 1, 14.5] },
    { name: 'street', yaw: 30, pitch: 36, zoom: 2.6, target: [20, 1, 13] },
  ],
  expect(plan, dressing, check) {
    const s = check.floorStructure(24, 1, 13);
    check.equal(plan.roles.get(s.id)?.role, 'basketball-court', 'the court');
    check.ok(dressing.props.filter((p) => p.type === 'court-hoop').length === 2, 'two hoops');
  },
});
