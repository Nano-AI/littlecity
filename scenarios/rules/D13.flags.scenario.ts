// Fixture for D13 (flags) and D13-T (the tallest structure's flag).
//   a row of six watchtowers          about half fly a pennant
//   a castle turret (tower between marble)   a swallow-tailed banner, always
//   a lighthouse                      a pennant on its gallery, always
//   the tallest tower of all          a pennant whatever its roll said (D13-T)
//   three piers                       a pennant on a tall staff at about half the ends
//                                     (the others keep the harbour lamp of D20)
// All of one colour: the town's.

import { scenario } from '@/scenario';

export default scenario({
  name: 'D13.flags',
  seed: 1313,
  about: 'Pennants on about half the watchtowers and pier ends, a banner on every castle turret, a pennant on every lighthouse gallery and on the tallest structure; one colour per town.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
  },
  build(b) {
    for (let i = 0; i < 6; i++) b.tower(8 + i * 3, 10, { floors: 3, color: i });
    b.stack('marble', 9, 17, { floors: 2 }).stack('marble', 10, 16, { floors: 2 }).tower(10, 17, { floors: 4, color: 1 });
    b.stack('lighthouse', 16, 25, { floors: 4 }); // within 6 of the sea: a lighthouse, not a folly (R-L02)
    b.tower(22, 17, { floors: 7, color: 2 });
    for (const x of [10, 16, 22, 28, 34]) for (let z = 30; z <= 33; z++) b.block('dock', x, 0, z);
    b.path(8, 29, 36, 29);
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 30, zoom: 2.4, target: [20, 2, 19] },
    { name: 'all-back', yaw: 225, pitch: 30, zoom: 2.4, target: [20, 2, 19] },
    { name: 'towers', yaw: 30, pitch: 22, zoom: 5.5, target: [15.5, 3, 10] },
    { name: 'castle', yaw: 60, pitch: 24, zoom: 6, target: [13, 3.2, 17] },
    { name: 'piers', yaw: 45, pitch: 30, zoom: 4.5, target: [22, 1, 31] },
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 2.4, target: [20, 2, 19], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const flags = dressing.props.filter((p) => p.type === 'flag');
    const on = (x: number, z: number): typeof flags => flags.filter((p) => 'socket' in p.at && dressing.props.length > 0 && check.sockets({}).some((s) => s.id === (p.at as { socket: string }).socket && (s.cell & 63) === x && ((s.cell >> 6) & 63) === z));
    // Watchtowers: some but not all.
    const towers = [0, 1, 2, 3, 4, 5].map((i) => on(8 + i * 3, 10).length);
    check.ok(towers.every((n) => n <= 1), 'at most one flag per tower');
    const flying = towers.reduce((a, n) => a + n, 0);
    check.ok(flying >= 1 && flying <= 5, `some watchtowers fly a pennant, not all (${flying} of 6)`);
    // The turret's banner, the lighthouse's pennant, the tallest tower's pennant.
    check.equal(on(10, 17).map((p) => p.variant).join(), 'banner', 'the castle turret flies a banner');
    check.equal(on(16, 25).map((p) => p.variant).join(), 'pennant', 'the lighthouse gallery flies one pennant');
    check.equal(on(22, 17).length, 1, 'the tallest structure flies a flag');
    check.ok(on(22, 17)[0]!.rule === 'D13.flags' || on(22, 17)[0]!.rule === 'D13-T.tallest-flag', 'from D13 or D13-T');
    // Piers: every end has a pennant or a lamp, never both.
    const piers = [10, 16, 22, 28, 34];
    let pennants = 0;
    for (const x of piers) {
      const flag = on(x, 33).length;
      const lamp = dressing.props.filter((p) => p.type === 'lamp' && p.variant === 'pier' && 'socket' in p.at && check.sockets({ type: 'pier-end', at: [x, 0, 33] }).some((s) => s.id === (p.at as { socket: string }).socket)).length;
      check.equal(flag + lamp, 1, `the pier at ${x} has a pennant or a lamp`);
      pennants += flag;
    }
    check.ok(pennants >= 1 && pennants <= 4, `some piers fly a pennant, some keep a lamp (${pennants} of 5)`);
    check.equal(new Set(flags.map((p) => (p.params as { color: number }).color)).size, 1, 'every flag is the town colour');
  },
});
