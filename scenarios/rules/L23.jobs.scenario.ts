// L23 · Jobs (with L08's lamplighter). A town with one of every workplace:
// shops, a stall, a garden, a pier, a lighthouse, a windmill with its mill
// house, a keep with stairs up to its top, a chapel with its steeple, and a
// street that the lamp rules (D01, D02) light.

import { scenario } from '@/scenario';
import { PEOPLE } from '@/style/people';

export default scenario({
  name: 'L23.jobs',
  seed: 47,
  about: 'One of every workplace, and a street of lamps for the lamplighter.',
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
    // A market pavement across the street from the shops: it makes the street the high street (R-H07).
    b.plaza(15, 19, 24, 19);
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
    const shops = [...plan.roles.values()].filter((r) => r.role === 'shop').length;
    check.ok(shops >= 1 && of('shopkeeper').length + of('baker').length >= shops, 'a keeper or a baker at each shop');
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
    // The lamplighter's round: lamp posts only, each once, numbered in order, all in one walkable part
    // of the town, and no more of them than can be walked in a dusk.
    const round = of('lamplighter').sort((a, b) => Number(a.name!.split('|')[1]) - Number(b.name!.split('|')[1]));
    const refs = round.map((s) => s.name!.split('|')[2]!);
    const posts = dressing.props.filter((p) => p.type === 'lamp');
    check.ok(posts.length > 0, 'the street has lamps');
    check.ok(round.length > 0 && round.length <= PEOPLE.lampRound, `a round of 1 to ${PEOPLE.lampRound} lamps (${round.length})`);
    check.equal(round.length, Math.min(posts.length, PEOPLE.lampRound), 'lamps on the round');
    check.equal(new Set(refs).size, round.length, 'distinct lamps on the round');
    check.ok(round.every((s, i) => Number(s.name!.split('|')[1]) === i), 'numbered in order');
    check.ok(refs.every((id) => posts.some((p) => p.id === id)), 'each stop names a lamp post');
    check.ok(!refs.some((id) => dressing.props.some((p) => p.id === id && p.type !== 'lamp')), 'no lanterns on the round');
    check.equal(new Set(round.map((s) => nav.part[nav.nodeAt.get(s.cell)!])).size, 1, 'parts of the graph the round lies in');
    check.ok(plan.world.blocks.size > 40, 'the town was built');
  },
});
