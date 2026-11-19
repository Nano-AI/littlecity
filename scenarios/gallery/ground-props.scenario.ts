// Gallery: the four fountains and the three stalls, each standing where the
// real rules (R-F01, R-S01) give it that look, so what is shown is what a
// player gets.
//
//   north row    a tiered fountain in a square, a well in a walled court, a
//                birdbath on a garden, a small basin on the grass
//   the street   eight market stalls along a path: their goods come from
//                each stall's seed, so the row shows the variety
//   the shore    a flower stall on a garden, and two fish stalls by a pier

import { scenario } from '@/scenario';

const MARKET = [10, 12, 14, 16, 18, 20, 22, 24];

export default scenario({
  name: 'ground-props',
  seed: 47,
  about: 'Fountains and stalls side by side: tiered fountain, well, birdbath, basin; market stalls with seeded goods, a flower stall, fish stalls.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
  },
  build(b) {
    // Fountains.
    b.plaza(10, 13, 12, 15);
    b.put('fountain', 11, 14);
    b.fenceAround(15, 13, 17, 15, 'wall');
    b.put('fountain', 16, 14);
    b.garden(20, 13, 22, 15);
    b.put('fountain', 21, 14);
    b.put('fountain', 25, 14);
    // The market street.
    b.path(9, 21, 25, 21);
    for (const x of MARKET) b.put('stall', x, 20);
    // The flower stall and the fish stalls.
    b.garden(10, 25, 12, 26);
    b.put('stall', 11, 25);
    b.block('dock', 18, 0, 30).block('dock', 18, 0, 31).block('dock', 18, 0, 32);
    b.put('stall', 17, 28);
    b.put('stall', 19, 28);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 35, zoom: 3, target: [17.5, 1, 21] },
    { name: 'right', yaw: 135, pitch: 35, zoom: 3, target: [17.5, 1, 21] },
    { name: 'back', yaw: 225, pitch: 35, zoom: 3, target: [17.5, 1, 21] },
    { name: 'left', yaw: 315, pitch: 35, zoom: 3, target: [17.5, 1, 21] },
    { name: 'fountains-a', yaw: 45, pitch: 35, zoom: 9, target: [13.8, 1, 14.2] },
    { name: 'fountains-b', yaw: 45, pitch: 35, zoom: 9, target: [23, 1, 14.2] },
    { name: 'fountains-back', yaw: 225, pitch: 30, zoom: 7, target: [18, 1, 14] },
    { name: 'market-a', yaw: 45, pitch: 35, zoom: 9, target: [13.2, 1, 20.6] },
    { name: 'market-b', yaw: 45, pitch: 35, zoom: 9, target: [21.2, 1, 20.6] },
    { name: 'market-back', yaw: 225, pitch: 35, zoom: 7, target: [17, 1, 20.3] },
    { name: 'market-side', yaw: 135, pitch: 30, zoom: 7, target: [17, 1, 20.5] },
    { name: 'shore', yaw: 45, pitch: 35, zoom: 7, target: [15.5, 1, 26.8] },
    { name: 'shore-back', yaw: 225, pitch: 35, zoom: 7, target: [15.5, 1, 26.8] },
  ],
  expect(plan, _dressing, check) {
    check.role(11, 1, 14, 'tiered-fountain');
    check.role(16, 1, 14, 'well');
    check.role(21, 1, 14, 'birdbath');
    check.role(25, 1, 14, 'basin');
    check.role(11, 1, 25, 'flower-stall');
    check.role(17, 1, 28, 'fish-stall');
    check.role(19, 1, 28, 'fish-stall');
    const goods = new Set<string>();
    for (const x of MARKET) {
      check.role(x, 1, 20, 'market-stall');
      check.hasTag(x, 1, 20, 'front:s');
      for (const t of plan.tags.get(check.structure(x, 1, 20).id) ?? []) if (t.startsWith('goods:')) goods.add(t);
    }
    check.ok(goods.size >= 4, `the market row shows at least four sorts of goods (it shows ${goods.size})`);
  },
});
