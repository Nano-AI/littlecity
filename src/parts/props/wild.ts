// Shared drawing for the wild-ground props (D24) and anything else that
// wants a wildflower or a pebble: src/parts/props/{tuft,boulder,beach-find,
// reeds,lily-pads}.part.ts.

import type { Vec3 } from '@/core/mat4';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { blade, lump, mixColor, mound, vary, TONE, type Rgb, type Rng } from './kit';

/** The green of long grass: a step deeper than the lawn it stands in. */
export function longGrass(r: number): Rgb {
  return vary(mixColor(PALETTE.bush, PALETTE.leafDark, 0.2), r);
}

/**
 * A clump of long grass: a few broad blades fanning from one foot, all in
 * one flat tone. Bolder than the lawn's pencil ticks, so it survives at
 * playing zoom; it sways from the tip.
 */
export function grassClump(b: MeshBuilder, x: number, y: number, z: number, h: number, rng: Rng, key: string | number, blades = 3): void {
  // Broad blades (a pen's width would turn to ink at playing zoom), every one in the same flat
  // tone so they merge into one soft shape with a single outline.
  for (let i = 0; i < blades; i++) {
    const a = (i / blades + rng('ga', key, i) * 0.25) * Math.PI * 2;
    const lean = h * (0.35 + rng('gl', key, i) * 0.35), hh = h * (0.75 + rng('gh', key, i) * 0.45);
    const dx = Math.cos(a), dz = Math.sin(a);
    const pts: Vec3[] = [[x, y, z], [x + dx * lean * 0.4, y + hh * 0.55, z + dz * lean * 0.4], [x + dx * lean, y + hh, z + dz * lean]];
    b.setSway((_px, py) => Math.min(1, Math.max(0, (py - y) / h)) * 0.5);
    blade(b, pts, [h * 0.3, h * 0.24, 0.006], [-dz, 0.3, dx], TONE.lit, TONE.lit);
  }
  b.setSway(0);
}

/** A wildflower: a thin stem with a coloured head, swaying. */
export function wildflower(b: MeshBuilder, x: number, y: number, z: number, h: number, color: string, _stem: Rgb, size = 0.042): void {
  // Just the head: a bold dab of colour riding on the grass. A stem this thin would only be ink.
  b.setSway(0.3);
  b.with({ color }, () => {
    lump(b, x, y + h, z, size, size * 0.7, size, { seg: 6, rings: 3, normal: TONE.lit });
  });
  b.setSway(0);
}

/** A weathered stone sitting in the ground: a low, lopsided mound in rock tones. */
export function rock(b: MeshBuilder, x: number, y: number, z: number, r: number, rng: Rng, key: string | number): void {
  const c = vary(PALETTE.rock, rng('rc', key), 1.4);
  const rx = r * (0.85 + rng('rx', key) * 0.4), rz = r * (0.75 + rng('rz', key) * 0.4), ry = r * (0.55 + rng('ry', key) * 0.3);
  b.with({ color: c, pattern: PATTERN.rock }, () => mound(b, x, y - ry * 0.12, z, rx, ry, rz, { seg: 6, rings: 2, twist: rng('rt', key) * 3 }));
}
