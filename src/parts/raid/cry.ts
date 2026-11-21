// The raiders' war cry (design section 13b, the raid): a jagged shout balloon
// over a raider's head, "RAAR!" or a row of runes, in the comic manner of the
// scuffle's swearing (src/parts/people/scuffle-art.ts). Flat in its XY plane
// facing +Z (and lettered on the back too); the raid turns it to the camera.
// Origin at the tip of its tail. Pure.

import { rotationY } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { balloon, dot, stroke } from '@/parts/people/balloon';

type Pt = readonly [number, number];

/** Letters as strokes in a box 1 wide and 1 tall (origin bottom left). */
const GLYPHS: Record<string, readonly (readonly Pt[])[]> = {
  R: [[[0, 0], [0, 1], [0.62, 1], [0.8, 0.85], [0.8, 0.65], [0.62, 0.5], [0, 0.5]], [[0.35, 0.5], [0.85, 0]]],
  A: [[[0, 0], [0.42, 1], [0.84, 0]], [[0.18, 0.4], [0.66, 0.4]]],
  '!': [[[0.2, 1], [0.2, 0.32]]],
  // Runes: ᚱ (raido), ᚨ (ansuz), ᛏ (tiwaz), ᚦ (thurisaz).
  r: [[[0.1, 0], [0.1, 1], [0.7, 0.72], [0.1, 0.45], [0.7, 0]]],
  a: [[[0.2, 0], [0.2, 1]], [[0.2, 0.95], [0.75, 0.62]], [[0.2, 0.62], [0.75, 0.3]]],
  t: [[[0.4, 0], [0.4, 1]], [[0, 0.62], [0.4, 1], [0.8, 0.62]]],
  h: [[[0.15, 0], [0.15, 1]], [[0.15, 0.78], [0.7, 0.5], [0.15, 0.22]]],
};

function word(b: MeshBuilder, text: string, x0: number, y0: number, h: number, w: number, z: number): void {
  const step = h * 0.78;
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) return;
    const ox = x0 + i * step;
    for (const line of g) stroke(b, line.map(([x, y]) => [ox + x * h * 0.62, y0 + y * h] as const), w, z);
    if (ch === '!') dot(b, ox + 0.2 * h * 0.62, y0 + 0.08 * h, w * 0.75, z, 8);
  });
}

/** A war cry: variant 0 "RAAR!", 1 a row of runes, 2 "RAAAR!". */
export function cryMesh(variant: number): MeshData {
  const b = new MeshBuilder({ ink: `raid-cry-${variant}` });
  const text = variant % 3 === 1 ? 'rath' : variant % 3 === 2 ? 'RAAAR!' : 'RAAR!';
  const h = 0.085, w = 0.017;
  const rx = Math.max(0.2, ([...text].length * h * 0.78) / 2 + 0.05), ry = 0.1, cy = 0.2, t = 0.01;
  b.setInk('balloon').setColor(PALETTE.white).setPattern(PATTERN.none);
  // A shout: a jagged, wobbling rim.
  balloon(b, { rx, ry, cy, t, segments: 44, wobble: 0.09, seed: variant + 3, tipX: -0.05, bow: 0.02 });
  b.setInk('cry').setColor(variant % 3 === 1 ? PALETTE.redDark : PALETTE.ink);
  const width = [...text].length * h * 0.78 - h * 0.16;
  for (const side of [0, Math.PI]) b.at(rotationY(side), () => word(b, text, -width / 2, cy - h / 2, h, w, t + 0.001));
  return b.build();
}
