// Fixture for D03 (benches).
//   a 6 × 5 square with a shop on it and a street coming in   benches round its edge facing in, about one
//                                                             per four edge cells; none on a corner, none
//                                                             where the street arrives, none at the shop
//   a plaza strip two cells wide                              not a square: none
//   streets that end at the water and at the top of a bank    most get a bench facing the view, and their
//                                                             lamp stands to one side
//   a street that ends in open grass                          no bench (U06 frays it instead)

import { scenario } from '@/scenario';

export default scenario({
  name: 'D03.benches',
  seed: 3031,
  about: 'Benches round the edge of a square facing in, about one per four edge cells; a bench facing the view where a street ends at water or a drop.',
  terrain(t) {
    t.flat(1);
    t.rect(26, 8, 40, 16, 2); // a terrace
    t.water(4, 28, 43, 43);
  },
  build(b) {
    b.plaza(9, 11, 14, 15);
    b.house(10, 10, { w: 2, floors: 2, color: 2 });
    b.path(15, 13, 20, 13);
    b.plaza(9, 19, 14, 20);
    // Streets down to the water.
    for (const x of [10, 16, 22, 28, 34]) b.path(x, 23, x, 27);
    b.path(10, 22, 34, 22);
    // Streets to the edge of the terrace.
    b.path(30, 10, 30, 16).path(36, 10, 36, 16).path(30, 9, 36, 9);
    // And one out into the grass.
    b.path(20, 14, 20, 18);
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 36, zoom: 2.2, target: [22, 1, 18] },
    { name: 'square', yaw: 45, pitch: 32, zoom: 6, target: [11.5, 1.2, 13] },
    { name: 'square-back', yaw: 225, pitch: 32, zoom: 6, target: [11.5, 1.2, 13] },
    { name: 'shore', yaw: 30, pitch: 28, zoom: 5, target: [22, 1, 26.5] },
    { name: 'terrace', yaw: 45, pitch: 30, zoom: 6, target: [33, 2, 16] },
    { name: 'dusk', yaw: 30, pitch: 28, zoom: 5, target: [22, 1, 26.5], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const benches = dressing.props.filter((p) => p.rule === 'D03.benches');
    const at = (p: (typeof benches)[number]): [number, number, string, number | undefined] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63, p.at.pos, p.at.face] : [-1, -1, '', undefined]);
    const square = benches.filter((p) => at(p)[0] >= 9 && at(p)[0] <= 14 && at(p)[1] >= 11 && at(p)[1] <= 15);
    check.ok(square.length >= 3 && square.length <= 6, `benches round the square (${square.length} for 18 edge cells)`);
    for (const p of square) {
      const [x, z, pos, face] = at(p);
      const corner = (x === 9 || x === 14) && (z === 11 || z === 15);
      check.ok(!corner, 'no bench on a corner cell');
      check.ok(!(x === 14 && z === 13), 'none where the street arrives');
      // Standing at the edge, facing in.
      const inward = pos === 'n' ? 2 : pos === 's' ? 0 : pos === 'e' ? 3 : 1;
      check.equal(face, inward, 'a bench on a square faces in');
    }
    check.ok(!benches.some((p) => at(p)[1] >= 19 && at(p)[1] <= 20 && at(p)[0] <= 14), 'a strip is not a square');
    // The views.
    const shore = benches.filter((p) => at(p)[1] === 27);
    check.ok(shore.length >= 2 && shore.length <= 5, `most streets to the water end in a bench (${shore.length} of 5)`);
    for (const p of shore) {
      check.ok(at(p)[2] === 's' && at(p)[3] === 2, 'it stands at the end and faces the water');
      check.ok(!dressing.props.some((q) => q.type === 'lamp' && 'cell' in q.at && 'cell' in p.at && q.at.cell === p.at.cell && q.at.pos.includes('s')), 'the lamp stands to one side');
    }
    const terrace = benches.filter((p) => at(p)[1] === 16 && at(p)[0] >= 26);
    check.ok(terrace.length >= 1, 'a street that ends at the top of a bank has a bench looking out');
    check.ok(!benches.some((p) => at(p)[0] === 20 && at(p)[1] === 18), 'no bench where a street ends in open grass');
    for (const p of benches) check.equal(dressing.sockets.filter((s) => s.owner === p.id && s.type === 'seat').length, 2, 'two seats to a bench');
  },
});
