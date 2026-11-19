// The Dressing owner's drawing kit: the small shapes the props are made of.
// It builds on the Ground owner's kit (flat-tone lumps, colour dabs, tubes,
// blades: src/parts/ground/kit.ts) and adds what dressing needs: lanterns,
// cloth that moves with the wind, pots, planks.
//
// Everything is drawn round the builder's origin and placed with `b.at`.
// Nothing here reads the clock; all chance comes in through an `Rng`.

import { DIR4, type Dir4 } from '@/core/grid';
import { rotationY, type Vec3 } from '@/core/mat4';
import { PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { dab, lump, mixColor, mound, vary, TONE, type Rgb, type Rng } from '@/parts/ground/kit';

export { blade, dab, groundNoise, lump, mixColor, mound, post, rngOf, roundedRect, sheet, tube, tuft, vary, TONE, SUN } from '@/parts/ground/kit';
export type { Rgb, Rng } from '@/parts/ground/kit';

/**
 * The flat-tone normals of the Ground kit (TONE) are WORLD directions, so they only work in a
 * frame that is square to the world. A prop anchored with a `face` is turned; this gives the same
 * tones expressed in that prop's own frame (pass the anchor's `face` to the part as a param).
 */
export function localTone(face: Dir4): { lit: Vec3; mid: Vec3; shade: Vec3; up: Vec3 } {
  const [zx, zz] = DIR4[face]!;
  const turn = (w: Vec3): Vec3 => [w[0] * zz - w[2] * zx, w[1], w[0] * zx + w[2] * zz];
  return { lit: turn(TONE.lit), mid: turn(TONE.mid), shade: turn(TONE.shade), up: TONE.up };
}

/** The flower colours every dressing prop draws from, so a town's flowers are one family. */
export function flowerColors(): readonly string[] {
  return [PALETTE.red, PALETTE.pink, PALETTE.yellow, PALETTE.white, PALETTE.magic];
}
/** The cloth colours of flags, bunting, laundry and parasols. */
export function clothColors(): readonly string[] {
  return [PALETTE.red, PALETTE.white, PALETTE.yellow, PALETTE.glass, PALETTE.pink, PALETTE.leafDark, PALETTE.magic];
}

/**
 * A four-sided lantern standing on the builder's origin: a glowing glass
 * body between a small base plate and a pyramid cap with a knob. `size` is
 * the width of the glass at its top. Inks: `<ink>-glass` and `<ink>-cap`.
 * Returns the height of the glass's middle (where the light is).
 */
export function lantern(b: MeshBuilder, size: number, ink = 'lantern', metal: ColorInput = PALETTE.metal): number {
  const w0 = size * 0.31, w1 = size * 0.5, h = size * 1.05;
  // The lathe's four sides sit on the diagonals; a quarter-turn squares them to the axes.
  b.at(rotationY(Math.PI / 4), () => {
    b.with({ color: metal, pattern: PATTERN.metal, ink: `${ink}-cap` }, () => {
      b.lathe([[w0 * 1.5, 0], [w0 * 1.5, size * 0.1]], { segments: 4, smooth: false, capTop: true, capBottom: true });
    });
    b.with({ color: PALETTE.yellow, pattern: PATTERN.glow, ink: `${ink}-glass` }, () => {
      b.lathe([[w0 * 1.2, size * 0.1], [w1 * 1.3, size * 0.1 + h]], { segments: 4, smooth: false });
    });
    b.with({ color: metal, pattern: PATTERN.metal, ink: `${ink}-cap` }, () => {
      const y = size * 0.1 + h;
      b.lathe([[w1 * 1.75, y], [w1 * 0.6, y + size * 0.42], [0, y + size * 0.62]], { segments: 4, smooth: false, capBottom: true });
    });
  });
  return size * 0.1 + h * 0.5;
}

/** A round post standing on the origin, tapering from r0 to r1. */
export function pole(b: MeshBuilder, r0: number, r1: number, y0: number, y1: number, segments = 6): void {
  b.lathe([[r0, y0], [r1, y1]], { segments, capTop: true });
}

/**
 * A sheet of cloth in the XY plane of the builder, drawn on both faces: the
 * outline is counter-clockwise seen from +Z. `sway` gives each vertex its
 * wind weight (0 where it is pegged).
 */
export function cloth(b: MeshBuilder, outline: readonly (readonly [number, number])[], z = 0, thickness = 0.012): void {
  const front = outline.map(([x, y]): Vec3 => [x, y, z + thickness / 2]);
  const back = [...outline].reverse().map(([x, y]): Vec3 => [x, y, z - thickness / 2]);
  b.polygon(front);
  b.polygon(back);
}

/** A terracotta pot standing on the origin, open at the top with earth in it. `r` is the rim radius. */
export function pot(b: MeshBuilder, r: number, h: number, color: ColorInput = PALETTE.brick, ink = 'pot'): void {
  b.with({ color, pattern: PATTERN.none, ink }, () => {
    b.lathe([[r * 0.68, 0], [r, h * 0.82], [r * 1.12, h * 0.82], [r * 1.12, h], [r * 0.9, h]], { segments: 7 });
  });
  b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink }, () => b.lathe([[r * 0.9, h], [0, h]], { segments: 7 }));
}

/** A small leafy clump with flower dabs on it: what grows in a pot, a box or a bed. */
export function posy(b: MeshBuilder, x: number, y: number, z: number, r: number, flower: ColorInput, rng: Rng, key: string | number, ink = 'green', heads = 3): void {
  b.with({ color: vary(PALETTE.leafDark, rng('g', key)), pattern: PATTERN.none, ink, sway: 0.2 }, () => {
    mound(b, x, y, z, r, r * 0.9, r, { seg: 6, rings: 2, normal: TONE.mid });
  });
  b.with({ color: flower, pattern: PATTERN.none, ink, sway: 0.25 }, () => {
    for (let i = 0; i < heads; i++) {
      const a = (i / heads + rng('fa', key, i) * 0.25) * Math.PI * 2, d = r * (0.3 + rng('fd', key, i) * 0.3);
      dab(b, x + Math.cos(a) * d, y + r * (0.66 + rng('fy', key, i) * 0.2), z + Math.sin(a) * d, r * 0.5, TONE.lit, 5, r * 0.3);
    }
  });
}

/** A rounded stone: a squashed, slightly irregular lump in flat tones. */
export function stone(b: MeshBuilder, x: number, y: number, z: number, rx: number, ry: number, rz: number, color: Rgb | string, twist = 0): void {
  b.with({ color, pattern: PATTERN.rock }, () => mound(b, x, y, z, rx, ry, rz, { seg: 7, rings: 2, twist }));
}

/** A leafy bush as two or three flat-toned mounds: one outline, light and shade inside it. */
export function bush(b: MeshBuilder, x: number, y: number, z: number, r: number, rng: Rng, key: string | number, color: ColorInput = PALETTE.bush, sway = 0.3): void {
  const c = vary(color, rng('bc', key));
  const shade = mixColor(c, PALETTE.leafDark, 0.45);
  b.with({ color: c, pattern: PATTERN.leaves, sway }, () => {
    mound(b, x, y, z, r, r * 0.95, r, { seg: 8, rings: 3, normal: TONE.lit });
    const a = rng('ba', key) * Math.PI * 2;
    lump(b, x + Math.cos(a) * r * 0.55, y + r * 0.42, z + Math.sin(a) * r * 0.55, r * 0.6, r * 0.55, r * 0.6, { seg: 7, rings: 4, normal: TONE.lit });
  });
  b.with({ color: shade, pattern: PATTERN.leaves, sway }, () => {
    lump(b, x + 0.37 * r * 0.75, y + r * 0.3, z - 0.93 * r * 0.75, r * 0.62, r * 0.5, r * 0.62, { seg: 7, rings: 4, normal: TONE.shade });
  });
}
