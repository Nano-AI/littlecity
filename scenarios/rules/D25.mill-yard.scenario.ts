// Fixture for D25 (mill yard):
//   a windmill on open ground, a path to its door   a ladder on its body, sacks and a cart round its foot,
//                                                  none of them before the door or on the path
//   a windmill raised on a tower                   nothing at the foot

import { scenario } from '@/scenario';

export default scenario({
  name: 'D25.mill-yard',
  seed: 2525,
  about: 'A ladder, flour sacks and a hand cart round the foot of a windmill on the ground, each on its own side, clear of the door; a mill on a tower has no yard.',
  build(b) {
    b.stack('windmill', 12, 12, { floors: 2 });
    b.path(12, 14, 12, 18);
    b.tower(24, 12, { floors: 2 }).block('windmill', 24, 3, 12);
  },
  cameras: [
    { name: 'mill', yaw: 30, pitch: 26, zoom: 6, target: [12.5, 1.3, 12.5] },
    { name: 'mill-back', yaw: 210, pitch: 26, zoom: 6, target: [12.5, 1.3, 12.5] },
    { name: 'raised', yaw: 30, pitch: 26, zoom: 5, target: [24.5, 1.5, 12.5] },
  ],
  expect(plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'D25.mill-yard');
    check.ok(mine.some((p) => p.type === 'ladder'), 'a ladder');
    check.ok(mine.some((p) => p.variant === 'sacks') || mine.some((p) => p.variant === 'cart'), 'sacks or a cart');
    check.ok(mine.length >= 2 && mine.length <= 3, `two or three things (${mine.length})`);
    const door = plan.features.find((f) => f.type === 'door' && f.structure === check.structure(12, 1, 12).id);
    const front = door ? door.cell! + [-64, 1, 64, -1][door.dir!]! : -1;
    check.ok(!mine.some((p) => 'cell' in p.at && p.at.cell === front), 'nothing in front of the door');
    check.ok(!mine.some((p) => 'cell' in p.at && (p.at.cell & 63) >= 23), 'a raised mill has no yard');
  },
});
