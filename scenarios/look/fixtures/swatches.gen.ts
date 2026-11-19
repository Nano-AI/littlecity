// LOOK FIXTURE. A layer that lays out one sample block per pencil pattern,
// for the art guide and for checking a new pattern. It draws only in the
// look-swatches scenario (by seed).
//
// Each sample is a block with a flat top; patterns meant for slopes also
// get a little pitched roof, and leaves get a blob.

import { CELL_H, CHUNK } from '@/core/grid';
import { defineLayer } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { PALETTE, RAMPS } from '@/style/palette';
import { blob } from './shapes';

export const SWATCH_SEED = 0x100c7f;

/** Row by row, front (south) row first, west to east: the order the art guide lists them in. */
export const SWATCHES: readonly { name: keyof typeof PATTERN; color: string; shape?: 'roof' | 'blob' | 'flat' }[] = [
  { name: 'none', color: PALETTE.stone },
  { name: 'grass', color: PALETTE.grass },
  { name: 'shingles', color: RAMPS.roof[0]!, shape: 'roof' },
  { name: 'earth', color: PALETTE.dirt },
  { name: 'stone', color: PALETTE.stone },
  { name: 'paving', color: PALETTE.plaza },
  { name: 'planks', color: PALETTE.wood },
  { name: 'glass', color: PALETTE.glass },
  { name: 'marble', color: PALETTE.marble },
  { name: 'sand', color: PALETTE.sand },
  { name: 'rock', color: PALETTE.rock },
  { name: 'water', color: PALETTE.sea },
  { name: 'plaster', color: RAMPS.wall[0]! },
  { name: 'brick', color: PALETTE.brick },
  { name: 'cobbles', color: PALETTE.stoneShade },
  { name: 'thatch', color: RAMPS.wood[5]!, shape: 'roof' },
  { name: 'timber', color: RAMPS.wall[5]! },
  { name: 'leaves', color: PALETTE.leaf, shape: 'blob' },
  { name: 'bark', color: PALETTE.trunk },
  { name: 'stripes', color: PALETTE.red, shape: 'roof' },
  { name: 'crops', color: PALETTE.garden },
  { name: 'cloth', color: PALETTE.pink, shape: 'roof' },
  { name: 'metal', color: PALETTE.metal },
  { name: 'dirt', color: PALETTE.path },
  { name: 'foam', color: PALETTE.foam },
  { name: 'glow', color: PALETTE.yellow },
  { name: 'planksAcross', color: PALETTE.wood },
];

export const SWATCH_COLUMNS = 9;
/** North-west corner of the grid of samples, and the distance between them. */
export const SWATCH_ORIGIN: readonly [number, number] = [13, 19];
export const SWATCH_PITCH = 2.5;

export const swatchLayer = defineLayer({
  layer: 'look-swatches',
  build(chunk, plan) {
    const b = new MeshBuilder({ ink: 'swatches' });
    if (plan.world.seed !== SWATCH_SEED) return { mesh: b.build(), anchors: {} };
    const rows = Math.ceil(SWATCHES.length / SWATCH_COLUMNS);
    SWATCHES.forEach((sw, i) => {
      const col = i % SWATCH_COLUMNS, row = Math.floor(i / SWATCH_COLUMNS);
      const x = SWATCH_ORIGIN[0] + col * SWATCH_PITCH, z = SWATCH_ORIGIN[1] + (rows - 1 - row) * SWATCH_PITCH;
      if (Math.floor(x / CHUNK) !== chunk.cx || Math.floor(z / CHUNK) !== chunk.cz) return;
      const y = CELL_H, w = 1.5, h = 0.8;
      b.setColor(sw.color).setPattern(PATTERN[sw.name]).setInk(`s${i}`);
      b.box([x, y, z], [x + w, y + h, z + w], { skip: ['bottom'], bevelTop: sw.name === 'marble' });
      if (sw.shape === 'roof') {
        const y0 = y + h, y1 = y0 + 0.55, xm = x + w / 2;
        b.setInk(`s${i}-roof`);
        b.quad([x + w, y0, z + w], [x + w, y0, z], [xm, y1, z], [xm, y1, z + w]);
        b.quad([x, y0, z], [x, y0, z + w], [xm, y1, z + w], [xm, y1, z]);
        b.tri([x, y0, z + w], [x + w, y0, z + w], [xm, y1, z + w]);
        b.tri([x + w, y0, z], [x, y0, z], [xm, y1, z]);
      } else if (sw.shape === 'blob') {
        b.setInk(`s${i}-blob`);
        blob(b, x + w / 2, y + h + 0.42, z + w / 2, 0.5, 0.45, 0.5, 12);
      }
    });
    return { mesh: b.build(), anchors: {} };
  },
  hash: (chunk, plan) => (plan.world.seed === SWATCH_SEED ? 1 + chunk.cx * 3 + chunk.cz : 0),
});
