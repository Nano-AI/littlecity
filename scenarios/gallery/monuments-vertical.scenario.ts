// The "crazy vertical" town: everything Monuments draws, piled up the way a
// player who cannot stop stacking would pile it. A two-tier viaduct strides
// from a keep on the hill, over the town, to a lighthouse on a sea stack; a
// tower stands on arches on pillars; a temple sits on a podium of arcades;
// houses hang off a marble quay over the water on brackets, pillars and
// stilts; a sky bridge joins two tall houses; buttresses prop the keep.
// Nothing floats.

import { scenario } from '@/scenario';

export default scenario({
  name: 'monuments-vertical',
  seed: 77,
  about: 'Stacked viaducts, a tower on arches on pillars, houses hung off a marble mass over water, supports everywhere.',
  terrain(t) {
    t.flat(0);
    t.rect(8, 8, 26, 20, 1); // the town's shelf
    t.rect(8, 8, 13, 13, 2); // the hill at its back corner
    t.rect(30, 9, 34, 13, 1); // a sea stack across the strait
    t.rect(31, 10, 33, 12, 5);
    t.rect(29, 17, 31, 19, 1); // an islet off the front corner
  },
  build(b) {
    // ── the keep on the hill, a turret in its corner, buttresses against its tall side ──
    b.fill('marble', 9, 9, 11, 10, { floors: 3 }).fill('marble', 9, 11, 10, 11, { floors: 3 });
    b.block('marble', 9, 5, 9).block('marble', 9, 6, 9);
    b.tower(11, 11, { floors: 5, color: 2 });
    b.block('arch', 9, 4, 12).block('arch', 9, 4, 13); // a flying buttress down the hill

    // ── the great viaduct: from the keep, over the town and the strait, to the sea stack ──
    for (let x = 12; x <= 30; x++) b.block('arch', x, 4, 9);
    for (let x = 15; x <= 28; x++) b.block('arch', x, 5, 9);
    b.stack('lighthouse', 32, 11, { floors: 5 });
    b.block('house', 21, 6, 9, { color: 3 }).block('house', 22, 6, 9, { color: 3 }); // a house on top of it all

    // ── a tower on arches on pillars ──
    b.stack('pillar', 14, 13, { floors: 2 }).stack('pillar', 17, 13, { floors: 2 });
    for (let x = 14; x <= 17; x++) b.block('arch', x, 3, 13);
    for (let y = 4; y <= 8; y++) b.block('tower', 15, y, 13, { color: 6 });
    b.block('house', 16, 6, 13, { color: 0 }); // a room bracketed off the tower
    b.path(15, 14, 15, 18).path(16, 14, 16, 14);

    // ── a temple raised on a podium that stands on arcades ──
    for (const x of [20, 21, 22]) for (const z of [13, 14]) b.block('marble', x, 3, z); // the podium: generated pillars and arcades under it
    for (const x of [20, 21, 22]) for (const z of [13, 14]) b.block('pillar', x, 4, z).block('pillar', x, 5, z).block('marble', x, 6, z);

    // ── two tall houses joined by a sky bridge; a loggia off one of them ──
    b.house(20, 18, { floors: 5, color: 2 }).house(24, 18, { floors: 5, color: 4 });
    for (let x = 21; x <= 23; x++) b.block('arch', x, 3, 18);
    b.block('arch', 24, 4, 17);

    // ── the quay: marble at the water's edge, houses hung over the sea ──
    b.fill('marble', 10, 19, 17, 20);
    b.fill('marble', 10, 19, 11, 20, { floors: 1 });
    for (const x of [12, 13, 14]) b.block('house', x, 2, 21, { color: (x * 3) % 8 }).block('marble', x, 2, 20); // jettied on brackets off a marble wall
    b.block('house', 13, 3, 21, { color: 4 });
    for (const x of [15, 16, 17]) b.block('house', x, 3, 22, { color: 1 }); // further out: pillars in the sea, joined by an arcade
    b.block('house', 10, 2, 21, { color: 6 }).block('house', 10, 3, 21, { color: 6 }); // two storeys on brackets off the quay's raised end
    b.block('dock', 19, 0, 21).block('tree', 19, 1, 21).block('house', 19, 3, 21, { color: 5 }); // on stilts round a tree

    // ── a stone bridge to the islet, and a gateway on the path to it ──
    b.block('arch', 27, 0, 18).block('arch', 28, 0, 18);
    b.path(25, 16, 25, 20).put('arch', 25, 19);
    b.stack('pillar', 30, 18, { floors: 3 });
  },
  cameras: [
    { name: 'hero', yaw: 45, pitch: 30, zoom: 2.1, target: [20.5, 3, 15] },
    { name: 'back', yaw: 225, pitch: 32, zoom: 2.1, target: [20.5, 3, 15] },
    { name: 'east', yaw: 135, pitch: 30, zoom: 2.1, target: [20.5, 3, 15] },
    { name: 'west', yaw: 315, pitch: 30, zoom: 2.1, target: [20.5, 3, 15] },
    { name: 'quay', yaw: 25, pitch: 22, zoom: 4.4, target: [14.5, 2, 21] },
    { name: 'viaduct', yaw: 20, pitch: 24, zoom: 3, target: [22, 4, 9.5] },
    { name: 'middle', yaw: 55, pitch: 26, zoom: 3.6, target: [18.5, 4.5, 14] },
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 2.1, target: [20.5, 3, 15], time: 'dusk' },
    { name: 'night', yaw: 45, pitch: 30, zoom: 2.1, target: [20.5, 3, 15], time: 'night' },
  ],
  expect(plan, _dressing, check) {
    // Nothing floats: brackets, pillars, an arcade and stilts are all at work.
    const types = new Set(plan.supports.map((s) => s.type));
    check.ok(types.has('bracket') && types.has('pillar') && types.has('stilts'), `supports of every kind (${[...types].join(', ')})`);
    check.ok(plan.supports.some((s) => (s.arcadeTo?.length ?? 0) > 0), 'an arcade');
    check.ok(plan.supports.length >= 14, `supports everywhere (${plan.supports.length})`);
    check.role(10, 2, 10, 'keep');
    check.role(11, 2, 11, 'castle-turret');
    check.role(9, 4, 12, 'flying-buttress');
    check.role(20, 4, 9, 'viaduct');
    check.hasFeature({ type: 'pier', on: [20, 4, 9] }, 4);
    check.role(32, 5, 11, 'lighthouse');
    check.role(21, 6, 13, 'temple');
    check.role(22, 3, 18, 'sky-bridge');
    check.role(24, 4, 17, 'loggia');
    check.role(13, 1, 19, 'quay-wall');
    check.role(27, 0, 18, 'stone-bridge');
    check.role(25, 1, 19, 'gateway');
  },
});
