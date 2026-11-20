// Fixture for D35 (the midwinter festival). Held in the festival, at dusk and at night.
//   a row of two-storey houses either side of a street    lights under every top storey's eaves, a wreath
//                                                          on each front door, strings across the street
//   cottages round a square with lamps                     strings from lamp to lamp; the square's tree
//
//   npm run shots -- D35.festival-lights

import { scenario } from '@/scenario';

export default scenario({
  name: 'D35.festival-lights',
  seed: 3535,
  season: 'festival',
  weather: 'clear',
  time: 'dusk',
  about: 'The midwinter festival: lights under the eaves and across the street, wreaths, strings round a square, the big tree with its star.',
  build(b) {
    b.path(8, 10, 19, 10);
    for (let i = 0; i < 6; i++) {
      b.house(8 + i * 2, 9, { w: 2, floors: 2, color: i % 8 });
      b.house(8 + i * 2, 11, { w: 2, floors: i % 2 ? 2 : 3, color: (i + 3) % 8 });
    }
    b.plaza(23, 8, 29, 14);
    b.house(23, 7, { w: 3, color: 1 }).house(26, 7, { w: 4, floors: 2, color: 5 });
    b.house(30, 9, { w: 1, d: 3, color: 2 });
  },
  cameras: [
    { name: 'street', yaw: 60, pitch: 30, zoom: 5, target: [13.5, 1.6, 10] },
    { name: 'square', yaw: 45, pitch: 32, zoom: 5, target: [26, 1.3, 11] },
    { name: 'night', yaw: 45, pitch: 34, zoom: 3.2, target: [19, 1.3, 10.5], time: 'night' },
    { name: 'day', yaw: 225, pitch: 32, zoom: 3.2, target: [19, 1.3, 10.5], time: 'day' },
  ],
  expect(plan, dressing, check) {
    check.ok(check.props({ type: 'festival-lights', rule: 'D35.festival-lights' }).length >= 20, 'lights under the eaves');
    check.hasProp({ type: 'wreath' }, 3);
    check.hasProp({ type: 'festival-tree' });
    check.ok(check.props({ type: 'festival-lights' }).some((p) => p.variant === 'street'), 'strings across the street');
  },
});
