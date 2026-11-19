// Fixture for U07 (retaining wall). A hill of three terraces with streets on
// and under it:
//   a street along the foot of the first bank, round its corner    a wall that follows the rounded corner
//   a street up the hill by carved steps                           the wall stops either side of the steps
//   a street along the top of a bank                               the bank below it is walled too
//   a small square against a two-level cliff                       a tall wall
//   the back of the hill, where no street runs                     raw earth: no wall
//   a beach bank beside a path                                     no wall on sand

import { scenario } from '@/scenario';

export default scenario({
  name: 'U07.retaining-wall',
  seed: 7707,
  about: 'A terrain step beside a street or plaza is faced with a stone wall that follows the terrace outline; none where no street runs, none at carved steps, none on sand.',
  terrain(t) {
    t.flat(1);
    t.rect(14, 8, 30, 20, 2);
    t.rect(18, 8, 30, 15, 3);
    t.rect(24, 8, 30, 11, 4);
  },
  build(b) {
    b.path([13, 6], [13, 21], [31, 21]); // along the west foot and round the south foot
    b.path([8, 24], [20, 24]); // away from the hill: nothing to wall
    b.path([16, 20], [16, 17]); // up the hill by steps
    b.path([15, 17], [15, 16], [30, 16]); // along the top of the first bank, under the second
    b.plaza(31, 9, 33, 12); // a square under the cliff
    b.house(20, 18, { floors: 2, color: 2 });
    b.house(24, 18, { color: 4 });
    b.house(26, 13, { floors: 2, color: 0 });
    b.put('tree', 21, 12).put('tree', 28, 9);
  },
  cameras: [
    { name: 'hill', yaw: 45, pitch: 34, zoom: 2.6, target: [22, 2, 15] },
    { name: 'hill-nw', yaw: 225, pitch: 34, zoom: 2.6, target: [22, 2, 15] },
    { name: 'hill-ne', yaw: 315, pitch: 34, zoom: 2.6, target: [22, 2, 15] },
    { name: 'corner', yaw: 60, pitch: 30, zoom: 7, target: [13.5, 1.4, 20.5] },
    { name: 'steps', yaw: 20, pitch: 30, zoom: 7, target: [16, 1.6, 20] },
    { name: 'upper', yaw: 45, pitch: 30, zoom: 6, target: [22, 2.6, 15.5] },
    { name: 'cliff', yaw: 300, pitch: 28, zoom: 6, target: [31, 2, 10.5] },
    { name: 'dusk', yaw: 45, pitch: 34, zoom: 2.6, target: [22, 2, 15], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const walls = dressing.props.filter((p) => p.type === 'retaining-wall');
    const where = walls.map((p) => ('cell' in p.at ? ([p.at.cell & 63, p.at.cell >> 12, (p.at.cell >> 6) & 63, p.at.pos] as const) : ([0, 0, 0, 'c'] as const)));
    const has = (x: number, z: number, pos: string): boolean => where.some((w) => w[0] === x && w[2] === z && w[3] === pos);
    // The foot of the hill: every cell of the two streets beside the bank.
    for (let z = 8; z <= 20; z++) check.ok(has(13, z, 'e'), `wall beside the west street at z = ${z}`);
    for (let x = 14; x <= 30; x++) if (x !== 16) check.ok(has(x, 21, 'n'), `wall beside the south street at x = ${x}`);
    // The carved steps keep their opening.
    check.hasFeature({ type: 'terrain-steps', at: [16, 1, 21] });
    check.ok(!has(16, 21, 'n'), 'no wall across the carved steps');
    // The square under the cliff: a wall three levels tall on its west side.
    const tall = walls.filter((p) => (p.params as { height: number }).height === 3);
    check.ok(tall.length >= 2, 'the cliff beside the square has a tall wall');
    // The north side of the hill has no street: bare.
    for (let x = 14; x <= 30; x++) check.ok(!has(x, 7, 's'), `no wall on the back of the hill at x = ${x}`);
    // Nothing else stands at the foot of a wall.
    for (const w of walls) {
      const cell = 'cell' in w.at ? w.at.cell : -1;
      const pos = 'cell' in w.at ? w.at.pos : 'c';
      check.equal(dressing.props.filter((p) => 'cell' in p.at && p.at.cell === cell && p.at.pos === pos).length, 1, 'only the wall stands on its slot');
    }
    check.ok(walls.some((p) => (p.params as { creeper: number }).creeper === 1), 'some pieces carry a creeper');
  },
});
