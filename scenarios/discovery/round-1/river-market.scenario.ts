// Discovery round 1: a market town at a river crossing: a bridge into a
// market square, warehouses and a quay on the river, a house on the bank
// where a mill would be, a ford where a path simply runs into the water, a
// second bridge at the bend, and the far bank half settled.
//
//   npm run shots -- disc1-river-market

import { scenario } from '@/scenario';
import { close, quarters, road } from './lib';

export default scenario({
  name: 'disc1-river-market',
  seed: 9104,
  about: 'Discovery: a market town at a river crossing, with two bridges, a river quay and a ford.',
  terrain(t) {
    t.flat(1);
    t.water(4, 24, 27, 25); // the river, west part
    t.water(26, 14, 27, 25); // the bend north
    t.water(26, 14, 43, 15); // and out to the east sea
    t.rect(30, 30, 40, 40, 2); // a rise on the far bank
  },
  build(b) {
    // The main road north–south over the first bridge.
    road(b, [14, 6], [14, 23]);
    b.block('arch', 14, 0, 24).block('arch', 14, 0, 25);
    road(b, [14, 26], [14, 40]);
    b.path(14, 24).path(14, 25);
    // The market square at the north bridgehead.
    b.plaza(8, 16, 13, 22);
    b.plaza(15, 16, 20, 22);
    b.put('marble', 17, 19); // a market cross?
    b.put('stall', 9, 18).put('stall', 10, 20).put('stall', 16, 17).put('stall', 18, 21).put('stall', 19, 17);
    b.house(8, 13, { w: 4, d: 3, floors: 2, color: 3 }); // the market hall
    b.house(15, 13, { w: 2, d: 3, floors: 3, color: 5 });
    b.house(17, 13, { w: 2, d: 2, floors: 2, color: 1 });
    b.house(19, 13, { floors: 3, color: 6 });
    b.house(21, 16, { d: 3, floors: 2, color: 2 });
    b.house(21, 19, { d: 4, floors: 2, color: 0 });
    b.house(6, 16, { w: 2, d: 4, floors: 2, color: 4 });
    // The river quay west of the bridge and its warehouses.
    road(b, [6, 23], [13, 23]);
    for (let x = 6; x <= 11; x++) b.block('dock', x, 0, 24);
    b.house(6, 20, { w: 2, d: 3, floors: 3, color: 7 });
    // A house on the bank where the bend is (a mill would stand here).
    b.house(24, 21, { w: 2, d: 2, floors: 2, color: 5 });
    road(b, [22, 23], [25, 23]);
    // A ford: a path on each side running into the water.
    road(b, [8, 26], [8, 30]);
    road(b, [8, 22]);
    // The second bridge at the bend, carrying an east road.
    road(b, [22, 20], [25, 20]);
    b.block('arch', 26, 0, 20).block('arch', 27, 0, 20);
    road(b, [26, 20], [27, 20]);
    road(b, [28, 20], [38, 20]);
    // The far (south) bank: a few houses and a church on the rise, unfinished.
    road(b, [14, 30], [30, 30], [30, 34], [34, 34]);
    for (const x of [10, 12, 16, 18, 20]) b.house(x, 28, { w: 1, floors: 2, color: x % 8 });
    b.house(32, 32, { w: 3, d: 2, color: 6 });
    b.tower(35, 32, { floors: 4, color: 0 });
    b.house(16, 32, { w: 2, d: 2, floors: 1, color: 3 });
    // East bank across the bend: warehouses on the river, a quay.
    for (let x = 30; x <= 36; x++) b.block('dock', x, 0, 15);
    b.house(29, 17, { w: 3, d: 3, floors: 3, color: 7 });
    b.house(29, 21, { w: 2, d: 2, floors: 2, color: 2 });
    road(b, [32, 17], [32, 22]);
    // A riverside walk with trees along the north bank, east of the square.
    road(b, [15, 23], [21, 23]);
    b.put('tree', 4, 10).put('tree', 6, 8).put('tree', 35, 20).put('tree', 38, 22).put('tree', 24, 34).put('tree', 26, 38);
  },
  cameras: [
    ...quarters([20, 1, 22], 1.8),
    close('bridge', 14, 1, 24.5, 45, 5),
    close('market', 14, 1.5, 19, 45, 4, 40),
    close('ford', 8, 1, 24.5, 315, 5),
    close('bend', 26, 1, 18, 135, 4),
    close('far-bank', 26, 1.5, 31, 45, 3.8),
  ],
});
