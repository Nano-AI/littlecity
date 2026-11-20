// Mischief (design section 13b): a street to set alight. A terrace of timber
// and thatch houses touching each other along the north side, a two-cell
// street, a second row across it with a stone tower in the middle, trees
// at the ends and a fountain on a little square. Light the west end and
// watch the wind take it along the terrace; the street holds it.

import { scenario } from '@/scenario';

export default scenario({
  name: 'mischief-street',
  seed: 2026,
  about: 'A terrace of timber houses, a street, a second row with a stone tower: a street to set alight and to bomb.',
  build(b) {
    // The terrace: touching houses of alternating colours (separate buildings), thatch and Tudor styles.
    for (let i = 0; i < 9; i++) {
      const x = 12 + i * 2;
      const floors = i % 3 === 1 ? 1 : 2;
      for (let dx = 0; dx < 2; dx++) {
        for (let f = 0; f < floors; f++) {
          b.edit({ type: 'placeBlock', cell: b.cell(x + dx, 1 + f, 18), kind: 'house', color: i % 2 === 0 ? 2 : 6, from: null, style: i % 2 === 0 ? 2 : 3 });
        }
      }
    }
    b.path(10, 19, 32, 20);
    // Across the street.
    for (let i = 0; i < 4; i++) b.house(12 + i * 2, 21, { floors: 2, color: i % 2 === 0 ? 4 : 0 });
    b.tower(21, 21, { floors: 3 });
    for (let i = 0; i < 4; i++) b.house(23 + i * 2, 21, { floors: 1 + (i % 2), color: i % 2 === 0 ? 3 : 5 });
    b.put('tree', 10, 17).put('tree', 31, 17).put('tree', 10, 22).put('tree', 32, 22);
    b.plaza(18, 24, 21, 26);
    b.put('fountain', 19, 25);
    b.put('stall', 21, 25);
  },
  cameras: [
    { name: 'street', yaw: 30, pitch: 34, zoom: 2.6, target: [21, 1, 20] },
    { name: 'close', yaw: 30, pitch: 30, zoom: 4.5, target: [16, 1, 19] },
  ],
});
