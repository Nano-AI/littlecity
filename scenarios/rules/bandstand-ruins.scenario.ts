// R-M11: the bandstand in every damage state, west to east as in the
// mischief galleries (sound, scorched, half-burnt, burnt out, cracked,
// half-wrecked, rubble, then mending: clearing, walls, rafters, tiles,
// paint). The marble (roof, entablature, plinth) and each pillar (its
// columns) break by their own damage. A second row has only the roof hit,
// and a third only the pillars.
//
//   npm run shots -- bandstand-ruins

import { scenario } from '@/scenario';
import { ruinBox, STATES } from '../mischief/states';

export default scenario({
  name: 'bandstand-ruins',
  seed: 1911,
  about: 'A bandstand in every damage state; then with only its roof damaged; then only its pillars.',
  terrain(t) {
    t.rect(0, 0, 47, 20, 1);
  },
  build(b) {
    b.plaza(0, 2, 47, 15);
    // Rows: the whole pavilion (y 1–3), the marble only (y 3), the pillars only (y 1–2).
    const rows: [number, number][] = [[1, 3], [3, 1], [1, 2]];
    rows.forEach(([y, floors], r) => {
      const z = 3 + r * 4;
      STATES.forEach((st, i) => {
        const x = 1 + i * 4;
        for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) b.stack('pillar', x + dx, z + dz, { floors: 2 }).block('marble', x + dx, 3, z + dz, { color: 2 });
        ruinBox(b, x, y, z, 2, 2, floors, st.ruin);
      });
    });
  },
  cameras: [
    { name: 'west', yaw: 30, pitch: 30, zoom: 3.4, target: [13, 1.5, 7] },
    { name: 'east', yaw: 30, pitch: 30, zoom: 3.4, target: [36, 1.5, 7] },
    { name: 'all', yaw: 20, pitch: 40, zoom: 1.7, target: [24, 1.5, 8] },
  ],
  expect(_plan, _dressing, check) {
    check.role(1, 3, 3, 'bandstand');
    check.role(25, 3, 3, 'bandstand');
  },
});
