// GALLERY: the six house styles (design section 7, "House style") in each
// of the eight wall colours, as a single cottage and as a two-storey house,
// to judge that every style is attractive in every colour and that the six
// are easy to tell apart at playing zoom.
//
//   npm run shots -- house-styles             (and --time dusk)
//
// Columns west to east: Harbour, Thatch, Tudor, Manor, Farm, Villa; in each,
// a cottage then a two-storey house. Rows north to south: wall colours 0–7,
// each along its own path (so the houses face it and none is rustic).

import { key } from '@/core/grid';
import { structureStyle } from '@/resolve/structures';
import { scenario } from '@/scenario';
import { HOUSE_STYLES } from '@/style/houses';

const X0 = 6;
const STEP_X = 6;
const Z0 = 6;
const STEP_Z = 4;

export default scenario({
  name: 'gallery.house-styles',
  seed: 1119,
  about: 'Six house styles × eight wall colours, as cottages and two-storey houses.',
  terrain(t) {
    t.rect(3, 3, 44, 40, 1);
  },
  build(b) {
    const place = (x: number, y: number, z: number, color: number, style: number): void => {
      const from = y > 1 ? key(x, y - 1, z) : null;
      b.edit({ type: 'placeBlock', cell: key(x, y, z), kind: 'house', color, from, style }, `style ${style} at (${x}, ${y}, ${z})`);
    };
    for (let c = 0; c < 8; c++) {
      const z = Z0 + c * STEP_Z;
      b.path(X0 - 2, z + 1, X0 + STEP_X * HOUSE_STYLES.length, z + 1);
      HOUSE_STYLES.forEach((_, i) => {
        const style = i + 1;
        const x = X0 + i * STEP_X;
        place(x, 1, z, c, style); // a cottage
        place(x + 2, 1, z, c, style); // a two-storey house, two cells wide
        place(x + 3, 1, z, c, style);
        place(x + 2, 2, z, c, style);
        place(x + 3, 2, z, c, style);
      });
    }
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 34, zoom: 1.7, target: [23, 1.5, 21] },
    { name: 'rows-0-1', yaw: 45, pitch: 32, zoom: 3.6, target: [23, 1.5, 8] },
    { name: 'rows-2-3', yaw: 45, pitch: 32, zoom: 3.6, target: [23, 1.5, 16] },
    { name: 'rows-4-5', yaw: 45, pitch: 32, zoom: 3.6, target: [23, 1.5, 24] },
    { name: 'rows-6-7', yaw: 45, pitch: 32, zoom: 3.6, target: [23, 1.5, 32] },
    { name: 'close', yaw: 40, pitch: 28, zoom: 7, target: [15, 1.5, 10] },
  ],
  expect(plan, _dressing, check) {
    const houses = [...plan.structures.values()].filter((s) => s.kind === 'house');
    check.equal(houses.length, 8 * HOUSE_STYLES.length * 2, 'one cottage and one two-storey house per style and colour');
    for (const s of houses) {
      const x = s.cells.reduce((m, c) => Math.min(m, c & 63), 99);
      const want = Math.floor((x - X0) / STEP_X) + 1;
      check.equal(structureStyle(plan.world, s), want, `house ${s.id} has style ${want}`);
    }
  },
});
