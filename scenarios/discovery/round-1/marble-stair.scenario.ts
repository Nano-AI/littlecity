// Discovery round 1: the owner's own example. A temple precinct reached by a
// big marble stair, with plinths, platforms, a colonnade of free pillars, a
// stepped marble half-bowl (a theatre?), an obelisk, a big blank platform and
// the awkward voids a player leaves around all of it.
//
//   npm run shots -- disc1-marble-stair

import { scenario } from '@/scenario';
import { close, quarters, road } from './lib';

export default scenario({
  name: 'disc1-marble-stair',
  seed: 9105,
  about: 'Discovery: a temple precinct up a big marble stair, plinths, a colonnade, a theatre-like bowl and a blank platform.',
  terrain(t) {
    t.flat(1);
    t.water(4, 40, 43, 43);
  },
  build(b) {
    // The great stair: 4 wide, climbing north from level 1 to the platform at level 5.
    for (let i = 0; i < 4; i++) for (let x = 20; x <= 23; x++) b.stack('marble', x, 30 - i, { floors: i + 1, color: 0 });
    // The upper platform: 12 × 8 at height 4 (top at level 5).
    b.fill('marble', 14, 19, 29, 26, { floors: 4, color: 0 });
    // The temple on the platform: six pillars and a roof slab.
    for (const x of [17, 19, 21]) for (const z of [20, 23]) {
      b.stack('pillar', x, z, { floors: 2 });
    }
    for (let x = 17; x <= 21; x++) for (let z = 20; z <= 23; z++) b.block('marble', x, 7, z, { color: 2 }); // the roof slab on the pillars
    // Plinths on the platform forecourt.
    b.plaza(22, 20, 28, 26);
    b.put('marble', 24, 22, { color: 3 });
    b.put('marble', 27, 22, { color: 3 });
    b.put('marble', 24, 25, { color: 3 });
    // An obelisk at the foot of the stair, on the lower forum.
    b.plaza(16, 31, 27, 36);
    b.stack('marble', 18, 34, { floors: 4, color: 1 });
    b.put('fountain', 25, 34);
    // A colonnade along the forum's west side: free pillars, no lintel.
    for (let z = 31; z <= 36; z++) b.stack('pillar', 14, z, { floors: 2 });
    // A stoa on the east: pillars carrying a marble roof.
    for (let z = 31; z <= 36; z += 1) b.stack('pillar', 29, z, { floors: 2 });
    for (let z = 31; z <= 36; z++) b.block('marble', 29, 3, z, { color: 2 });
    for (let z = 31; z <= 36; z++) b.block('marble', 30, 3, z, { color: 2 });
    for (let z = 31; z <= 36; z++) b.stack('pillar', 31, z, { floors: 2 });
    // The theatre: three rows of marble steps in a half-bowl facing a little stage.
    for (const [x, z, h] of [
      [34, 12, 1], [35, 12, 1], [36, 12, 1], [37, 12, 1], [38, 12, 1],
      [34, 11, 2], [35, 11, 2], [36, 11, 2], [37, 11, 2], [38, 11, 2],
      [34, 10, 3], [35, 10, 3], [36, 10, 3], [37, 10, 3], [38, 10, 3],
      [33, 11, 1], [33, 10, 2], [39, 11, 1], [39, 10, 2],
    ] as const) b.stack('marble', x, z, { floors: h, color: 1 });
    b.plaza(34, 13, 38, 14); // the stage floor
    // A big blank marble podium with nothing on it, off to the side.
    b.fill('marble', 6, 20, 11, 25, { floors: 2, color: 2 });
    // The roads in, and some houses that leave awkward gaps against the platform.
    road(b, [21, 37], [21, 39]);
    road(b, [6, 30], [15, 30]);
    road(b, [28, 30], [40, 30], [40, 18]);
    b.house(9, 27, { w: 3, d: 2, floors: 2, color: 4 });
    b.house(31, 25, { w: 2, d: 3, floors: 2, color: 1 });
    b.house(14, 15, { w: 3, d: 2, floors: 3, color: 5 });
    b.house(26, 15, { w: 2, floors: 2, color: 6 });
    // Grand steps on the side of the platform: 2 wide.
    for (let i = 0; i < 4; i++) for (const z of [21, 22]) b.stack('marble', 30 + i, z, { floors: 4 - i, color: 0 });
    // A tower on the platform's corner.
    b.put('tower', 14, 19).put('tower', 14, 19).put('tower', 14, 19);
    b.put('tree', 8, 33).put('tree', 10, 35).put('tree', 36, 33).put('tree', 38, 35).put('tree', 12, 12).put('tree', 34, 12);
  },
  cameras: [
    ...quarters([22, 3, 26], 1.8),
    close('stair', 21.5, 3, 28, 45, 4, 28),
    close('stair-side', 19, 2, 28, 315, 4.5, 28),
    close('temple', 19, 6, 22, 45, 4.5),
    close('forum', 22, 1.5, 33, 45, 3.8, 38),
    close('theatre', 36, 2, 12, 135, 5),
    close('podium', 8.5, 2.5, 22.5, 225, 5),
    close('under-platform', 26, 2, 28, 135, 4.5),
  ],
});
