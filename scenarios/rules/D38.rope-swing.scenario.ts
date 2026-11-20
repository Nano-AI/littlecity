// Fixture for D38 (rope swing).
//   willows along a river two cells wide      about four in ten get a rope swing out over the water
//   willows along the sea shore               none (no bank across)

import { scenario } from '@/scenario';

export default scenario({
  name: 'D38.rope-swing',
  seed: 3838,
  about: 'About four in ten willows on a river bank (water with a bank across within three cells) get a rope swing out over the water; willows by the sea get none.',
  terrain(t) {
    t.flat(2); // grass banks (level 1 beside water would be sand: palms, not willows)
    t.water(4, 18, 43, 19); // the river
    t.water(4, 36, 43, 43); // the sea
  },
  build(b) {
    for (let x = 8; x <= 36; x += 4) b.put('tree', x, 17).put('tree', x + 2, 20);
    for (let x = 8; x <= 36; x += 4) b.put('tree', x, 35);
  },
  cameras: [
    { name: 'river', yaw: 30, pitch: 34, zoom: 4, target: [20, 1, 18.5] },
    { name: 'all', yaw: 30, pitch: 40, zoom: 2, target: [22, 1, 26] },
  ],
  expect(_plan, dressing, check) {
    const swings = check.props({ type: 'swing', variant: 'rope', rule: 'D38.rope-swing' });
    const z = (p: (typeof swings)[number]): number => ('cell' in p.at ? (p.at.cell >> 6) & 63 : -1);
    check.ok(swings.length >= 3 && swings.length <= 12, `some river willows have a swing (${swings.length})`);
    check.ok(swings.every((p) => z(p) === 17 || z(p) === 20), 'only on the river');
    for (const s of swings) check.ok(dressing.sockets.some((k) => k.owner === s.id && k.type === 'seat'), 'a seat to swing on');
  },
});
