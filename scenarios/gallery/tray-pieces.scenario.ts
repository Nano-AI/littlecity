// A gallery entry: one of every tray piece, side by side, for looking at the
// whole family at once (art review, palette tuning). `npm run shots --
// tray-pieces` renders it; the gallery page lists it under "Gallery entries".
//
// Everything is placed as a player could place it under design section 7:
// pieces on flat ground, the dock on open water, edge pieces on the
// boundaries of squares of land.

import { scenario } from '@/scenario';

export default scenario({
  name: 'tray-pieces',
  seed: 12,
  about: 'One of every tray piece: the Build row, the Ground and Nature pieces, the three floors with edge fences and walls, and a dock.',
  terrain(t) {
    t.flat(1);
    t.water(17, 30, 32, 43); // a bay for the dock
  },
  build(b) {
    // Build: Auto, house, tower, lighthouse, arch, marble, pillar.
    b.auto(18, 22);
    b.house(20, 22);
    b.tower(22, 22, { floors: 3 });
    b.stack('lighthouse', 24, 22, { floors: 4 });
    b.put('arch', 26, 22);
    b.put('marble', 28, 22);
    b.stack('pillar', 30, 22, { floors: 2 });
    // Stairs up onto a marble block, a windmill, then the small pieces.
    b.put('marble', 19, 25);
    b.block('stairs', 18, 1, 25, { rot: 1 });
    b.stack('windmill', 21, 25, { floors: 2 });
    b.put('tree', 23, 25);
    b.put('fountain', 25, 25);
    b.put('stall', 27, 25);
    b.put('fence', 29, 25);
    b.put('wall', 31, 25);
    // Floors, with edge pieces along their south sides.
    b.path(18, 27, 20, 27);
    b.plaza(22, 27, 24, 27);
    b.garden(26, 27, 28, 27);
    for (const x of [22, 23, 24]) b.wallEdge(x, 27, 'S');
    for (const x of [26, 27, 28]) b.fenceEdge(x, 27, 'S');
    // The dock, at level 0 on the water.
    b.block('dock', 20, 0, 30);
    b.block('dock', 21, 0, 30);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 35, zoom: 2.9, target: [24.5, 1, 26] },
    { name: 'back', yaw: 225, pitch: 40, zoom: 2.9, target: [24.5, 1, 26] },
  ],
  expect(plan, _dressing, check) {
    check.equal(plan.world.blocks.size, 24, 'blocks placed');
    check.equal(plan.world.floors.size, 9, 'floor cells');
    check.equal(plan.world.edges.size, 6, 'edge pieces');
    check.kind(20, 1, 22, 'house');
    check.kind(20, 0, 30, 'dock');
    check.floorStructure(23, 1, 27);
  },
});
