// STUB (Stage 0). Owner: Look (Stage 1).
//
// The terrain layer: one mesh per chunk. The stub draws a box per column and
// a flat sea. The Look owner replaces it with rounded terraces, rock faces,
// the floating slab and the sea (design section 6, "Look").

import { CELL_H, columnIndex, inColumnBounds, SEA_Y } from '@/core/grid';
import { hashCombine } from '@/core/rand';
import { MAT } from '@/core/world';
import { PALETTE } from '@/style/palette';
import { defineLayer } from '../api';
import { MeshBuilder, PATTERN } from '../mesh';

const SEABED = -0.6;

export const terrainLayer = defineLayer({
  layer: 'terrain',

  build(chunk, plan) {
    const t = plan.terrain;
    const b = new MeshBuilder({ ink: `terrain:${chunk.cx}:${chunk.cz}` });
    const h = (x: number, z: number): number => (inColumnBounds(x, z) ? t.height[columnIndex(x, z)]! : 0);
    for (let z = chunk.z0; z <= chunk.z1; z++) {
      for (let x = chunk.x0; x <= chunk.x1; x++) {
        const here = h(x, z);
        if (here === 0) {
          b.setColor(PALETTE.sea).setPattern(PATTERN.water).setInk('sea');
          b.quad([x, SEA_Y, z + 1], [x + 1, SEA_Y, z + 1], [x + 1, SEA_Y, z], [x, SEA_Y, z]);
          continue;
        }
        const top = here * CELL_H;
        const sand = t.material[columnIndex(x, z)] === MAT.sand;
        b.setColor(sand ? PALETTE.sand : PALETTE.grass).setPattern(sand ? PATTERN.sand : PATTERN.grass).setInk(`top${here}`);
        b.quad([x, top, z + 1], [x + 1, top, z + 1], [x + 1, top, z], [x, top, z]);
        b.setColor(PALETTE.dirt).setPattern(PATTERN.earth).setInk('side');
        const side = (nx: number, nz: number, face: 'n' | 'e' | 's' | 'w'): void => {
          const there = h(nx, nz);
          if (there >= here) return;
          const bottom = there === 0 ? SEABED : there * CELL_H;
          b.box([x, bottom, z], [x + 1, top, z + 1], { only: [face] });
        };
        side(x, z - 1, 'n');
        side(x + 1, z, 'e');
        side(x, z + 1, 's');
        side(x - 1, z, 'w');
      }
    }
    return { mesh: b.build(), anchors: {} };
  },

  hash(chunk, plan) {
    const t = plan.terrain;
    let hsh = hashCombine(t.seed, chunk.cx, chunk.cz);
    for (let z = chunk.z0 - 1; z <= chunk.z1 + 1; z++) {
      for (let x = chunk.x0 - 1; x <= chunk.x1 + 1; x++) {
        if (!inColumnBounds(x, z)) continue;
        const i = columnIndex(x, z);
        hsh = hashCombine(hsh, t.height[i]!, t.material[i]!);
      }
    }
    return hsh;
  },
});
