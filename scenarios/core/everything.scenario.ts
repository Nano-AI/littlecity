// The project's standard showcase: one town on a generated island that uses
// every tray piece and as many roles as will fit in one place. Art reviews,
// postcards and "does the whole game still look right" checks all look here.
//
//   npm run shots -- everything                 # every camera, by day
//   npm run shots -- everything --time dusk     # and --time night
//
// The island is the real generator's for seed 151 (two plateaus, a hill of
// five levels with cliffs on its east side, a bay on the south coast and a
// creek in the north-west). If the generator changes, the build below
// throws at the first piece that no longer fits; re-seat it then.
//
//   the square     a 5 × 5 plaza with the tiered fountain and stalls, a row
//                  of shops, the clock tower, an inn with a loggia
//   the terrace    a chapel and its steeple on the bluff over the square
//   the harbour    a pier, a quay with its crane, a marble quay wall, a
//                  boathouse, a fish stall, the lighthouse and its keeper,
//                  stilt houses and a second pier on the point
//   the lower lane a row of six houses behind picket fences, stairs up
//   the upper town a high street with a jettied house and a roof terrace,
//                  townhouses joined by a sky bridge, a walled garden with a
//                  well, and the folly: rooms, a turret and a windmill on an
//                  arcade of generated pillars
//   the acropolis  a temple on eight pillars, a campanile, a viaduct across
//                  the valley with the road passing under it
//   the east       a windmill by its wheat, the mill house, a house under
//                  the cliff, a jetty
//   the hill       a path up three flights of carved steps to an
//                  observatory among pines
//   the castle     a keep with a raised corner, grand steps, buttresses, a
//                  curtain wall with four turrets and a gatehouse
//   the north      a stone bridge over the creek, a manor in its park, a
//                  greenhouse, a dovecote, a reed bed
//   the west       a boardwalk over an inlet to a beach cottage, a watchtower
//
// `houseDressing` stands in for D07, D09 and L03 (awnings and signs, flower
// boxes, windmill sails) until Stage 3's rules land; drop it from `rules`
// then.

import { key } from '@/core/grid';
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'everything',
  seed: 151,
  about: 'The standard showcase: a whole town on a generated island, with every tray piece and nearly every role. Day, dusk and night cameras.',
  terrain: 'generated',
  rules: houseDressing,
  build(b) {
    // A path through the given corners (x first, then z on each leg), skipping cells that already hold a floor.
    const road = (...points: (readonly [number, number])[]): void => {
      let [x, z] = points[0]!;
      const lay = (): void => {
        if (!b.world.floors.has(key(x, b.floorLevel(x, z), z))) b.path(x, z);
      };
      lay();
      for (const [tx, tz] of points.slice(1)) {
        while (x !== tx) {
          x += Math.sign(tx - x);
          lay();
        }
        while (z !== tz) {
          z += Math.sign(tz - z);
          lay();
        }
      }
    };

    // ── the square ──
    b.plaza(24, 30, 28, 34);
    b.put('fountain', 26, 32);
    b.put('stall', 28, 31).put('stall', 28, 33).put('stall', 25, 34);
    b.put('tree', 24, 34).put('tree', 28, 30); // planter trees
    // Shops along the west side.
    b.house(23, 30, { floors: 2, color: 0 });
    b.house(23, 31, { floors: 2, color: 4 });
    b.house(23, 32, { floors: 3, color: 2 });
    b.house(23, 33, { floors: 2, color: 6 });
    b.tower(24, 29, { floors: 5, color: 3 }); // the clock tower, in the corner under the bluff
    // The east street, the inn on it, and its loggia over a garden with a flower stall.
    road([29, 30], [29, 35]);
    b.house(30, 31, { w: 3, d: 2, floors: 2, color: 2 });
    b.garden(30, 33, 32, 33);
    b.fenceEdge(30, 33, 'S').fenceEdge(31, 33, 'S').fenceEdge(32, 33, 'S').fenceEdge(32, 33, 'E');
    b.block('arch', 31, 2, 33); // hangs off the inn's upper storey
    b.put('stall', 32, 33);

    // ── the terrace over the square: chapel and steeple ──
    road([29, 29]);
    road([25, 29], [28, 29]); // carved steps up from the street
    b.house(25, 28, { w: 3, color: 5 });
    b.tower(28, 28, { floors: 5, color: 0 });

    // ── the harbour ──
    road([26, 35], [33, 35]); // the promenade
    for (let z = 36; z <= 40; z++) b.block('dock', 24, 0, z); // the pier
    road([24, 35], [24, 40]);
    b.fenceEdge(24, 37, 'W').fenceEdge(24, 38, 'W');
    for (const z of [38, 39]) for (let x = 28; x <= 32; x++) b.block('dock', x, 0, z); // the quay
    b.block('marble', 26, 1, 36).block('marble', 27, 1, 36); // a quay wall
    b.house(22, 35, { w: 2, color: 4 }); // the boathouse on the beach
    b.put('stall', 30, 36); // fish
    b.put('tree', 21, 36).put('tree', 28, 37).put('tree', 32, 37).put('tree', 33, 38); // palms

    // ── the lighthouse point and the stilt houses ──
    b.stack('lighthouse', 19, 37, { floors: 6 });
    b.house(18, 36, { w: 2, color: 1 }); // the keeper's cottage
    road([20, 34], [20, 36]);
    for (let z = 36; z <= 39; z++) b.block('dock', 15, 0, z); // a second pier
    b.block('house', 14, 1, 38, { color: 3 });
    b.block('house', 16, 1, 38, { color: 6 }).block('house', 16, 2, 38, { color: 6 });
    b.put('tree', 17, 36).put('tree', 13, 35);

    // ── the lower lane: a row of houses behind picket fences ──
    road([13, 34], [23, 34]);
    const row = [2, 5, 0, 4, 6, 1];
    for (let i = 0; i < 6; i++) b.house(14 + i, 32, { floors: i === 4 ? 1 : 2, color: row[i]! });
    for (const x of [14, 15, 17, 18]) b.garden(x, 33).fenceEdge(x, 33, 'S'); // front gardens; the gaps are the ways in
    b.fenceEdge(14, 33, 'W');
    // Stairs up to the upper town.
    road([21, 32], [21, 33]);
    road([20, 32]);
    b.block('stairs', 20, 1, 31, { rot: 0 }).block('stairs', 21, 1, 31, { rot: 0 });
    road([21, 27], [21, 30]);
    road([20, 30]);

    // ── the upper town ──
    road([10, 26], [29, 26]); // the high street
    // A jettied house: its upper rooms oversail the street on brackets.
    b.house(18, 25, { w: 2, floors: 2, color: 6 });
    b.block('house', 18, 3, 26, { color: 6 }).block('house', 19, 3, 26, { color: 6 });
    // A house with a roof terrace behind an iron railing.
    b.house(22, 25, { w: 2, floors: 2, color: 3 });
    b.house(24, 25, { floors: 1, color: 3 });
    b.plaza(24, 25);
    b.fenceEdge(24, 25, 'S').fenceEdge(24, 25, 'E').fenceEdge(24, 25, 'N');
    b.house(26, 25, { floors: 2, color: 1 });
    // Townhouses, two of them joined by a sky bridge.
    b.house(10, 24, { floors: 3, color: 2 });
    b.house(11, 24, { floors: 4, color: 6 });
    b.house(12, 24, { floors: 4, color: 1 });
    b.house(15, 24, { floors: 4, color: 4 });
    b.house(16, 24, { floors: 3, color: 0 });
    b.garden(13, 24, 14, 24);
    b.block('arch', 13, 4, 24).block('arch', 14, 4, 24);
    // A walled garden with a well, and a gate onto the street.
    b.garden(15, 28).garden(15, 29).garden(16, 29);
    road([16, 27], [16, 28]);
    b.fenceAround(15, 28, 16, 29, 'wall');
    b.put('fountain', 15, 28);
    b.put('tree', 16, 29);
    // The folly: rooms, a turret and a windmill on an arcade of generated pillars.
    b.house(11, 28, { floors: 2, color: 1 });
    for (const x of [10, 11, 12]) b.block('house', x, 6, 29, { color: 7 });
    b.block('tower', 11, 7, 29, { color: 5 }).block('tower', 11, 8, 29, { color: 5 });
    b.block('windmill', 12, 7, 29);
    b.block('marble', 13, 6, 29);
    b.block('house', 13, 4, 27, { color: 2 });
    b.tower(10, 22, { floors: 4, color: 6 }); // a watchtower on the west knoll

    // ── the valley road, the viaduct and the acropolis ──
    road([29, 29], [31, 29], [31, 26], [32, 26], [32, 24], [35, 24]);
    for (let x = 30; x <= 33; x++) b.put('arch', x, 25); // the road passes under the third arch
    road([30, 25], [33, 25]);
    road([29, 24], [29, 25]);
    road([34, 25]);
    b.plaza(34, 26, 37, 31);
    for (const x of [35, 36]) for (const z of [27, 28, 29, 30]) {
      b.eraseFloor(x, z);
      b.stack('pillar', x, z, { floors: 2 });
      b.block('marble', x, 4, z);
    }
    b.put('marble', 35, 32); // a plinth
    b.tower(38, 26, { floors: 7, color: 4 }); // the campanile
    b.put('fountain', 37, 31); // a basin
    b.put('tree', 34, 33).put('tree', 36, 34).put('tree', 35, 36).put('tree', 38, 30);

    // ── the east: mill, wheat, a house under the cliff, a jetty ──
    road([35, 15], [35, 23]);
    b.stack('windmill', 37, 18, { floors: 2 });
    b.house(36, 18, { color: 5 }); // the mill house
    b.garden(36, 19, 38, 21); // wheat
    b.house(33, 17, { d: 2, floors: 3, color: 0 }); // under the cliff
    b.block('auto', 40, 0, 20).block('auto', 41, 0, 20); // Auto over the sea: a jetty
    b.put('tree', 39, 23).put('tree', 38, 16).put('tree', 33, 22).put('tree', 37, 14).put('tree', 34, 13);

    // ── the hill: carved steps up to the observatory among the pines ──
    road([29, 23], [29, 20], [30, 20], [30, 19]);
    b.tower(31, 18, { floors: 4, color: 1 });
    for (const [x, z] of [[29, 17], [30, 16], [31, 20], [29, 19], [31, 21], [31, 15]] as const) b.put('tree', x, z);

    // ── the castle on the west plain ──
    road([20, 26], [20, 20], [18, 20]);
    b.fill('marble', 15, 15, 18, 16, { floors: 5 }); // the keep's great tower
    b.block('marble', 15, 6, 15); // a raised corner
    b.fill('marble', 15, 17, 18, 17, { floors: 3 }); // its forebuilding
    for (const x of [16, 17]) {
      b.stack('marble', x, 18, { floors: 2 }); // grand steps up to it
      b.stack('marble', x, 19, { floors: 1 });
    }
    b.block('arch', 19, 4, 15).block('arch', 14, 4, 16); // buttresses
    for (const [x, z] of [[13, 13], [22, 13], [13, 21], [22, 21]] as const) b.tower(x, z, { floors: 4, color: 2 }); // turrets
    for (let x = 14; x <= 21; x++) b.put('wall', x, 13);
    for (let z = 14; z <= 20; z++) b.put('wall', 13, z).put('wall', 22, z);
    for (let x = 14; x <= 18; x++) b.put('wall', x, 21);
    b.stack('marble', 19, 21, { floors: 2, color: 3 }).stack('marble', 21, 21, { floors: 2, color: 3 }); // the gatehouse
    b.put('arch', 20, 21);
    b.put('fountain', 20, 16);
    b.put('tree', 14, 19).put('tree', 21, 18);

    // ── the north: the stone bridge, the manor and its park ──
    road([20, 22], [23, 22], [23, 11], [25, 11]);
    for (let x = 18; x <= 21; x++) b.block('arch', x, 0, 10);
    road([23, 11], [22, 11], [22, 10], [17, 10], [17, 11], [16, 11], [16, 12]);
    b.house(15, 12, { color: 'auto' }); // a cottage on the point
    b.garden(19, 12, 20, 12); // reeds by the creek
    b.house(27, 10, { w: 4, d: 2, floors: 2, color: 5 }); // the manor
    b.garden(24, 12, 29, 13); // its park
    b.put('tree', 25, 13).put('tree', 28, 12);
    b.put('fountain', 27, 13); // a birdbath
    b.tower(24, 10, { floors: 3, color: 7 }); // a dovecote
    b.garden(32, 10, 34, 12);
    b.eraseFloor(33, 11);
    b.house(33, 11, { color: 3 }); // a greenhouse in its garden
    for (const [x, z] of [[24, 15], [25, 15], [24, 16], [25, 16], [24, 17], [25, 18]] as const) b.put('tree', x, z); // a grove
    b.put('tree', 26, 9).put('tree', 31, 9).put('tree', 24, 20).put('tree', 16, 22).put('tree', 9, 18).put('tree', 10, 20);

    // ── the west: a boardwalk over the inlet, a beach cottage ──
    road([13, 34], [13, 33], [11, 33], [11, 32], [10, 32]);
    for (let x = 7; x <= 9; x++) b.block('dock', x, 0, 32);
    road([7, 32], [9, 32]);
    road([6, 32]);
    road([6, 31]);
    b.auto(8, 30); // Auto on the ground: a house
    b.put('tree', 7, 31).put('tree', 12, 34).put('tree', 9, 28).put('tree', 18, 29).put('tree', 13, 30);
  },
  cameras: [
    // The four quarters at the default playing distance (named for where the camera stands).
    { name: 'overview', yaw: 45, pitch: 35, zoom: 1.6, target: [23.5, 1, 24.5] },
    { name: 'overview-ne', yaw: 135, pitch: 35, zoom: 1.6, target: [23.5, 1, 24.5] },
    { name: 'overview-nw', yaw: 225, pitch: 35, zoom: 1.6, target: [23.5, 1, 24.5] },
    { name: 'overview-sw', yaw: 315, pitch: 35, zoom: 1.6, target: [23.5, 1, 24.5] },
    // Places.
    { name: 'town', yaw: 45, pitch: 33, zoom: 2.6, target: [24, 1.5, 30] },
    { name: 'square', yaw: 45, pitch: 32, zoom: 4.2, target: [26, 1.5, 31.5] },
    { name: 'harbour', yaw: 45, pitch: 30, zoom: 3.4, target: [24, 1, 36] },
    { name: 'point', yaw: 315, pitch: 30, zoom: 4.4, target: [17, 1.5, 36] },
    { name: 'upper-town', yaw: 45, pitch: 32, zoom: 3.6, target: [17, 3, 26] },
    { name: 'folly', yaw: 45, pitch: 28, zoom: 5, target: [12.5, 5, 27.5] },
    { name: 'castle', yaw: 45, pitch: 32, zoom: 3.4, target: [17, 2.5, 17.5] },
    { name: 'castle-nw', yaw: 225, pitch: 32, zoom: 3.4, target: [17, 2.5, 17.5] },
    { name: 'acropolis', yaw: 45, pitch: 30, zoom: 3.8, target: [34, 3, 28] },
    { name: 'viaduct', yaw: 10, pitch: 24, zoom: 6.5, target: [32, 2, 25.5] },
    { name: 'hill-and-mill', yaw: 135, pitch: 32, zoom: 3.2, target: [33, 3, 19] },
    { name: 'north', yaw: 225, pitch: 34, zoom: 3.2, target: [25, 1, 12] },
    { name: 'bridge', yaw: 190, pitch: 24, zoom: 7, target: [20, 1, 10.5] },
    // Close, at the height a player zooms in to.
    { name: 'close-shops', yaw: 45, pitch: 28, zoom: 7.5, target: [24.5, 1.8, 31.5] },
    { name: 'close-chapel', yaw: 45, pitch: 28, zoom: 6.5, target: [26.5, 3, 29] },
    { name: 'close-row', yaw: 45, pitch: 28, zoom: 7, target: [16.5, 1.6, 33] },
    { name: 'close-gate', yaw: 20, pitch: 26, zoom: 7, target: [20.5, 2, 21.5] },
    // The same town at dusk and at night.
    { name: 'dusk', yaw: 45, pitch: 35, zoom: 1.6, target: [23.5, 1, 24.5], time: 'dusk' },
    { name: 'dusk-town', yaw: 45, pitch: 33, zoom: 2.6, target: [24, 1.5, 30], time: 'dusk' },
    { name: 'night', yaw: 45, pitch: 35, zoom: 1.6, target: [23.5, 1, 24.5], time: 'night' },
    { name: 'night-town', yaw: 45, pitch: 33, zoom: 2.6, target: [24, 1.5, 30], time: 'night' },
  ],
  expect(plan, _dressing, check) {
    const floorRole = (x: number, y: number, z: number): string | undefined => plan.roles.get(check.floorStructure(x, y, z).id)?.role;
    // Houses.
    check.role(23, 1, 30, 'shop');
    check.role(30, 1, 31, 'inn');
    check.role(25, 2, 28, 'chapel');
    check.role(22, 1, 35, 'boathouse');
    check.role(18, 1, 36, 'keepers-cottage');
    check.role(14, 1, 38, 'stilt-house');
    check.role(16, 1, 32, 'row-house');
    check.role(12, 2, 24, 'townhouse');
    check.role(36, 1, 18, 'mill-house');
    check.role(33, 1, 17, 'cliff-house');
    check.role(27, 1, 10, 'manor');
    check.role(33, 1, 11, 'greenhouse');
    check.role(15, 1, 12, 'cottage');
    check.kind(8, 1, 30, 'house');
    check.kind(40, 0, 20, 'dock');
    check.hasFeature({ type: 'jetty' });
    // Towers and the lighthouse.
    check.role(28, 2, 28, 'steeple');
    check.role(24, 1, 29, 'clock-tower');
    check.role(38, 2, 26, 'campanile');
    check.role(31, 5, 18, 'observatory');
    check.role(13, 1, 13, 'castle-turret');
    check.role(24, 1, 10, 'dovecote');
    check.role(10, 2, 22, 'watchtower');
    check.role(19, 1, 37, 'lighthouse');
    check.role(37, 1, 18, 'windmill');
    // Marble and arches.
    check.role(35, 4, 27, 'temple');
    check.role(15, 1, 15, 'keep');
    check.role(19, 1, 21, 'gatehouse');
    check.role(26, 1, 36, 'quay-wall');
    check.role(35, 2, 32, 'plinth');
    check.role(20, 1, 21, 'gateway');
    check.role(18, 0, 10, 'stone-bridge');
    check.role(13, 4, 24, 'sky-bridge');
    check.role(30, 1, 25, 'viaduct');
    check.role(31, 2, 33, 'loggia');
    check.role(19, 4, 15, 'flying-buttress');
    // The ground.
    check.role(24, 0, 36, 'pier');
    check.role(28, 0, 38, 'quay');
    check.role(7, 0, 32, 'boardwalk');
    check.role(40, 0, 20, 'jetty');
    check.role(26, 1, 32, 'tiered-fountain');
    check.role(15, 2, 28, 'well');
    check.role(27, 1, 13, 'birdbath');
    check.role(20, 1, 16, 'basin');
    check.role(28, 1, 31, 'market-stall');
    check.role(30, 1, 36, 'fish-stall');
    check.role(32, 1, 33, 'flower-stall');
    check.role(21, 1, 36, 'palm');
    check.role(29, 4, 17, 'pine');
    check.role(24, 1, 34, 'planter-tree');
    check.role(25, 1, 13, 'fruit-tree');
    check.role(24, 1, 15, 'grove-tree');
    check.role(14, 1, 13, 'curtain-wall');
    check.equal(floorRole(37, 1, 20), 'wheat-field', 'the field by the windmill');
    check.equal(floorRole(26, 1, 12), 'park-lawn', 'the manor park');
    check.equal(floorRole(19, 1, 12), 'reed-bed', 'the garden by the creek');
    check.equal(floorRole(15, 2, 29), 'herb-garden', 'the walled garden');
    check.equal(floorRole(14, 1, 33), 'kitchen-garden', 'a front garden on the lane');
    check.hasFeature({ type: 'terrain-steps' }, 5);
    check.hasFeature({ type: 'plaza-motif' });
    check.hasFeature({ type: 'railing', variant: 'balustrade' });
    check.ok(plan.supports.length >= 6, 'the folly stands on generated supports');
  },
});
