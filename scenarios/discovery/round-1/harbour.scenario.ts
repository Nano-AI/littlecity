// Discovery round 1: a working harbour town on a south-facing bay, built the
// way a player would: a quay and its street, warehouses, a harbour square, a
// breakwater with a light, a chapel on the bluff, and the odd half-finished
// patch (an empty plot in the row, a lone jetty, a second plaza scrap).
//
//   npm run shots -- disc1-harbour

import { scenario } from '@/scenario';
import { close, quarters, road } from './lib';

export default scenario({
  name: 'disc1-harbour',
  seed: 9101,
  about: 'Discovery: a harbour town on a bay with quay, warehouses, harbour square, breakwater and a chapel on the bluff.',
  terrain(t) {
    t.flat(1);
    t.water(4, 31, 43, 43); // the sea
    t.disc(24, 32, 5, 0); // the bay bites into the land
    t.rect(8, 5, 22, 12, 2); // the bluff
    t.rect(10, 6, 18, 10, 3);
    t.rect(30, 6, 40, 14, 2); // a second rise to the east
  },
  build(b) {
    // The harbour street along the shore, and the quay in front of it.
    road(b, [6, 28], [17, 28]);
    road(b, [31, 28], [41, 28]);
    road(b, [17, 28], [17, 25], [31, 25], [31, 28]); // round the bay
    for (let x = 6; x <= 16; x++) b.block('dock', x, 0, 31);
    for (let x = 32; x <= 40; x++) b.block('dock', x, 0, 31);
    road(b, [6, 29], [6, 30]);
    road(b, [40, 29], [40, 30]);
    // Warehouses and houses facing the quay; an empty plot at x 11.
    b.house(6, 26, { w: 3, d: 2, floors: 3, color: 7 }); // a warehouse
    b.house(9, 26, { w: 2, d: 2, floors: 2, color: 2 });
    b.house(12, 26, { w: 2, floors: 3, color: 5 });
    b.house(12, 27, { w: 2, floors: 3, color: 5 });
    b.house(14, 26, { floors: 2, color: 1 });
    b.house(15, 26, { floors: 3, color: 4 });
    b.house(32, 26, { w: 4, d: 2, floors: 2, color: 6 }); // a long store
    b.house(36, 26, { floors: 3, color: 3 });
    b.house(37, 26, { floors: 2, color: 0 });
    b.house(38, 26, { w: 2, d: 2, floors: 3, color: 7 });
    // The harbour square at the head of the bay.
    b.plaza(19, 20, 29, 24);
    b.put('fountain', 24, 22);
    b.put('stall', 21, 24).put('stall', 27, 24).put('stall', 22, 21);
    b.house(19, 17, { w: 4, d: 3, floors: 2, color: 3 }); // a big house on the square
    b.house(23, 18, { w: 2, d: 2, floors: 3, color: 1 });
    b.tower(25, 18, { floors: 5, color: 2 });
    b.house(26, 18, { w: 3, d: 2, floors: 2, color: 6 });
    b.house(29, 21, { d: 3, floors: 2, color: 4 });
    // Back lane behind the quay houses, and a second row.
    road(b, [6, 23], [17, 23]);
    b.house(6, 20, { w: 2, d: 3, floors: 2, color: 0 });
    b.house(8, 21, { floors: 2, color: 6 });
    b.house(9, 21, { floors: 1, color: 2 });
    b.house(10, 21, { floors: 2, color: 3 });
    b.house(13, 20, { w: 3, d: 2, floors: 2, color: 1 });
    // The breakwater: marble out into the sea, a light at its end.
    for (let z = 32; z <= 38; z++) b.block('marble', 42, 0, z, { color: 2 });
    b.stack('lighthouse', 42, 39, { floors: 4 });
    // A pier from the square into the bay, and a lone jetty.
    for (let z = 27; z <= 34; z++) b.block('dock', 24, 0, z);
    b.put('stall', 23, 26);
    b.block('dock', 28, 0, 34);
    b.block('dock', 29, 0, 34);
    // A sea wall of marble along the west of the bay.
    for (const [x, z] of [[18, 28], [18, 29], [19, 30]] as const) b.block('marble', x, 1, z, { color: 1 });
    // The chapel on the bluff and a path up to it.
    road(b, [17, 23], [17, 12], [13, 12], [13, 11]);
    b.house(11, 7, { w: 3, d: 2, color: 5 });
    b.tower(14, 7, { floors: 4, color: 0 });
    b.garden(11, 9, 14, 10); // the churchyard?
    b.fenceAround(11, 9, 14, 10, 'wall');
    // Fishermen's cottages on the east rise.
    road(b, [31, 25], [34, 25], [34, 15]);
    for (const [x, z] of [[32, 13], [35, 12], [36, 14], [32, 10], [37, 9]] as const) b.house(x, z, { floors: 1, color: (x + z) % 8 });
    b.garden(35, 16, 38, 19);
    b.put('tree', 9, 15).put('tree', 20, 9).put('tree', 26, 11).put('tree', 40, 20).put('tree', 41, 22);
  },
  cameras: [
    ...quarters([24, 1, 24], 1.8),
    close('square', 24, 1.5, 22, 45, 4.5, 40),
    close('quay-west', 11, 1.5, 28, 45, 4.5),
    close('quay-east', 36, 1.5, 28, 45, 4.5),
    close('breakwater', 41, 1, 35, 315, 4),
    close('chapel', 13, 3.5, 9, 45, 5),
    close('backlane', 11, 1.5, 23, 225, 5),
    close('sea-wall', 18.5, 1.2, 29, 45, 6),
  ],
});
