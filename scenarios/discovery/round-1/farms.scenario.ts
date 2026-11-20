// Discovery round 1: farms and hamlets at the edge of things: a tiny hamlet
// of five buildings at a crossroads (the "tiny hamlet" test), a farmstead
// with a barn-sized house, fields fenced with gaps, an orchard, a windmill
// with its wheat, a pond, a lane that runs off into nothing, a lone cottage.
//
//   npm run shots -- disc1-farms

import { scenario } from '@/scenario';
import { close, quarters, road } from './lib';

export default scenario({
  name: 'disc1-farms',
  seed: 9107,
  about: 'Discovery: a five-building hamlet at a crossroads, farmsteads, fenced fields with gaps, an orchard and a mill.',
  terrain(t) {
    t.flat(1);
    t.disc(28, 34, 2, 0); // a pond
    t.rect(4, 4, 14, 12, 2); // a low hill to the north-west
  },
  build(b) {
    // The crossroads and the hamlet of five: three cottages, a chapel-sized house, a stall.
    road(b, [6, 24], [42, 24]);
    road(b, [24, 14], [24, 40]);
    b.house(22, 22, { w: 2, floors: 2, color: 2 });
    b.house(26, 22, { floors: 1, color: 5 });
    b.house(22, 26, { floors: 1, color: 0 });
    b.house(26, 26, { w: 2, d: 2, floors: 2, color: 3 });
    b.put('stall', 25, 25);
    b.put('fountain', 23, 25); // a pump at the crossroads?
    // A farmstead to the east: farmhouse, a big low barn, a yard between, fields.
    b.house(34, 20, { w: 2, floors: 2, color: 4 });
    b.house(37, 19, { w: 4, d: 3, floors: 1, color: 7 }); // the barn
    b.put('tree', 36, 22);
    b.garden(30, 14, 41, 17); // a big field
    b.fenceAround(30, 14, 41, 17);
    // A fenced pasture with a gap in the fence (unfinished), and one fully fenced.
    for (let x = 30; x <= 37; x++) b.fenceEdge(x, 27, 'N');
    for (let z = 27; z <= 29; z++) b.fenceEdge(30, z, 'W');
    for (let x = 30; x <= 33; x++) b.fenceEdge(x, 29, 'S');
    b.fenceAround(36, 33, 41, 38);
    // An orchard: trees in a grid on grass, half fenced.
    for (let x = 8; x <= 16; x += 2) for (let z = 28; z <= 36; z += 2) b.put('tree', x, z);
    for (let x = 7; x <= 17; x++) b.fenceEdge(x, 37, 'S');
    // A windmill with its wheat, up the lane to the north-west.
    road(b, [24, 14], [12, 14], [12, 12]);
    b.stack('windmill', 10, 9, { floors: 2 });
    b.garden(6, 6, 9, 10);
    b.garden(11, 6, 13, 8);
    // A lone cottage off the end of a lane that stops in the grass.
    road(b, [24, 40], [18, 40]);
    b.house(40, 40, { floors: 1, color: 6 });
    // A row of hay-coloured... just a kitchen garden by the farmhouse.
    b.garden(33, 21, 33, 23);
    // A lane running off south-east to nothing.
    road(b, [42, 24], [42, 30]);
    b.put('tree', 20, 10).put('tree', 28, 8).put('tree', 40, 9).put('tree', 18, 20).put('tree', 6, 40);
  },
  cameras: [
    ...quarters([24, 1, 24], 1.8),
    close('hamlet', 24, 1, 24, 45, 5, 38),
    close('farmstead', 36, 1, 20, 45, 4.5),
    close('pastures', 34, 1, 31, 135, 4),
    close('orchard', 12, 1, 32, 315, 4.5),
    close('mill', 10, 2.5, 9, 45, 5),
  ],
});
