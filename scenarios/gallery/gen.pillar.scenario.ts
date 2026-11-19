// The gallery's pillar entry: placed pillars alone, in rows, carrying
// blocks, and standing in the sea, beside the generated supports they are
// related to (a house on a generated pillar, a row on an arcade).

import { scenario } from '@/scenario';

export default scenario({
  name: 'gen.pillar',
  seed: 48,
  about: 'Placed pillars: single, tall, in a colonnade under a lintel, in the sea; and generated pillars and an arcade for comparison.',
  terrain(t) {
    t.flat(1);
    t.water(4, 17, 43, 43);
  },
  build(b) {
    b.plaza(9, 10, 23, 13);
    for (const [x, n] of [[10, 1], [12, 2], [14, 3], [16, 5]] as const) b.eraseFloor(x, 11).stack('pillar', x, 11, { floors: n });
    // A colonnade: six pillars two tall carrying a marble lintel.
    for (let x = 18; x <= 23; x++) b.eraseFloor(x, 12).stack('pillar', x, 12, { floors: 2 }).block('marble', x, 3, 12);
    // In the sea: a pair with a block across them, and one alone.
    b.block('pillar', 12, 0, 19).block('pillar', 12, 1, 19).block('pillar', 14, 0, 19).block('pillar', 14, 1, 19);
    for (let x = 12; x <= 14; x++) b.block('marble', x, 2, 19);
    b.block('pillar', 17, 0, 19).block('pillar', 17, 1, 19).block('pillar', 17, 2, 19);
    // Generated supports, for comparison: plainer stone, a capital that spreads, an arcade.
    b.block('house', 27, 3, 11, { color: 2 });
    for (let x = 30; x <= 33; x++) b.block('house', x, 3, 11, { color: 5 });
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 2.8, target: [20, 2, 14] },
    { name: 'back', yaw: 220, pitch: 30, zoom: 2.8, target: [20, 2, 14] },
    { name: 'close', yaw: 30, pitch: 22, zoom: 6.5, target: [13, 2, 11] },
  ],
  expect(plan, _dressing, check) {
    check.equal(check.structure(16, 1, 11).cells.length, 5, 'five cells, one shaft');
    check.hasTag(20, 1, 12, 'capital:flared');
    check.hasTag(12, 0, 19, 'footing:water');
    check.hasSocket({ type: 'perch', at: [16, 5, 11] });
    check.role(20, 3, 12, 'temple'); // a lintel on six pillars two tall is a temple
    check.ok(plan.supports.some((s) => s.type === 'pillar' && (s.arcadeTo?.length ?? 0) > 0), 'the row of houses stands on an arcade');
  },
});
