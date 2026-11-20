// Gallery (mischief, design section 13b): houses in every damage state,
// west to east: sound, scorched, half-burnt, burnt out, cracked,
// half-wrecked, rubble, then mending from a burnt-out shell back to sound.
// Rows, north to south: a two-storey cottage, a 2 × 2 house, a three-storey
// house, and long inns damaged at their east end only (states 1–10).

import { scenario } from '@/scenario';
import { ruinBox, STATES } from './states';

export default scenario({
  name: 'mischief-ruins-houses',
  seed: 1913,
  about: 'Houses in every damage state (sound, scorched, half-burnt, burnt out, cracked, half-wrecked, rubble, mending 3 to 0), and long inns damaged at one end.',
  terrain(t) {
    t.rect(1, 1, 46, 46, 1);
  },
  build(b) {
    STATES.forEach((st, i) => {
      const x = 3 + i * 4;
      b.house(x, 4, { floors: 2, color: 2 });
      ruinBox(b, x, 1, 4, 1, 1, 2, st.ruin);
      b.house(x, 9, { floors: 2, w: 2, d: 2, color: 4 });
      ruinBox(b, x, 1, 9, 2, 2, 2, st.ruin);
      b.house(x, 15, { floors: 3, color: 5 });
      ruinBox(b, x, 1, 15, 1, 1, 3, st.ruin);
    });
    // Long inns, damaged in part: the east two columns of each take the state.
    STATES.slice(1).forEach((st, i) => {
      const x = 2 + (i % 5) * 9;
      const z = 21 + Math.floor(i / 5) * 5;
      b.house(x, z, { floors: 2, w: 5, d: 1, color: 0 });
      ruinBox(b, x + 3, 1, z, 2, 1, 2, st.ruin);
    });
  },
  cameras: [
    { name: 'fire', yaw: 45, pitch: 32, zoom: 3.2, target: [9, 1, 10] },
    { name: 'blast', yaw: 45, pitch: 32, zoom: 3.2, target: [23, 1, 10] },
    { name: 'mending', yaw: 45, pitch: 32, zoom: 3.2, target: [37, 1, 10] },
    { name: 'inns', yaw: 45, pitch: 34, zoom: 2.2, target: [22, 1, 26] },
    { name: 'back', yaw: 225, pitch: 32, zoom: 3.2, target: [16, 1, 10] },
    { name: 'close', yaw: 35, pitch: 28, zoom: 6, target: [15, 1, 9] },
  ],
});
