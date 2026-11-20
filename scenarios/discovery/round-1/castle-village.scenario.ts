// Discovery round 1: a castle on a crag with a village at its foot: a ramp
// up to the gate, an inn and a smith by the road, a village green ringed by
// cottages, a pond, a paddock, a tilting field fenced by the castle, a mill.
//
//   npm run shots -- disc1-castle-village

import { scenario } from '@/scenario';
import { close, quarters, road } from './lib';

export default scenario({
  name: 'disc1-castle-village',
  seed: 9103,
  about: 'Discovery: a walled castle on a crag and the village at its foot, with a green, a pond and fields.',
  terrain(t) {
    t.flat(1);
    t.disc(26, 13, 6.5, 3); // the crag: a cliff of two all round
    t.set(26, 20, 2).set(25, 20, 2).set(27, 20, 2); // the ramp shoulder
    t.disc(6, 31, 2.4, 0); // the pond
    t.water(4, 41, 43, 43);
  },
  build(b) {
    // The castle: a keep, a ring of curtain wall, four turrets, a gatehouse to the south.
    b.fill('marble', 25, 11, 27, 13, { floors: 4, color: 1 });
    for (const [x, z] of [[22, 9], [30, 9], [22, 17], [30, 17]] as const) b.tower(x, z, { floors: 3, color: 2 });
    for (let x = 23; x <= 29; x++) b.put('wall', x, 9);
    for (let z = 10; z <= 16; z++) b.put('wall', 22, z).put('wall', 30, z);
    for (const x of [23, 24, 28, 29]) b.put('wall', x, 17);
    b.stack('marble', 25, 17, { floors: 2, color: 3 }).stack('marble', 27, 17, { floors: 2, color: 3 });
    b.put('arch', 26, 17);
    b.edit({ type: 'placeFloor', cell: b.cell(26, 3, 17), floor: 'path' });
    road(b, [26, 18], [26, 25]); // the ramp down to the village
    road(b, [26, 16], [26, 14]);
    // The village street, east-west across the foot of the ramp.
    road(b, [8, 25], [40, 25]);
    // The inn and the smith by the castle road.
    b.house(27, 23, { w: 3, d: 2, floors: 2, color: 5 });
    b.house(24, 23, { w: 2, floors: 1, color: 7 });
    b.tower(23, 23, { floors: 2, color: 0 }); // a forge chimney?
    // The village green: grass ringed by cottages and the street, with a big tree.
    for (const [x, z] of [[14, 27], [16, 27], [18, 27], [20, 27], [14, 33], [16, 33], [18, 34], [21, 32]] as const) b.house(x, z, { floors: 1 + ((x + z) % 2), color: (x * 3 + z) % 8 });
    b.put('tree', 18, 30);
    road(b, [13, 25], [13, 33]);
    road(b, [22, 25], [22, 31]);
    // A chapel off the green with a walled yard.
    b.house(8, 21, { w: 3, d: 2, color: 6 });
    b.tower(11, 21, { floors: 3, color: 4 });
    b.fenceAround(8, 23, 11, 23, 'wall');
    // A paddock east of the village, fenced; a tilting yard by the castle, fenced with a gap.
    b.fenceAround(32, 27, 39, 32);
    b.put('tree', 37, 31);
    for (let x = 32; x <= 39; x++) if (x !== 35) b.fenceEdge(x, 20, 'N');
    for (let x = 32; x <= 39; x++) b.fenceEdge(x, 22, 'S');
    // A windmill and its field to the west.
    b.stack('windmill', 6, 14, { floors: 2 });
    b.house(7, 14, { color: 2 });
    b.garden(6, 15, 9, 18);
    road(b, [8, 25], [8, 19]);
    // Houses strung along the street east, and a farm on the edge.
    for (const x of [30, 33, 36, 39]) b.house(x, 23, { floors: 2, color: x % 8 });
    b.house(36, 35, { w: 3, d: 2, floors: 1, color: 1 }); // a barn?
    b.house(39, 35, { floors: 2, color: 3 });
    road(b, [37, 25], [37, 34]);
    b.garden(33, 37, 40, 39);
    b.put('tree', 6, 34).put('tree', 7, 35).put('tree', 9, 36).put('tree', 5, 9).put('tree', 40, 12).put('tree', 41, 14);
  },
  cameras: [
    ...quarters([24, 2, 23], 1.8),
    close('castle', 26, 4, 13, 45, 3.6),
    close('gate', 26, 3, 18, 45, 5),
    close('green', 17, 1.2, 30, 45, 4),
    close('fields', 35, 1, 26, 135, 3.6),
    close('chapel', 9, 1.5, 22, 315, 5),
  ],
});
