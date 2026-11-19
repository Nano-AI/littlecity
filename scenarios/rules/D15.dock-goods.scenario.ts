// Fixture for D15 (dock goods) and D08 (café tables).
//   a quay of eight cells with a promenade behind   rope coils, lobster pots, a stack or two of goods, and
//                                                   one rack of nets; nothing on the cells J23 already
//                                                   stacked goods on, nothing on the walking line
//   a pier with boards down its middle              things in its corners only; none on its head
//   a jetty of two cells                            too small for a net rack
//   a row of shops on a square                      any café among them sets out tables with parasols on
//                                                   the paving in front, never in front of a door

import { scenario } from '@/scenario';

export default scenario({
  name: 'D15.dock-goods',
  seed: 1515,
  about: 'Rope, lobster pots, goods and a net rack on docks, off the walking line; café tables with parasols in front of a café.',
  terrain(t) {
    t.flat(1);
    t.water(4, 28, 43, 43);
  },
  build(b) {
    b.path(8, 27, 36, 27);
    for (let x = 10; x <= 17; x++) b.block('dock', x, 0, 28);
    for (let z = 28; z <= 33; z++) b.block('dock', 23, 0, z);
    b.path(23, 28, 23, 32);
    b.block('dock', 30, 0, 28).block('dock', 30, 0, 29);
    // Shops along the north side of a square.
    b.plaza(9, 16, 28, 19);
    for (let i = 0; i < 9; i++) b.house(9 + i * 2, 15, { w: 2, floors: 2, color: i % 8 });
  },
  cameras: [
    { name: 'docks', yaw: 45, pitch: 34, zoom: 3.4, target: [20, 1, 29] },
    { name: 'quay', yaw: 30, pitch: 30, zoom: 7, target: [13.5, 1.1, 28.5] },
    { name: 'pier', yaw: 60, pitch: 30, zoom: 7, target: [23.5, 1.1, 30.5] },
    { name: 'shops', yaw: 25, pitch: 30, zoom: 4.4, target: [18, 1.4, 17] },
    { name: 'cafe', yaw: 25, pitch: 26, zoom: 9, target: [18, 1.3, 16.5] },
    { name: 'dusk', yaw: 45, pitch: 34, zoom: 3.4, target: [20, 1, 29], time: 'dusk' },
  ],
  expect(plan, dressing, check) {
    const goods = dressing.props.filter((p) => p.rule === 'D15.dock-goods');
    const at = (p: (typeof dressing.props)[number]): [number, number, number, string] => ('cell' in p.at ? [p.at.cell & 63, p.at.cell >> 12, (p.at.cell >> 6) & 63, p.at.pos] : [-1, -1, -1, '']);
    check.ok(goods.length >= 4, `the docks have things on them (${goods.length})`);
    const cells = new Set<number>();
    for (const p of goods) {
      const [x, y, z, pos] = at(p);
      check.equal(y, 1, 'on the deck');
      check.equal(plan.kinds.get(x | (z << 6)), 'dock', 'on a dock');
      check.ok(!cells.has(x | (z << 6)), 'one thing to a deck cell');
      cells.add(x | (z << 6));
      if (x === 23) check.ok(pos.length === 2 || p.type === 'net-rack', 'on the pier, in a corner or along its edge: never on the boards down the middle');
      check.ok(!(x === 23 && z === 33), 'nothing on the pier head');
    }
    const racks = goods.filter((p) => p.type === 'net-rack');
    check.equal(racks.length, 2, 'one net rack on the quay and one on the pier');
    check.ok(!goods.some((p) => at(p)[0] === 30 && p.type === 'net-rack'), 'a two-cell jetty has no net rack');
    check.ok(goods.some((p) => p.type === 'rope-coil'), 'a coil of rope somewhere');
    // D08: every café with room has tables; nobody else does.
    const tables = dressing.props.filter((p) => p.type === 'cafe-table');
    const cafes = [...plan.tags].filter(([, tags]) => tags.has('shop:cafe')).map(([id]) => id);
    check.ok(cafes.length >= 1, 'the row has a café (the fixture is seeded for one)');
    check.ok(tables.length >= 2 && tables.length <= 4 * cafes.length, `tables in front of the café (${tables.length})`);
    for (const p of tables) {
      const [x, , z, pos] = at(p);
      check.ok(z === 16 || z === 17, 'on the paving outside, at most two cells out');
      check.equal(pos, 'c', 'in the middle of a square cell');
      check.ok(cafes.includes(plan.structureAt.get(x | (15 << 6) | (1 << 12)) ?? -1), 'in front of the café itself');
      check.equal(dressing.sockets.filter((s) => s.owner === p.id && s.type === 'seat').length, 2, 'two seats to a table');
      check.ok(z !== 16 || !plan.features.some((f) => f.type === 'door' && f.cell === (x | (15 << 6) | (1 << 12)) && f.dir === 2), 'never right in front of a door');
    }
  },
});
