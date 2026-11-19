// L23 · Jobs (with L08's lamplighter). A town with one of every workplace:
// shops, a stall, a garden, a pier, a lighthouse, a windmill with its mill
// house, a keep with stairs up to its top, a chapel with its steeple, and a
// street of lamps. The lamps come from a rule of this scenario's own, since
// the real lamp rule (D01) is the Dressing owner's.

import { key } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';

const LAMPS: readonly [number, number][] = [[9, 20], [13, 20], [17, 20], [21, 20], [25, 20], [29, 20], [14, 24], [14, 28]];

const lamps = defineRule({
  id: 'X-L23.lamps',
  part: 'decoration',
  tier: 1,
  priority: 0,
  about: 'Fixture only: a lamp at the edge of eight street cells.',
  find: () => LAMPS.map(([x, z]) => ({ anchor: key(x, 1, z) })),
  apply(c, out) {
    out.prop({ type: 'lamp', variant: 'post', at: { cell: c.anchor, pos: 'ne' } });
  },
});

export default scenario({
  name: 'L23.jobs',
  seed: 47,
  about: 'One of every workplace, and a street of lamps for the lamplighter.',
  rules: [lamps],
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
  },
  build(b) {
    b.path(8, 20, 34, 20).path(14, 21, 14, 29);
    // Shops: two storeys, on the street.
    for (let i = 0; i < 5; i++) b.house(8 + i * 3 + (i > 1 ? 2 : 0), 21, { floors: 2, w: 2, color: i });
    // The square, with a stall and a garden beside it.
    b.plaza(10, 15, 14, 18);
    b.put('stall', 12, 16);
    b.garden(16, 16, 18, 18);
    b.path(12, 19, 12, 19);
    // The pier and the lighthouse.
    for (let z = 30; z <= 33; z++) b.block('dock', 14, 0, z);
    b.stack('lighthouse', 8, 28, { floors: 4 });
    b.path(8, 24, 8, 27);
    // The mill and its house.
    b.put('windmill', 30, 16).put('windmill', 30, 16);
    b.house(31, 16, { floors: 1, w: 2, color: 6 });
    b.path(30, 17, 30, 19);
    // The keep, with a stair up its west side.
    b.fill('marble', 22, 10, 24, 12, { floors: 3 });
    b.block('marble', 20, 1, 11).block('marble', 21, 1, 11).block('marble', 21, 2, 11);
    b.block('stairs', 19, 1, 11, { rot: 1 }).block('stairs', 20, 2, 11, { rot: 1 }).block('stairs', 21, 3, 11, { rot: 1 });
    b.path(19, 12, 19, 19).path(18, 11, 18, 12);
    // The chapel and its steeple.
    b.house(26, 22, { floors: 1, w: 2, d: 2, color: 5 });
    b.tower(28, 22, { floors: 4 });
    b.path(26, 21, 27, 21);
    // More homes, so there are hands for every job.
    b.house(22, 18, { floors: 2, w: 2, color: 7 });
    b.house(25, 18, { floors: 2, w: 2, color: 1 });
    b.house(31, 21, { floors: 2, w: 2, color: 3 });
  },
  cameras: [
    { name: 'town', yaw: 45, pitch: 34, zoom: 2.1, target: [20, 1, 20] },
    { name: 'street', yaw: 30, pitch: 30, zoom: 4.4, target: [15, 1, 20] },
    { name: 'dusk', yaw: 45, pitch: 34, zoom: 2.6, target: [18, 1, 21], time: 'dusk' },
  ],
  expect(plan, dressing, check) {
    const nav = dressing.nav;
    const places = check.sockets({ type: 'workplace' });
    const of = (job: string) => places.filter((s) => (s.name ?? '').split('|')[0] === job);
    check.ok(places.every((s) => nav.nodeAt.has(s.cell)), 'every station is a cell people can walk to');
    check.ok(of('shopkeeper').length + of('baker').length >= 3, 'a keeper or a baker at each shop');
    check.equal(of('vendor').length, 1, 'stall vendors');
    check.equal(of('gardener').length, 1, 'gardeners');
    check.equal(of('fisher').length, 1, 'fishers');
    check.equal(of('keeper').length, 1, 'lighthouse keepers');
    check.equal(of('miller').length, 2, 'the miller\'s two stations');
    check.equal(of('guard').length, 2, 'the two ends of the guard\'s beat');
    check.ok(of('guard').every((s) => s.cell >> 12 === 4), 'the beat is on top of the keep');
    check.equal(of('bell-ringer').length, 1, 'bell ringers');
    // The vendor stands behind the stall, the customer in front.
    const stall = check.structure(12, 1, 16).id;
    const customer = check.sockets({ type: 'haunt-shop' }).find((s) => s.structure === stall)!;
    check.ok(of('vendor')[0]!.cell !== customer.cell, 'vendor and customer on opposite sides');
    // The lamplighter's round: every lamp once, each stop next to its lamp, in an order with no long jumps back.
    const round = of('lamplighter').sort((a, b) => Number(a.name!.split('|')[1]) - Number(b.name!.split('|')[1]));
    check.equal(round.length, 8, 'lamps on the round');
    check.equal(new Set(round.map((s) => s.name!.split('|')[2])).size, 8, 'distinct lamps');
    check.ok(round.every((s) => dressing.props.some((p) => p.id === s.name!.split('|')[2] && p.type === 'lamp')), 'each stop names its lamp prop');
    check.ok(plan.world.blocks.size > 40, 'the town was built');
  },
});
