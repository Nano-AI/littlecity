// Shape helpers for the moving things (Animation owner). Like every part,
// pure: MeshBuilder in, triangles out. See docs/swarm/ART.md for the look.

import { compose, scaling, translation, type Vec3 } from '@/core/mat4';
import { MeshBuilder } from '@/gen/mesh';

/** A ball of radius 1 as a lathe profile, `rings` steps from the bottom pole to the top. */
function ballProfile(rings: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= rings; i++) {
    const a = (i / rings) * Math.PI;
    out.push([i === 0 || i === rings ? 0 : Math.sin(a), -Math.cos(a)]);
  }
  return out;
}
const BALLS = new Map<number, [number, number][]>();

/** A ball squashed to (rx, ry, rz) about (x, y, z). Smooth, so it shades in soft bands and has no creases. */
export function ball(b: MeshBuilder, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, segments = 10, rings = 6): void {
  let profile = BALLS.get(rings);
  if (!profile) BALLS.set(rings, (profile = ballProfile(rings)));
  b.at(compose(translation(x, y, z), scaling(rx, ry, rz)), () => b.lathe(profile, { segments }));
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

/** A thin two-sided sheet through the given outline (any plane), so it shows from both sides. */
export function twoSided(b: MeshBuilder, points: readonly Vec3[]): void {
  b.polygon(points);
  b.polygon([...points].reverse());
}
