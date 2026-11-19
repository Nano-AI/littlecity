// The Ground owner's show town: a village green and a harbour, on terrain
// with four levels, using every ground piece together the way a player
// would. Houses, the tower, the windmill and marble are other owners'
// pieces (placeholders until their branches merge); everything at ground
// level is real.
//
//   the harbour   a pier with a lamp-and-seat head, a quay with its crane, a
//                 boardwalk over an inlet, a sea wall, a fish stall, palms
//   the green     a 5 × 5 square with the tiered fountain and market stalls,
//                 planter trees, a hedged park with fruit trees and a birdbath
//   the lanes     paths with kerbs, a doorstep yard behind a picket fence and
//                 its gate, kitchen and flower gardens
//   the hill      a path up three terraces by carved steps to the pines
//   the east      wheat by the windmill, a curtain wall with a gateway, a
//                 marble lookout with a balustrade, a reedy pond

import { scenario } from '@/scenario';

export default scenario({
  name: 'village-green-and-harbour',
  seed: 77,
  about: 'A village green and a harbour on four levels of terrain, built from every ground piece: docks, paths, plazas, gardens, trees, fences, walls, stairs, the fountain and the stall.',
  terrain(t) {
    t.rect(6, 6, 41, 32, 1);
    t.rect(6, 6, 41, 15, 2); // the upper town
    t.rect(6, 6, 20, 10, 3); // the hill
    t.rect(6, 6, 13, 8, 4); // its top
    t.water(15, 28, 29, 32); // the harbour bay
    t.water(8, 27, 10, 32); // an inlet
    t.water(37, 19, 39, 21); // a pond
  },
  build(b) {
    // ── the harbour ──
    for (let z = 28; z <= 32; z++) b.block('dock', 18, 0, z); // the pier
    for (let x = 21; x <= 28; x++) b.block('dock', x, 0, 28); // the quay
    for (let x = 8; x <= 10; x++) b.block('dock', x, 0, 29); // the boardwalk
    b.path(12, 27, 30, 27); // the promenade
    b.path(18, 28, 18, 31); // boards along the pier
    b.path(6, 29, 7, 29).path(8, 29, 10, 29).path(11, 29, 13, 29).path(13, 28);
    for (const x of [15, 16, 17, 19, 20]) b.wallEdge(x, 27, 'S'); // the sea wall
    b.fenceEdge(18, 29, 'W').fenceEdge(18, 30, 'W'); // a rope fence on the pier
    b.put('stall', 22, 26); // fish
    b.put('tree', 11, 31).put('tree', 13, 32).put('tree', 31, 30).put('tree', 33, 32).put('tree', 36, 31); // palms

    // ── the green ──
    b.plaza(22, 19, 26, 23);
    b.put('fountain', 24, 21);
    b.put('stall', 22, 23).put('stall', 26, 23).put('stall', 26, 19);
    b.put('tree', 21, 19).put('tree', 21, 23).put('tree', 27, 21); // planter trees
    b.path(24, 24, 24, 26); // square to promenade
    b.garden(11, 19, 15, 23); // the park
    b.put('tree', 12, 20).put('tree', 14, 22);
    b.put('fountain', 13, 21); // a birdbath
    b.path(16, 21, 21, 21); // park to square
    b.path(18, 22, 18, 26); // and down to the pier
    b.garden(19, 23, 20, 24); // flower beds

    // ── houses round the green ──
    b.house(22, 17, { w: 2, floors: 2, color: 0 });
    b.house(25, 17, { w: 2, floors: 1, color: 4 });
    b.plaza(25, 17, 26, 17); // a roof terrace ...
    b.fenceEdge(25, 17, 'S').fenceEdge(26, 17, 'S').fenceEdge(26, 17, 'E'); // ... with an iron railing
    // A cottage in a fenced yard, with a gate where the path comes in.
    b.fenceAround(29, 18, 31, 19);
    b.house(31, 18, { floors: 1, color: 3 });
    b.put('tree', 29, 18);
    b.path(30, 19, 30, 26);
    // A marble lookout: two flights up, a balustrade round the top, a basin.
    b.fill('marble', 33, 24, 35, 25, { floors: 2 });
    b.put('marble', 32, 24);
    b.block('stairs', 31, 1, 24, { rot: 1 }).block('stairs', 32, 2, 24, { rot: 1 });
    b.plaza(33, 24, 35, 25);
    b.put('fountain', 35, 25);

    // ── the upper town ──
    b.path([24, 18], [24, 13], [17, 13], [17, 9], [10, 9], [10, 8]); // up the terraces by carved steps
    b.house(27, 12, { w: 2, floors: 2, color: 2 });
    b.garden(29, 12, 30, 13); // a kitchen garden, fenced on three sides (fenced all round it would be a courtyard)
    b.fenceEdge(29, 12, 'N').fenceEdge(30, 12, 'N').fenceEdge(30, 12, 'E').fenceEdge(30, 13, 'E').fenceEdge(29, 13, 'S').fenceEdge(30, 13, 'S');
    b.house(21, 11, { floors: 1, color: 6 });
    b.put('tree', 8, 7).put('tree', 12, 7).put('tree', 7, 8).put('tree', 12, 8); // pines
    b.put('tree', 26, 6).put('tree', 30, 6); // willows over the north shore
    for (const [x, z] of [[38, 10], [39, 10], [40, 10], [38, 11], [39, 11], [40, 11]] as const) b.put('tree', x, z); // a grove
    for (const [x, z] of [[9, 12], [12, 13], [14, 16], [20, 15], [28, 15], [34, 16], [8, 17], [34, 28], [39, 26]] as const) b.put('tree', x, z);

    // ── the east ──
    b.stack('windmill', 35, 9, { floors: 2 });
    b.garden(32, 8, 34, 11); // wheat
    b.tower(39, 13, { floors: 4, color: 1 });
    b.path(37, 12, 37, 14);
    b.put('wall', 38, 13).put('wall', 37, 13).put('wall', 36, 13); // a curtain wall with a gateway
    b.garden(36, 19, 36, 21); // reeds by the pond
    b.put('tree', 38, 22).put('tree', 40, 20);
    // A walled garden.
    b.garden(8, 24, 9, 25);
    b.fenceAround(8, 24, 9, 25, 'wall');
  },
  cameras: [
    { name: 'overview', yaw: 45, pitch: 36, zoom: 1.5, target: [23.5, 1, 19.5] },
    { name: 'overview-nw', yaw: 225, pitch: 36, zoom: 1.5, target: [23.5, 1, 19.5] },
    { name: 'harbour', yaw: 45, pitch: 34, zoom: 3, target: [21, 1, 27.5] },
    { name: 'harbour-sw', yaw: 135, pitch: 32, zoom: 3, target: [20, 1, 27] },
    { name: 'green', yaw: 45, pitch: 36, zoom: 3, target: [21, 1, 21.5] },
    { name: 'green-ne', yaw: 315, pitch: 34, zoom: 3, target: [20, 1, 21.5] },
    { name: 'hill', yaw: 45, pitch: 34, zoom: 3, target: [15, 3, 11] },
    { name: 'east', yaw: 45, pitch: 36, zoom: 3, target: [34.5, 1.5, 17] },
    { name: 'lookout', yaw: 225, pitch: 34, zoom: 3.6, target: [33.5, 2, 23] },
    { name: 'inlet', yaw: 315, pitch: 36, zoom: 3.6, target: [10, 1, 27] },
  ],
  expect(plan, _dressing, check) {
    const floorRole = (x: number, y: number, z: number): string | undefined => plan.roles.get(check.floorStructure(x, y, z).id)?.role;
    check.role(18, 0, 30, 'pier');
    check.role(24, 0, 28, 'quay');
    check.role(9, 0, 29, 'boardwalk');
    check.role(24, 1, 21, 'tiered-fountain');
    check.role(13, 1, 21, 'birdbath');
    check.role(35, 3, 25, 'basin');
    check.role(22, 1, 26, 'fish-stall');
    check.role(26, 1, 23, 'market-stall');
    check.role(11, 1, 31, 'palm');
    check.role(21, 1, 19, 'planter-tree');
    check.role(12, 1, 20, 'fruit-tree');
    check.role(8, 4, 7, 'pine');
    check.role(26, 2, 6, 'willow');
    check.role(39, 2, 10, 'grove-tree');
    check.equal(floorRole(13, 1, 20), 'park-lawn', 'the park');
    check.equal(floorRole(19, 1, 23), 'flower-garden', 'the beds by the lane');
    check.equal(floorRole(29, 2, 12), 'kitchen-garden', 'the garden beside the house');
    check.equal(floorRole(33, 2, 9), 'wheat-field', 'the field by the windmill');
    check.equal(floorRole(36, 1, 20), 'reed-bed', 'the garden by the pond');
    check.role(38, 2, 13, 'curtain-wall');
    check.hasFeature({ type: 'terrain-steps' }, 3);
    check.hasFeature({ type: 'gate' }, 2);
    check.hasFeature({ type: 'railing', variant: 'balustrade' }, 4);
    check.hasFeature({ type: 'plaza-motif' });
    check.hasFeature({ type: 'floor-link', variant: 'plaza' }, 2);
    check.hasFeature({ type: 'ramp' });
  },
});
