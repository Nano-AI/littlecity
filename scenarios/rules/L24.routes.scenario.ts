// L24 · Routes. The walking graph the routes run over, and where people
// queue: the two ends of every single-file stretch.

import { key } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'L24.routes',
  seed: 43,
  about: 'A narrow flight, a wide flight, carved steps and a gate: queue points at the ends of the single-file ones only.',
  terrain(t) {
    t.flat(1);
    t.rect(28, 8, 40, 24, 2);
  },
  build(b) {
    // A narrow flight up to a terrace, and a wide one.
    b.fill('marble', 10, 10, 13, 12);
    b.block('stairs', 11, 1, 13, { rot: 0 });
    b.fill('marble', 17, 10, 21, 12);
    b.block('stairs', 18, 1, 13, { rot: 0 }).block('stairs', 19, 1, 13, { rot: 0 });
    // Carved steps where the street climbs the bank.
    b.path(8, 16, 34, 16);
    // A garden with a gate.
    b.garden(10, 19, 12, 21);
    b.fenceAround(10, 19, 12, 21);
    b.path(11, 17, 11, 19);
    b.house(22, 17, { floors: 2, w: 2, color: 2 });
    b.house(30, 17, { floors: 2, w: 2, color: 5 });
  },
  cameras: [
    { name: 'town', yaw: 45, pitch: 34, zoom: 2.4, target: [20, 1, 15] },
    { name: 'flights', yaw: 20, pitch: 30, zoom: 4.6, target: [15, 1.5, 13] },
  ],
  expect(_plan, dressing, check) {
    const nav = dressing.nav;
    const via = (v: string): number => nav.links.filter((l) => l.via === v).length;
    check.equal(via('stairs'), 3, 'stairs links');
    check.equal(via('steps'), 1, 'flights of carved steps');
    check.equal(via('gate'), 1, 'gates');
    // Single-file: the narrow flight, the carved steps, the gate. Not the wide flight.
    check.equal(nav.runs.length, 3, 'single-file stretches');
    check.equal(check.sockets({ type: 'queue-point' }).length, 6, 'queue points (one at each end of each)');
    check.hasSocket({ type: 'queue-point', at: [11, 1, 14] }); // the foot of the narrow flight
    check.hasSocket({ type: 'queue-point', at: [11, 2, 12] }); // and its head
    check.equal(check.sockets({ type: 'queue-point', at: [18, 1, 14] }).length, 0, 'queue points at the wide flight');
    check.hasSocket({ type: 'queue-point', at: [27, 1, 16] }); // below the carved steps
    check.hasSocket({ type: 'queue-point', at: [28, 2, 16] }); // and above
    // Costs (catalogue): path 1, deck 1.5, grass 3.
    const cost = (x: number, y: number, z: number): number => nav.nodes[nav.nodeAt.get(key(x, y, z))!]!.cost;
    check.equal(cost(9, 1, 16), 1, 'path');
    check.equal(cost(12, 2, 11), 1.5, 'deck');
    check.equal(cost(9, 1, 14), 3, 'grass');
  },
});
