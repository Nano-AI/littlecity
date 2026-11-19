// L27 · Displaced. Where newcomers come ashore for each home, and where
// those whose home is gone walk off. (The hop, the leaving and the arriving
// are the crowd's: src/life/people/crowd.test.ts.)

import { scenario } from '@/scenario';

export default scenario({
  name: 'L27.displaced',
  seed: 45,
  about: 'A dock on the west shore, a beach to the south, a house on a mesa with no way up: arrivals by the dock, ways out at the water and the street ends.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
    t.rect(30, 8, 34, 12, 3); // a mesa nobody can climb
  },
  build(b) {
    for (let x = 3; x >= 1; x--) b.block('dock', x, 0, 16);
    b.path(4, 16, 20, 16);
    b.house(8, 17, { floors: 2, w: 2, color: 1 });
    b.house(14, 14, { floors: 2, w: 2, color: 3 });
    b.house(32, 10, { floors: 2, color: 5 });
    b.house(24, 26, { floors: 1, w: 2, color: 2 }); // down by the beach
  },
  cameras: [{ name: 'town', yaw: 45, pitch: 34, zoom: 2.2, target: [18, 1, 18] }],
  expect(_plan, dressing, check) {
    const nav = dressing.nav;
    const arrivals = check.sockets({ type: 'arrival' });
    const of = (x: number, y: number, z: number) => arrivals.filter((s) => s.structure === check.structure(x, y, z).id);
    const surface = (cell: number): string => nav.nodes[nav.nodeAt.get(cell)!]!.surface;
    // The street houses are reached from the dock.
    check.equal(of(8, 1, 17).length, 1, 'landings for the first house');
    check.equal(surface(of(8, 1, 17)[0]!.cell), 'deck', 'the first house lands at');
    check.equal(surface(of(14, 1, 14)[0]!.cell), 'deck', 'the second house lands at');
    // The beach house is much nearer the beach than the dock.
    check.equal(surface(of(24, 1, 26)[0]!.cell), 'sand', 'the beach house lands at');
    // The mesa has no route to the water: its people are simply there.
    check.equal(of(32, 3, 10).length, 0, 'landings for the house on the mesa');
    // Ways out: the dock's cells, some of the beach, the end of the street.
    const outs = check.sockets({ type: 'way-out' });
    check.ok(outs.length >= 5, 'several ways out');
    check.hasSocket({ type: 'way-out', at: [1, 1, 16] });
    check.hasSocket({ type: 'way-out', at: [20, 1, 16] });
    check.ok(outs.every((s) => nav.nodeAt.has(s.cell)), 'all on the walking graph');
  },
});
