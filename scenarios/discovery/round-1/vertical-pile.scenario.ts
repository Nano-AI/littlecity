// Discovery round 1: a wild vertical pile: towers joined by arches high up,
// houses floating on generated supports, a windmill on a tower, stairs
// climbing marble ledges, a lighthouse on a house, rooms bridging rooms.
//
//   npm run shots -- disc1-vertical-pile

import { scenario } from '@/scenario';
import { close, quarters, road } from './lib';

export default scenario({
  name: 'disc1-vertical-pile',
  seed: 9108,
  about: 'Discovery: a vertical pile of towers, arches, houses on supports and stairs, the kind of thing players stack.',
  build(b) {
    road(b, [10, 30], [38, 30]);
    road(b, [24, 16], [24, 34]);
    // Four towers of different heights round a court.
    b.tower(18, 20, { floors: 8, color: 1 });
    b.tower(30, 20, { floors: 6, color: 3 });
    b.tower(18, 27, { floors: 5, color: 5 });
    b.tower(30, 27, { floors: 7, color: 0 });
    // Arch runs between them at height.
    for (let x = 19; x <= 29; x++) b.block('arch', x, 5, 20);
    for (let z = 21; z <= 26; z++) b.block('arch', 30, 4, z);
    // Houses floating on the arch run and further up.
    for (const x of [21, 22, 23]) b.block('house', x, 6, 20, { color: 6 });
    b.block('house', 22, 7, 20, { color: 6 });
    for (const x of [26, 27]) b.block('house', x, 6, 20, { color: 2 });
    // A house high in the air on nothing (generated supports below it).
    for (const x of [21, 22]) for (const z of [24, 25]) b.block('house', x, 4, z, { color: 4 });
    b.block('house', 21, 5, 24, { color: 4 });
    // A windmill on the tallest tower; a lighthouse on a house.
    b.block('windmill', 18, 9, 20);
    b.house(34, 24, { floors: 2, color: 7 });
    b.stack('lighthouse', 34, 24, { floors: 3 });
    // Marble ledges climbing with stairs: a staircase street up the side.
    for (let i = 0; i < 5; i++) b.stack('marble', 12 + i, 22, { floors: i + 1, color: 1 });
    for (let i = 0; i < 4; i++) {
      if (i > 0) b.stack('marble', 12 + i, 23, { floors: i, color: 1 });
      b.block('stairs', 12 + i, i + 1, 23, { rot: 1 });
    }
    // A sky bridge between two houses.
    b.house(8, 24, { floors: 4, color: 2 });
    b.house(12, 26, { floors: 4, color: 5 });
    for (let x = 9; x <= 11; x++) b.block('arch', x, 4, 24);
    b.house(12, 24, { floors: 4, color: 5 });
    // A loggia and a jettied room off a house.
    b.house(36, 30, { w: 2, floors: 3, color: 3 });
    b.block('arch', 36, 3, 31).block('arch', 37, 3, 31);
    b.block('house', 38, 3, 30, { color: 3 });
    // A tower on a house on a tower.
    b.tower(26, 34, { floors: 2, color: 4 });
    b.block('house', 26, 3, 34, { color: 1 }).block('house', 26, 4, 34, { color: 1 });
    b.block('tower', 26, 5, 34, { color: 6 }).block('tower', 26, 6, 34, { color: 6 });
    // Pillars carrying a platform with a house on it.
    for (const [x, z] of [[14, 33], [16, 33], [14, 35], [16, 35]] as const) b.stack('pillar', x, z, { floors: 3 });
    for (let x = 14; x <= 16; x++) for (let z = 33; z <= 35; z++) b.block('marble', x, 4, z, { color: 0 });
    b.block('house', 15, 5, 34, { color: 6 });
    b.put('tree', 24, 24).put('fountain', 25, 24);
  },
  cameras: [
    ...quarters([24, 4, 26], 1.9),
    close('court', 24, 5, 23, 45, 3.6),
    close('court-nw', 24, 5, 23, 225, 3.6),
    close('ledges', 14, 3, 23, 45, 4.5),
    close('platform', 15, 4, 34, 45, 5),
  ],
});
