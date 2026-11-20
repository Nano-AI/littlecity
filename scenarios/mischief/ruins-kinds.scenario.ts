// Gallery (mischief, design section 13b): every other kind of block in every
// damage state, west to east as in mischief-ruins-houses (sound, scorched,
// half-burnt, burnt out, cracked, half-wrecked, rubble, then mending: clearing, walls, rafters, tiles, paint).
// Rows, north to south: tower, lighthouse, windmill, marble, pillar, stall,
// fountain, tree, fence and low wall, and docks on the sea.

import { scenario } from '@/scenario';
import type { PlacedKind } from '@/core/kinds';
import { ruinBox, STATES } from './states';

const ROWS: readonly { kind: PlacedKind; floors?: number; w?: number; d?: number }[] = [
  { kind: 'tower', floors: 3 },
  { kind: 'lighthouse', floors: 3 },
  { kind: 'windmill', floors: 2 },
  { kind: 'marble', floors: 1, w: 2 },
  { kind: 'pillar', floors: 2 },
  { kind: 'stall' },
  { kind: 'fountain' },
  { kind: 'tree' },
  { kind: 'fence', w: 2 },
];

export default scenario({
  name: 'mischief-ruins-kinds',
  seed: 1914,
  about: 'Towers, lighthouses, windmills, marble, pillars, stalls, fountains, trees, fences and docks in every damage state.',
  terrain(t) {
    t.rect(1, 1, 46, 40, 1);
  },
  build(b) {
    ROWS.forEach((row, r) => {
      const z = 2 + r * 4;
      STATES.forEach((st, i) => {
        const x = 1 + i * 4;
        const w = row.w ?? 1;
        const d = row.d ?? 1;
        const floors = row.floors ?? 1;
        b.stack(row.kind, x, z, { floors, w, d, color: 1 });
        ruinBox(b, x, 1, z, w, d, floors, st.ruin);
      });
    });
    // Docks: a little pier per state, out on the sea.
    STATES.forEach((st, i) => {
      const x = 1 + i * 4;
      for (let dz = 0; dz < 3; dz++) {
        for (let dx = 0; dx < 2; dx++) b.block('dock', x + dx, 0, 41 + dz);
      }
      ruinBox(b, x, 0, 41, 2, 3, 1, st.ruin);
    });
  },
  cameras: [
    { name: 'stone', yaw: 45, pitch: 32, zoom: 2.4, target: [23, 1, 9] },
    { name: 'mid', yaw: 45, pitch: 32, zoom: 2.4, target: [23, 1, 23] },
    { name: 'low', yaw: 45, pitch: 34, zoom: 2.4, target: [23, 1, 35] },
    { name: 'docks', yaw: 45, pitch: 38, zoom: 3, target: [23, 0, 42] },
    { name: 'close-towers', yaw: 40, pitch: 28, zoom: 4.5, target: [14, 1, 6] },
    { name: 'close-trees', yaw: 40, pitch: 30, zoom: 4.5, target: [14, 1, 30] },
  ],
});
