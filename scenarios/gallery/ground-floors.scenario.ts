// Gallery: paths, plazas and every garden variant (J17, J21, J22, R-G01),
// each where the real rules give it.
//
//   west     paths: a lone cell, an end, a corner, a tee, a cross, a block of
//            four, a path up two terraces by carved steps, a path onto a
//            plaza (kerb), onto a dock (boards) and over a bridge (cobbles)
//   middle   plazas: a small one, an L with a border course, a 7 × 7 square
//            with the centre motif
//   east     gardens: flower garden, kitchen garden by a house, wheat by a
//            windmill, herb garden in a walled court, reed bed by the water,
//            a park lawn with a hedge that opens for a path

import { scenario } from '@/scenario';

export default scenario({
  name: 'ground-floors',
  seed: 44,
  about: 'Paths (ends, corners, steps, kerb, boards, cobbles), plazas (border, centre motif) and the six garden variants.',
  terrain(t) {
    t.flat(1);
    t.water(4, 34, 43, 43); // the sea to the south
    t.rect(6, 6, 12, 12, 2); // two terraces for the carved steps
    t.rect(6, 6, 9, 9, 3);
    t.water(38, 24, 43, 30); // a pond for the reed bed
  },
  build(b) {
    // ── paths ──
    b.path(7, 26); // a lone cell
    b.path(6, 22, 9, 22); // a straight run with two ends
    b.path([6, 19], [8, 19], [8, 17]); // a corner
    b.path(11, 20, 15, 20).path(13, 18, 13, 19).path(13, 21, 13, 22); // a cross
    b.path(11, 24, 15, 24).path(13, 25, 13, 26); // a tee
    b.path(6, 14, 7, 15); // a block of four
    b.path([13, 16], [13, 12], [9, 12]); // up the first terrace ...
    b.path([9, 11], [9, 9], [7, 9], [7, 7]); // ... and the second
    // Onto a dock, and over a bridge.
    b.path(9, 28, 9, 33);
    for (let z = 34; z <= 37; z++) b.block('dock', 9, 0, z);
    b.path(9, 34, 9, 36);
    b.put('arch', 16, 29).put('arch', 17, 29).put('arch', 18, 29);
    b.block('stairs', 15, 1, 29, { rot: 1 }).block('stairs', 19, 1, 29, { rot: 3 });
    b.path(13, 29, 14, 29).path(16, 29, 18, 29).path(20, 29, 21, 29);

    // ── plazas ──
    b.plaza(17, 16, 18, 17);
    b.plaza(17, 20, 20, 21).plaza(17, 22, 18, 24);
    b.path(15, 22, 16, 22); // a path arriving: the kerb
    b.plaza(22, 8, 28, 14);
    b.put('fountain', 25, 11);
    b.path(25, 15, 25, 19);

    // ── gardens ──
    b.garden(23, 20, 25, 21); // flower garden
    b.house(28, 19, { w: 2, color: 2 });
    b.garden(28, 20, 29, 22); // kitchen garden, beside the house
    b.stack('windmill', 34, 8, { floors: 2 });
    b.garden(32, 9, 33, 12).garden(34, 10, 35, 12); // wheat
    // A walled court with herbs.
    b.fill('marble', 31, 15, 35, 15).fill('marble', 31, 19, 35, 19);
    b.fill('marble', 31, 16, 31, 18).fill('marble', 35, 16, 35, 18);
    b.garden(32, 16, 34, 18);
    b.garden(36, 24, 37, 29); // reeds, by the pond
    b.garden(23, 24, 28, 28); // a park
    b.put('tree', 24, 25).put('tree', 27, 27);
    b.path(25, 22, 25, 23).path(25, 29, 25, 30);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 38, zoom: 1.75, target: [22, 1, 20] },
    { name: 'back', yaw: 225, pitch: 38, zoom: 1.75, target: [22, 1, 20] },
    { name: 'paths', yaw: 45, pitch: 40, zoom: 3.6, target: [10.5, 1, 21] },
    { name: 'steps', yaw: 135, pitch: 34, zoom: 4.4, target: [10, 2, 11] },
    { name: 'shore', yaw: 45, pitch: 34, zoom: 4.2, target: [13, 1, 31] },
    { name: 'plazas', yaw: 45, pitch: 40, zoom: 3.2, target: [22, 1, 15] },
    { name: 'gardens', yaw: 45, pitch: 36, zoom: 3.6, target: [27.5, 1, 23.5] },
    { name: 'gardens-nw', yaw: 225, pitch: 36, zoom: 3.6, target: [27.5, 1, 23.5] },
    { name: 'wheat', yaw: 315, pitch: 34, zoom: 4.4, target: [33.5, 1, 13] },
    { name: 'reeds', yaw: 135, pitch: 32, zoom: 5, target: [36.5, 1, 26.5] },
  ],
  expect(plan, _dressing, check) {
    const garden = (x: number, z: number): string | undefined => plan.roles.get(check.floorStructure(x, 1, z).id)?.role;
    check.equal(garden(24, 20), 'flower-garden', 'a garden on its own');
    check.equal(garden(28, 21), 'kitchen-garden', 'the garden beside the house');
    check.equal(garden(33, 10), 'wheat-field', 'the garden by the windmill');
    check.equal(garden(33, 17), 'herb-garden', 'the garden in the walled court');
    check.equal(garden(36, 26), 'reed-bed', 'the garden by the pond');
    check.equal(garden(25, 26), 'park-lawn', 'the big garden');
    check.hasFeature({ type: 'terrain-steps' }, 2);
    check.hasFeature({ type: 'floor-link', variant: 'plaza' }, 2);
    check.hasFeature({ type: 'floor-link', variant: 'deck' });
    check.hasFeature({ type: 'plaza-motif', variant: 'rings' });
    check.hasFeature({ type: 'plaza-border' }, 2);
    check.hasFeature({ type: 'garden-piece', variant: 'scarecrow' });
    check.ok(plan.world.floors.size > 150, 'floors were laid');
  },
});
