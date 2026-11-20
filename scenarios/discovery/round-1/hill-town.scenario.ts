// Discovery round 1: a hill town climbing terraces to a church on the top,
// with a switchback road, houses backed against each terrace, a cliff on the
// east face, a vineyard-like garden on the slope and a little square half way.
//
//   npm run shots -- disc1-hill-town

import { scenario } from '@/scenario';
import { close, quarters, road } from './lib';

export default scenario({
  name: 'disc1-hill-town',
  seed: 9102,
  about: 'Discovery: a hill town of terraces with a switchback road, a cliff face and a church at the summit.',
  terrain(t) {
    t.flat(1);
    t.water(4, 38, 43, 43);
    t.rect(8, 6, 40, 32, 2);
    t.rect(12, 8, 36, 27, 3);
    t.rect(16, 10, 32, 22, 4);
    t.rect(20, 12, 29, 18, 5);
    t.rect(23, 13, 27, 16, 6);
    t.rect(33, 8, 40, 20, 5); // the east crag: a cliff of 2 to 3 over the terraces
  },
  build(b) {
    // The switchback: up from the shore, along each terrace, turning at the ends.
    road(b, [10, 36], [10, 30]); // shore → level 2
    road(b, [10, 30], [34, 30]); // level 2 terrace street
    road(b, [34, 30], [34, 25]); // → level 3
    road(b, [34, 25], [14, 25]); // level 3 terrace street
    road(b, [14, 25], [14, 20]); // → level 4
    road(b, [14, 20], [18, 20]);
    road(b, [18, 20], [18, 16]);
    road(b, [18, 16], [21, 16]); // → level 5
    // Houses along level 2, backs to the drop to the shore; fronts to the street.
    for (let i = 0; i < 8; i++) b.house(11 + i * 3, 31, { w: 2, floors: 2 + (i % 2), color: i });
    // Houses along level 3, backed against the level-4 wall; a gap left at x 24-26.
    for (const x of [15, 17, 19, 21, 27, 29, 31]) b.house(x, 23, { w: 2, d: 2, floors: 2 + (x % 3 === 0 ? 1 : 0), color: x % 8 });
    // Houses along the level-2 street's upper side, backed against level 3.
    for (const x of [16, 20, 28]) b.house(x, 28, { floors: 2, color: (x + 3) % 8 });
    // A small square on level 4, and the town's shops around it.
    b.plaza(19, 19, 25, 21);
    b.put('fountain', 22, 20);
    b.house(26, 19, { w: 2, d: 3, floors: 2, color: 4 });
    b.house(19, 22, { w: 3, floors: 2, color: 1 }); // on the lip over level 3
    b.house(28, 21, { d: 1, floors: 1, color: 6 });
    // The church at the summit: nave and tower on level 6, its yard round it.
    b.house(23, 13, { w: 3, d: 2, color: 0 });
    b.tower(26, 13, { floors: 5, color: 1 });
    road(b, [21, 16], [24, 16], [24, 15]);
    // Marble stairs up the east crag to a lookout.
    road(b, [34, 24], [34, 23]);
    b.block('stairs', 34, 3, 22, { rot: 0 });
    b.block('marble', 34, 3, 21, { color: 1 });
    b.block('stairs', 34, 4, 21, { rot: 0 });
    b.tower(36, 12, { floors: 4, color: 5 });
    // Terraced gardens on the west slope (vines?).
    b.garden(9, 8, 11, 28);
    b.garden(13, 9, 15, 22);
    // Cliff houses at the foot of the crag.
    b.house(32, 12, { floors: 2, color: 3 });
    b.house(32, 15, { d: 2, floors: 3, color: 2 });
    // A harbour at the foot.
    road(b, [10, 36], [30, 36]);
    for (let x = 14; x <= 22; x++) b.block('dock', x, 0, 38);
    b.house(24, 34, { w: 3, d: 2, floors: 2, color: 7 });
    b.put('tree', 30, 34).put('tree', 38, 30).put('tree', 6, 20).put('tree', 37, 25).put('tree', 38, 26).put('tree', 30, 10).put('tree', 18, 8);
  },
  cameras: [
    ...quarters([24, 3, 22], 1.8),
    close('summit', 24, 6.5, 14, 45, 4.5),
    close('square', 22, 4.5, 20, 45, 4.5, 38),
    close('terraces', 22, 3, 27, 45, 3.6),
    close('crag', 34, 4, 18, 135, 4),
    close('west-slope', 11, 3, 18, 225, 3.6),
  ],
});
