// The playing field: a grass football pitch beside a street of family houses,
// and a little kickabout green (an L of field) for the children.

import { scenario } from '@/scenario';

export default scenario({
  name: 'field-football',
  seed: 4403,
  about: 'A street of family houses with a 7 × 4 football pitch and an L-shaped kickabout green beside it.',
  build(b) {
    b.path(6, 12, 36, 12);
    for (let i = 0; i < 7; i++) b.house(7 + i * 4, 9, { w: 2, d: 3, floors: 2, color: i });
    for (let i = 0; i < 3; i++) b.house(7 + i * 4, 13, { w: 3, d: 2, floors: 2, color: (i + 3) % 8 });
    b.floor('field', 22, 13, 28, 16);
    b.floor('field', 18, 13, 20, 14).floor('field', 18, 15, 18, 16);
  },
  cameras: [
    { name: 'pitch', yaw: 30, pitch: 36, zoom: 5, target: [25.5, 1, 15] },
    { name: 'street', yaw: 30, pitch: 36, zoom: 2.6, target: [21, 1, 13] },
  ],
  expect(plan, dressing, check) {
    check.equal(plan.roles.get(check.floorStructure(22, 1, 13).id)?.role, 'football-pitch', 'the pitch');
    check.equal(plan.roles.get(check.floorStructure(18, 1, 13).id)?.role, 'kickabout-green', 'the green');
    check.ok(dressing.props.filter((p) => p.type === 'court-goal').length === 2, 'two goals');
  },
});
