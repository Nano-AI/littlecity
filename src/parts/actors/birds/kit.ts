// Shared drawing for the birds (Animation owner). A bird is three instances:
// a body (the actor's own mesh) and two wings ('bird-wing', spawned by the
// behaviour) that turn about the shoulder so they can beat.
//
// Frames. A body is built facing +Z with its feet at the origin, so the same
// mesh stands on a perch and flies. Facing +Z with +Y up, the bird's LEFT is
// +X. A wing is built with its root at the origin, reaching out along
// side × X (side +1 = left, −1 = right), leading edge toward +Z, lying flat;
// the behaviour places it at the shoulder and rolls it about Z.
//
// Sizes are "nominal": each species is drawn at one fixed size here and the
// part scales it to the style's size, so SHAPES also tells the behaviours
// where the shoulders are.

import type { Vec3 } from '@/core/mat4';
import { parseColor, type MeshBuilder } from '@/gen/mesh';
import { BIRDS } from '@/style/birds';
import { PALETTE } from '@/style/palette';

export type Species = 'gull' | 'pigeon' | 'swift';
export type Rgb = [number, number, number];

/** A colour between two palette colours. */
export function mix(a: string, b: string, t: number): Rgb {
  const [ar, ag, ab] = parseColor(a);
  const [br, bg, bb] = parseColor(b);
  return [Math.round(ar + (br - ar) * t), Math.round(ag + (bg - ag) * t), Math.round(ab + (bb - ab) * t)];
}

/** The birds' own colours, all mixed from the palette (read inside build, so a palette change redraws them). */
export function birdColors() {
  return {
    gullGrey: mix(PALETTE.metal, PALETTE.white, 0.78),
    gullTip: mix(PALETTE.metal, PALETTE.ink, 0.3),
    pigeon: mix(PALETTE.metal, PALETTE.shallow, 0.78),
    pigeonLight: mix(PALETTE.metal, PALETTE.white, 0.74),
    pigeonDark: mix(PALETTE.metal, PALETTE.glass, 0.35),
    pigeonNeck: mix(PALETTE.magic, PALETTE.leafDark, 0.35),
    swift: mix(PALETTE.metal, PALETTE.trunk, 0.22),
    swiftPale: mix(PALETTE.metal, PALETTE.white, 0.7),
  };
}

interface Shape {
  /** Body length the mesh is drawn at; the part scales it to the style's size. */
  length: number;
  /** Wing length the wing mesh is drawn at. */
  wing: number;
  /** The left shoulder in the body's frame, at the drawn size (the right one mirrors x). */
  shoulder: Vec3;
}
export const SHAPES: Record<Species, Shape> = {
  gull: { length: 0.3, wing: 0.27, shoulder: [0.026, 0.086, 0.004] },
  pigeon: { length: 0.2, wing: 0.17, shoulder: [0.03, 0.094, 0.004] },
  swift: { length: 0.16, wing: 0.2, shoulder: [0.013, 0.03, 0.022] },
};

/** How much bigger than drawn a species' body and wings are now. */
export function bodyScale(species: Species): number {
  const size = species === 'gull' ? BIRDS.gullSize : species === 'pigeon' ? BIRDS.pigeonSize : BIRDS.swiftSize;
  return size / SHAPES[species].length;
}
export function wingScale(species: Species): number {
  const size = species === 'gull' ? BIRDS.gullWing : species === 'pigeon' ? BIRDS.pigeonWing : BIRDS.swiftWing;
  return size / SHAPES[species].wing;
}
/** The left shoulder in the body's frame at the style's size. */
export function shoulderOf(species: Species): Vec3 {
  const s = bodyScale(species), p = SHAPES[species].shoulder;
  return [p[0] * s, p[1] * s, p[2] * s];
}

/** A flat four-cornered sheet seen from both sides (each side its own face, so each is shaded as it lies). */
export function sheet(b: MeshBuilder, p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): void {
  b.polygon([p0, p1, p2, p3]);
  b.polygon([p3, p2, p1, p0]);
}

/** One station across a wing: how far out, where its leading and trailing edges are, how high. */
export type Station = readonly [x: number, lead: number, trail: number, y: number];

/** A wing as panels between stations, root to tip, on side +1 (left, along +X) or −1. `colors[i]` paints panel i. */
export function wingPanels(b: MeshBuilder, side: number, stations: readonly Station[], colors: readonly (Rgb | string)[]): void {
  for (let i = 0; i + 1 < stations.length; i++) {
    const [x0, l0, t0, y0] = stations[i]!;
    const [x1, l1, t1, y1] = stations[i + 1]!;
    b.setColor(colors[Math.min(i, colors.length - 1)]!);
    sheet(b, [side * x0, y0, t0], [side * x0, y0, l0], [side * x1, y1, l1], [side * x1, y1, t1]);
  }
}
