// L25 · Dusk. Everybody walks home at dusk (the crowd does that; it is
// tested in src/life/people/crowd.test.ts). The rule marks where the few
// who stay out at night go: the viewpoint, a fishing spot or two.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L25.dusk',
  seed: 44,
  time: 'dusk',
  about: 'A town with a hill and a pier at dusk: night haunts for a stargazer and two night fishers.',
  terrain(t) {
    t.flat(1);
    t.water(4, 28, 43, 43);
    t.rect(24, 8, 32, 14, 4);
  },
  build(b) {
    b.path(8, 20, 26, 20).path(14, 21, 14, 27);
    for (let z = 28; z <= 31; z++) b.block('dock', 14, 0, z);
    b.block('dock', 13, 0, 31).block('dock', 15, 0, 31);
    b.plaza(16, 16, 19, 19);
    for (let i = 0; i < 4; i++) b.house(8 + i * 4 + (i > 1 ? 1 : 0), 21, { floors: 2, w: 2, color: i + 1 });
  },
  cameras: [
    { name: 'dusk', yaw: 45, pitch: 34, zoom: 2.6, target: [17, 1, 21], time: 'dusk' },
    { name: 'night', yaw: 45, pitch: 34, zoom: 2.6, target: [17, 1, 21], time: 'night' },
  ],
  expect(_plan, dressing, check) {
    const night = check.sockets({ type: 'haunt-night' });
    check.equal(night.filter((s) => s.name === 'stars').length, 1, 'places to watch the stars from');
    check.equal(night.filter((s) => s.name === 'fisher').length, 2, 'night fishing spots');
    check.ok(night.filter((s) => s.name === 'stars').every((s) => s.cell >> 12 === 4), 'the stargazer is on the hill');
    check.ok(night.every((s) => dressing.nav.nodeAt.has(s.cell)), 'all on the walking graph');
    check.equal(dressing.actors.filter((a) => a.type === 'resident').length, 8, 'residents');
  },
});
