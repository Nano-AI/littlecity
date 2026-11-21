// Shape helpers for the moving things (Animation owner). Like every part,
// pure: MeshBuilder in, triangles out. See docs/swarm/ART.md for the look.

import { type Vec3 } from '@/core/mat4';
import { MIST } from '@/gen/airborne';
import { MeshBuilder } from '@/gen/mesh';
import { smoothBall } from '@/gen/soft';
import { PALETTE } from '@/style/palette';

/**
 * A ball squashed to (rx, ry, rz) about (x, y, z). Smooth both ways (src/gen/soft.ts: a lathe ball is
 * smooth only round its axis, and its rings showed as bands), so it shades in soft bands and has no creases.
 */
export function ball(b: MeshBuilder, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, segments = 10, rings = 6): void {
  smoothBall(b, x, y, z, rx, ry, rz, segments, rings);
}

/** A flat ring lying in the XZ plane at height y, facing up: inner radius r0, outer r1, from angle a0 to a1. */
export function flatRing(b: MeshBuilder, y: number, r0: number, r1: number, segments = 24, a0 = 0, a1 = Math.PI * 2): void {
  const up: Vec3 = [0, 1, 0];
  for (let i = 0; i < segments; i++) {
    const p = a0 + ((a1 - a0) * i) / segments;
    const q = a0 + ((a1 - a0) * (i + 1)) / segments;
    const cp = Math.cos(p), sp = Math.sin(p), cq = Math.cos(q), sq = Math.sin(q);
    // Counter-clockwise seen from above (+Y): angles run from +X toward −Z.
    b.quad([cp * r0, y, -sp * r0], [cp * r1, y, -sp * r1], [cq * r1, y, -sq * r1], [cq * r0, y, -sq * r0], { normals: [up, up, up, up] });
  }
}

/** The ink id of the sea's surface: a mesh drawn with it lies on the water with no pen line round it. */
export function seaInk(): number {
  return new MeshBuilder({ ink: 'terrain' }).inkOf('sea');
}

/**
 * A puff of mist, about 1 across (radius 0.5), centred on the origin: a soft ball and one lobe,
 * drawn as MIST (src/gen/airborne.ts), so it has no outline and thins away at its rim.
 * `look` turns the lobe to one of a few places. White; the page grades it.
 */
export function mistPuff(b: MeshBuilder, look: number): void {
  const a = (look % 4) * 1.7 + 0.4;
  b.setColor(PALETTE.white).setPattern(MIST).setInk('mist');
  ball(b, 0, 0, 0, 0.42, 0.36, 0.42, 9, 5);
  ball(b, Math.cos(a) * 0.24, 0.09, Math.sin(a) * 0.24, 0.27, 0.24, 0.27, 7, 4);
}

/** A thin two-sided sheet through the given outline (any plane), so it shows from both sides. */
export function twoSided(b: MeshBuilder, points: readonly Vec3[]): void {
  b.polygon(points);
  b.polygon([...points].reverse());
}
