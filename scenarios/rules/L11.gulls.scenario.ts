// L11 Gulls: count = clamp(1 + waterfront dock cells ÷ 4, 1, 8). A harbour
// with a pier and a quay: 13 dock cells, every one beside open water, so
// 1 + 13 ÷ 4 = 4 gulls. They circle over the bay, each from a home on the
// docks, and those with a perch nearby (the mooring piles, the crane) come
// down to it now and then.
//
//   node src/life/testing/sequence.mjs L11.gulls --frames 12 --every 1500 --name circle

import { keyX, keyY, keyZ } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'L11.gulls',
  seed: 1101,
  about: 'A pier and a quay on a bay: four gulls circle over the water and perch on the piles.',
  terrain(t) {
    t.flat(1);
    t.water(4, 26, 43, 43); // the bay, to the south
  },
  build(b) {
    for (let z = 26; z <= 30; z++) b.block('dock', 16, 0, z); // the pier
    for (let x = 22; x <= 29; x++) b.block('dock', x, 0, 26); // the quay
    b.path(12, 25, 32, 25);
    b.house(18, 23, { floors: 2, color: 4 });
    b.house(21, 23, { floors: 1, w: 2, color: 0 });
    b.house(26, 23, { floors: 2, color: 2 });
  },
  cameras: [
    { name: 'bay', yaw: 45, pitch: 34, zoom: 3.4, target: [22, 1, 28] },
    { name: 'from-sea', yaw: 200, pitch: 28, zoom: 3.4, target: [22, 1, 28] },
    { name: 'dusk', yaw: 45, pitch: 34, zoom: 3.4, target: [22, 1, 28], time: 'dusk' },
  ],
  expect(plan, dressing, check) {
    const gulls = check.hasActor({ type: 'gull', rule: 'L11.gulls' });
    check.equal(gulls.length, 4, 'gulls: 1 + 13 waterfront dock cells ÷ 4');
    const homes = new Set<number>();
    for (const g of gulls) {
      check.ok(g.at === null, 'a gull roams free');
      const home = (g.params as { home: number }).home;
      homes.add(home);
      check.ok(keyY(home) === 1 && plan.kinds.get(home - (1 << 12)) === 'dock', `home (${keyX(home)}, ${keyZ(home)}) is a dock deck cell`);
      check.equal((g.params as { count: number }).count, 4, 'each knows its flock size');
    }
    check.equal(homes.size, 4, 'each gull has a home of its own');
    // Perches are shared out one gull each.
    const perches = gulls.map((g) => (g.params as { perch: string }).perch).filter(Boolean);
    check.equal(new Set(perches).size, perches.length, 'no two gulls share a perch');
    for (const id of perches) check.ok(plan.sockets.some((s) => s.id === id && s.type === 'perch'), `perch ${id} is a perch socket`);
    void dressing;
  },
});
