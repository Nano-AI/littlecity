// Discovery round 1: a stilt village in a lagoon: a ring of land round
// sheltered water with a channel to the sea, houses on docks over the water
// joined by boardwalks, an islet with a palm, a fish market, a lone house
// on Auto blocks out on the water, and a few houses on the ring.
//
//   npm run shots -- disc1-lagoon

import { scenario } from '@/scenario';
import { close, quarters, road } from './lib';

export default scenario({
  name: 'disc1-lagoon',
  seed: 9106,
  about: 'Discovery: a stilt village in a lagoon ringed by land, with boardwalks, an islet and a channel to the sea.',
  terrain(t) {
    t.disc(24, 24, 17, 1);
    t.disc(24, 24, 11, 0); // the lagoon
    t.water(22, 33, 26, 43); // the channel to the sea
    t.disc(19, 21, 1.5, 1); // an islet
    t.rect(32, 10, 38, 16, 2); // a low headland
  },
  build(b) {
    // Main boardwalk across the lagoon from the west shore to the east.
    for (let x = 14; x <= 34; x++) if (b.ground(x, 26) === 0) b.block('dock', x, 0, 26);
    // Stilt houses along it, north and south side.
    for (const x of [16, 19, 22, 25, 28, 31]) {
      b.block('dock', x, 0, 25);
      b.block('house', x, 1, 25, { color: x % 8 });
      if (x % 2 === 0) b.block('house', x, 2, 25, { color: x % 8 });
      if (x !== 22) {
        b.block('dock', x + 1, 0, 27);
        b.block('house', x + 1, 1, 27, { color: (x + 3) % 8 });
      }
    }
    // A branch boardwalk north to the islet and a fish market platform.
    for (let z = 22; z <= 25; z++) if (z !== 25 || b.ground(24, z) === 0) { if (!b.world.blocks.has(b.cell(24, 0, z))) b.block('dock', 24, 0, z); }
    for (let x = 23; x <= 27; x++) for (let z = 19; z <= 21; z++) b.block('dock', x, 0, z);
    b.put('stall', 24, 20).put('stall', 26, 20).put('stall', 25, 19);
    b.put('tree', 19, 21);
    b.house(20, 20, { color: 2 });
    // A house out on its own on Auto blocks in the lagoon.
    b.block('auto', 30, 0, 18).block('auto', 30, 1, 18).block('auto', 30, 2, 18);
    // Houses on the ring: west, north and east shores, with paths.
    road(b, [9, 18], [9, 32]);
    road(b, [9, 26], [13, 26]);
    for (const z of [19, 22, 29, 31]) b.house(8, z, { floors: 2, color: z % 8 });
    road(b, [14, 11], [32, 11]);
    for (const x of [15, 18, 21, 26, 29]) b.house(x, 9, { w: 2, floors: 2, color: x % 8 });
    road(b, [35, 26], [39, 26], [39, 18], [35, 17]);
    b.house(37, 22, { w: 2, d: 2, floors: 2, color: 6 });
    b.house(35, 13, { w: 2, floors: 1, color: 1 });
    // Piers at the channel mouth, a lighthouse on the point.
    for (let z = 34; z <= 38; z++) b.block('dock', 22, 0, z);
    b.stack('lighthouse', 28, 37, { floors: 4 });
    b.put('tree', 12, 14).put('tree', 13, 36).put('tree', 34, 35).put('tree', 37, 30).put('tree', 28, 10);
  },
  cameras: [
    ...quarters([24, 1, 24], 1.8),
    close('stilts', 24, 1, 26, 45, 4),
    close('market', 25, 1, 20, 135, 5),
    close('auto-house', 30, 1.5, 18, 45, 6),
    close('channel', 24, 1, 36, 315, 4),
  ],
});
