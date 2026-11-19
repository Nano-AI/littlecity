// PROOF OF LOOK. The spike's pieces (scenarios/look/fixtures), drawn by the
// real renderer, laid out like spike/primitives so the two can be compared
// side by side: a catalogue row at the back, a stacking vignette on a plaza
// at the front, trees and lamps between, a terrace and a cliff behind.
//
//   npm run shots -- look-primitives
//
// Cameras: the hero view, the same view from the other three orbit
// quarters, three close-ups, and the hero at dusk and at night.

import { key } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';
import { LOOK_SEED } from './fixtures';

const LAMPS: readonly [number, number][] = [[18, 22], [22, 22], [26, 22], [19, 26], [27, 25], [22, 29]];

/** A scenario-local rule: lamps exactly where the picture wants them. */
const lamps = defineRule({
  id: 'X-LOOK.lamps',
  part: 'decoration',
  tier: 1,
  priority: -2000,
  find: () => LAMPS.map(([x, z]) => ({ anchor: key(x, 1, z) })),
  apply(c, out) {
    out.prop({ type: 'lamp', variant: 'post', at: { cell: c.anchor, pos: 'ne' } });
  },
});

export default scenario({
  name: 'look-primitives',
  seed: LOOK_SEED + 1,
  about: 'Proof of look: the spike pieces in the real renderer, from four sides and at three times of day.',
  rules: [lamps],
  terrain(t) {
    t.rect(13, 16, 33, 30, 1);
    t.disc(14, 29, 2.6, 0); // a bite out of the near corner, so the shore is in the hero view
    t.rect(28, 16, 33, 22, 2); // a terrace
    t.rect(30, 16, 33, 19, 4); // and a bluff with a two-level cliff
  },
  build(b) {
    // Ground first: a street along the catalogue row, a lane down to the plaza, the plaza itself.
    b.path(15, 22, 27, 22);
    b.path(18, 23, 18, 28);
    b.plaza(20, 24, 26, 28);

    // The catalogue row.
    b.house(16, 20, { color: 0 });
    b.put('marble', 18, 20);
    b.put('pillar', 20, 20);
    b.put('stairs', 22, 20);
    b.put('tree', 24, 20).put('tree', 25, 20).put('tree', 26, 19);
    b.house(15, 18, { color: 5 });

    // Stacking and joinery.
    b.house(20, 24, { floors: 3, color: 4 }); // a three-storey house
    b.fill('marble', 23, 24, 24, 25, { floors: 2 }); // a 2 × 2 × 2 foundation
    b.fill('marble', 23, 26, 24, 26, { floors: 1 }); // with a one-storey step in front
    b.house(24, 25, { color: 3 }); // a house on the foundation
    b.put('tree', 23, 24); // and a tree beside it
    b.stack('pillar', 21, 27, { floors: 2 }); // two pillars are one column
    b.house(21, 27, { color: 2 }); // carrying a house
    b.stack('pillar', 26, 27, { floors: 3 }); // a monument column
    b.put('stairs', 22, 26, { rot: 1 }); // steps up onto the foundation's low step
    b.house(25, 28, { color: 6 });

    // Up on the terrace and the bluff.
    b.house(29, 21, { floors: 2, color: 1 });
    b.put('tree', 31, 17).put('tree', 32, 18).put('tree', 31, 21);

    // Scattered planting.
    for (const [x, z] of [[14, 24], [16, 26], [17, 28], [19, 29], [27, 29], [28, 26], [29, 28], [31, 25], [32, 28], [17, 17], [21, 18], [26, 17]] as const) b.put('tree', x, z);
  },
  cameras: [
    { name: 'hero', yaw: 45, pitch: 32, zoom: 3.3, target: [23, 1, 23.5] },
    { name: 'hero-se', yaw: 135, pitch: 32, zoom: 3.3, target: [23, 1, 23.5] },
    { name: 'hero-nw', yaw: 225, pitch: 32, zoom: 3.3, target: [23, 1, 23.5] },
    { name: 'hero-ne', yaw: 315, pitch: 32, zoom: 3.3, target: [23, 1, 23.5] },
    { name: 'joinery', yaw: 45, pitch: 32, zoom: 8.5, target: [23, 2, 26] },
    { name: 'row', yaw: 45, pitch: 32, zoom: 7, target: [20.5, 1.5, 20.5] },
    { name: 'house', yaw: 35, pitch: 28, zoom: 13, target: [16.4, 1.7, 20.6] },
    { name: 'low', yaw: 60, pitch: 14, zoom: 6, target: [23, 2, 25] },
    { name: 'dusk', yaw: 45, pitch: 32, zoom: 3.3, target: [23, 1, 23.5], time: 'dusk' },
    { name: 'night', yaw: 45, pitch: 32, zoom: 3.3, target: [23, 1, 23.5], time: 'night' },
    { name: 'night-close', yaw: 45, pitch: 32, zoom: 8.5, target: [23, 2, 26], time: 'night' },
    { name: 'dawn', yaw: 135, pitch: 30, zoom: 5, target: [23, 1.5, 24], time: 'dawn' },
    // From the north-west the shadow side faces the viewer: the grounding shade, by day and at dusk.
    { name: 'shade', yaw: 215, pitch: 30, zoom: 7.5, target: [21, 1.5, 24.5] },
    { name: 'shade-dusk', yaw: 215, pitch: 30, zoom: 7.5, target: [21, 1.5, 24.5], time: 'dusk' },
    { name: 'shade-night', yaw: 215, pitch: 30, zoom: 7.5, target: [21, 1.5, 24.5], time: 'night' },
  ],
  expect(plan, dressing, check) {
    check.kind(20, 3, 24, 'house');
    check.kind(21, 3, 27, 'house');
    check.kind(26, 3, 27, 'pillar');
    check.hasProp({ type: 'lamp', rule: 'X-LOOK.lamps' }, LAMPS.length);
    check.ok(plan.terrain.height[30 + 17 * 48]! === 4, 'the bluff is four high');
    check.ok(dressing.props.length >= LAMPS.length, 'lamps are in the dressing plan');
  },
});
