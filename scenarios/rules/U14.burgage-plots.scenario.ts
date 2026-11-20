// Fixture for U14 (burgage plots). A street with a row of four houses on its
// south side, their doors on the street:
//   the land behind them, fenced by the player     one long garden per house: party fences out to the
//                                                  far fence, patches, a washing pole, a shed or a
//                                                  compost heap, a fruit tree at the far end, a bench
//                                                  in the sun against the back wall
//   a fenced patch with no house against it        stays a paddock (U02)
//   a fenced patch behind a single house           not a row: not burgage plots

import { scenario } from '@/scenario';

export default scenario({
  name: 'U14.burgage-plots',
  seed: 1414,
  about: 'Fenced land behind the backs of a row of houses becomes one long back garden per house, divided by low fences, each with patches, washing, a shed or compost heap and a fruit tree at the far end.',
  build(b) {
    b.path(8, 9, 30, 9);
    for (let i = 0; i < 4; i++) b.house(10 + i * 2, 10, { w: 2, floors: 1 + (i % 2), color: (i * 3) % 8 });
    // The land behind the row, fenced on its three open sides.
    for (let x = 10; x <= 17; x++) b.fenceEdge(x, 15, 'S');
    for (let z = 11; z <= 15; z++) b.fenceEdge(10, z, 'W').fenceEdge(17, z, 'E');
    // A fenced paddock off on its own.
    b.fenceAround(22, 13, 25, 15);
    // One house with fenced land behind it.
    b.house(28, 10, { w: 2, color: 5 });
    for (let x = 28; x <= 29; x++) b.fenceEdge(x, 13, 'S');
    for (let z = 11; z <= 13; z++) b.fenceEdge(28, z, 'W').fenceEdge(29, z, 'E');
  },
  cameras: [
    { name: 'plots', yaw: 200, pitch: 38, zoom: 4.5, target: [14, 1, 13] },
    { name: 'plots-front', yaw: 30, pitch: 34, zoom: 4.5, target: [14, 1, 12] },
    { name: 'all', yaw: 200, pitch: 40, zoom: 2.6, target: [20, 1, 12] },
    { name: 'dusk', yaw: 200, pitch: 38, zoom: 4.5, target: [14, 1, 13], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const rule = 'U14.burgage-plots';
    const mine = check.props({ rule });
    const xz = (p: (typeof mine)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    check.ok(mine.every((p) => xz(p)[0] >= 10 && xz(p)[0] <= 17), 'only behind the row');
    check.equal(check.props({ rule, type: 'fruit-tree' }).length, 4, 'a fruit tree at the end of each of the four gardens');
    check.ok(check.props({ rule, type: 'fruit-tree' }).every((p) => xz(p)[1] === 15), 'fruit trees at the far end');
    // Party fences on the three lines between the four plots, from the back wall to the far fence.
    const fences = check.props({ rule, type: 'garden-fence' });
    check.equal(new Set(fences.map((p) => xz(p)[0])).size, 3, 'three party lines');
    check.equal(fences.length, 15, 'each runs the five cells out to the far fence');
    check.ok(check.props({ rule, type: 'washing-pole' }).length >= 2, 'washing in the gardens');
    for (const pole of check.props({ rule, type: 'washing-pole' })) check.ok(dressing.sockets.some((s) => s.owner === pole.id && s.type === 'activity' && s.name === 'hang-washing'), 'each washing pole has a place to hang washing');
    check.hasProp({ rule, type: 'veg-patch' }, 4);
    // Must not: the lone paddock and the single house's land.
    check.hasProp({ type: 'grazer', rule: 'U02.fenced-field' });
    check.ok(!mine.some((p) => xz(p)[0] >= 22), 'no plots off the row');
  },
});
