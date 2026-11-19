// The Dressing owner's show town: one small town that has every kind of
// place the decoration and urban-fill rules know about, so their work can be
// judged together, from four sides, by day, dusk and night.
//
//   the square     a 5 × 5 plaza with shops on two sides and stalls
//   the alley      two tall rows a cell apart, west of the square
//   main street    east to west through the town, row houses set one cell
//                  back on its north side (front gardens), shops on its south
//   the harbour    a promenade, a quay, a pier, a stone bridge over the inlet,
//                  the lighthouse on the point
//   the hill       two terraces in the north-east, streets along the foot of
//                  each bank (retaining walls), carved steps, a lookout on top
//   the courtyard  a ring of houses round four cells of ground
//   leftovers      patches of grass shut in between streets and house backs
//   the fields     a fenced field with trees and an empty fenced field
//
//   npm run shots -- dressing-town [--time dusk | night]

import { scenario } from '@/scenario';

export default scenario({
  name: 'dressing-town',
  seed: 31,
  about: 'A show town for dressing: streets, a square, an alley, a harbour with a bridge, a hill with retaining walls, a courtyard, leftover patches and two fenced fields.',
  terrain(t) {
    t.rect(5, 5, 42, 33, 1);
    t.rect(27, 5, 42, 15, 2); // the hill
    t.rect(31, 5, 40, 10, 3); // its top
    t.water(31, 28, 32, 33); // the inlet
    t.water(5, 30, 7, 33); // a cove by the fields
  },
  build(b) {
    // ── streets ──
    b.path(7, 24, 40, 24); // main street
    b.path(9, 32, 30, 32); // the promenade ...
    b.block('arch', 31, 0, 32).block('arch', 32, 0, 32); // ... over the inlet by a stone bridge ...
    b.path(31, 32, 32, 32).path(33, 32, 40, 32); // ... and on to the point
    b.path(15, 25, 15, 31).path(24, 25, 24, 31).path(36, 25, 36, 31); // down to the water
    b.path(20, 22, 20, 23); // square to main street
    b.path(7, 17, 17, 17).path(7, 18, 7, 23); // the alley, and round to main street
    b.path(28, 17, 28, 23); // up toward the hill
    b.path(24, 16, 41, 16); // along the foot of the first bank
    b.path(28, 12, 28, 15); // carved steps onto the first terrace
    b.path(29, 11, 41, 11).path(28, 11); // along the foot of the second bank
    b.path(35, 9, 35, 10); // and up to the top

    // ── the square ──
    b.plaza(18, 17, 22, 21);
    b.house(18, 15, { w: 2, floors: 2, color: 2 }); // shops on its north side
    b.house(20, 15, { floors: 3, color: 6 });
    b.house(21, 15, { w: 2, floors: 2, color: 0 });
    b.house(23, 18, { d: 2, floors: 2, color: 4 }); // and its east
    b.house(23, 20, { d: 2, floors: 3, color: 1 });
    b.put('stall', 18, 21).put('stall', 22, 21);

    // ── the alley ──
    b.house(8, 16, { w: 3, floors: 3, color: 3 });
    b.house(11, 16, { w: 2, floors: 3, color: 5 });
    b.house(8, 18, { w: 2, floors: 3, color: 0 });
    b.house(10, 18, { w: 3, floors: 3, color: 7 });

    // ── main street: row houses behind front gardens (north), shops on the pavement (south) ──
    b.house(9, 22, { floors: 2, color: 1 });
    b.house(10, 22, { color: 4 });
    b.house(11, 22, { floors: 2, color: 6 });
    b.house(12, 22, { color: 2 });
    b.house(13, 22, { floors: 2, color: 0 });
    b.house(15, 22, { color: 5 });
    b.house(17, 25, { w: 2, floors: 2, color: 2 });
    b.house(19, 25, { floors: 3, color: 7 });
    b.house(20, 25, { w: 2, floors: 2, color: 4 });
    b.house(26, 25, { floors: 2, color: 3 });
    b.house(27, 25, { color: 1 });
    b.house(30, 22, { color: 6 });
    b.house(31, 22, { floors: 2, color: 2 });

    // ── the courtyard block ──
    b.house(33, 18, { w: 4, floors: 2, color: 5 });
    b.house(33, 19, { d: 2, floors: 2, color: 1 });
    b.house(36, 19, { d: 2, floors: 3, color: 3 });
    b.house(33, 21, { w: 4, floors: 2, color: 0 });

    // ── the harbour ──
    for (let x = 17; x <= 22; x++) b.block('dock', x, 0, 34); // the quay
    for (let z = 34; z <= 37; z++) b.block('dock', 27, 0, z); // the pier
    b.path(27, 33).path(27, 34, 27, 36);
    b.put('stall', 19, 31);
    b.stack('lighthouse', 40, 30, { floors: 4 });
    b.house(38, 29, { color: 5 });
    b.house(11, 30, { floors: 2, color: 6 }); // a house on the promenade
    b.house(26, 29, { w: 2, color: 0 });

    // ── the hill ──
    b.house(30, 13, { floors: 2, color: 4 });
    b.house(33, 13, { color: 2 });
    b.house(34, 13, { floors: 2, color: 7 });
    b.house(38, 13, { w: 2, color: 1 });
    b.plaza(33, 6, 37, 8); // the lookout
    b.tower(39, 6, { floors: 4, color: 1 });
    b.house(32, 9, { color: 3 });
    b.put('tree', 29, 7).put('tree', 28, 9).put('tree', 41, 9).put('tree', 41, 13).put('tree', 29, 14);

    // ── the fields ──
    b.fenceAround(8, 26, 12, 29);
    b.put('tree', 9, 27).put('tree', 11, 26).put('tree', 11, 28).put('tree', 8, 29);
    b.fenceAround(17, 28, 21, 30);

    // ── trees about the town ──
    for (const [x, z] of [[6, 13], [9, 11], [14, 12], [16, 9], [22, 10], [25, 13], [13, 20], [26, 20], [38, 27], [34, 28], [22, 27], [29, 29], [41, 21], [6, 27]] as const) b.put('tree', x, z);
  },
  cameras: [
    { name: 'se', yaw: 45, pitch: 36, zoom: 1.55, target: [23.5, 1, 20.5] },
    { name: 'sw', yaw: 135, pitch: 36, zoom: 1.55, target: [23.5, 1, 20.5] },
    { name: 'nw', yaw: 225, pitch: 36, zoom: 1.55, target: [23.5, 1, 20.5] },
    { name: 'ne', yaw: 315, pitch: 36, zoom: 1.55, target: [23.5, 1, 20.5] },
    { name: 'square', yaw: 45, pitch: 32, zoom: 4.4, target: [20.5, 1.2, 19.5] },
    { name: 'square-nw', yaw: 225, pitch: 34, zoom: 4.4, target: [20.5, 1.2, 19.5] },
    { name: 'alley', yaw: 100, pitch: 30, zoom: 5.5, target: [10.5, 2, 17.5] },
    { name: 'gardens', yaw: 30, pitch: 30, zoom: 5.5, target: [12, 1.2, 23.3] },
    { name: 'harbour', yaw: 45, pitch: 32, zoom: 3.4, target: [24, 1, 32] },
    { name: 'harbour-sw', yaw: 135, pitch: 32, zoom: 3.4, target: [24, 1, 32] },
    { name: 'bridge', yaw: 60, pitch: 30, zoom: 6, target: [31.5, 1.2, 31.5] },
    { name: 'hill', yaw: 45, pitch: 34, zoom: 3.2, target: [34, 2.4, 13] },
    { name: 'hill-ne', yaw: 315, pitch: 34, zoom: 3.2, target: [34, 2.4, 12] },
    { name: 'steps', yaw: 30, pitch: 30, zoom: 6.5, target: [28.5, 1.8, 15.5] },
    { name: 'courtyard', yaw: 45, pitch: 44, zoom: 5.5, target: [35, 1.6, 20] },
    { name: 'fields', yaw: 45, pitch: 34, zoom: 4.2, target: [14.5, 1, 28] },
    { name: 'street', yaw: 60, pitch: 28, zoom: 6, target: [19, 1.4, 24.5] },
  ],
  expect(_plan, dressing, check) {
    // Every tier-1 dressing rule has something to do here.
    for (const rule of ['D01.street-lamps', 'D02.square-lamps', 'D05.laundry-line', 'D07.shop-dressing', 'D09.flower-boxes', 'D13.flags', 'D20.bridge-lamps', 'D24.wild-ground', 'U03.front-garden', 'U07.retaining-wall']) {
      check.ok(check.applied(rule) > 0, `${rule} applies in the show town`);
    }
    check.ok(dressing.props.length > 150, 'the town is dressed');
  },
});
