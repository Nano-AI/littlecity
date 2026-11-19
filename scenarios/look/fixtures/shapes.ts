// LOOK FIXTURE. Small shape helpers shared by the look-test generators.
// (The idioms are written up in docs/swarm/ART.md.)

import { compose, scaling, translation } from '@/core/mat4';
import type { MeshBuilder } from '@/gen/mesh';

/** A ball of radius 1 about the origin as a lathe profile: `rings` steps from the bottom pole to the top. */
function ballProfile(rings: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= rings; i++) {
    const a = (i / rings) * Math.PI;
    out.push([i === 0 || i === rings ? 0 : Math.sin(a), -Math.cos(a)]);
  }
  return out;
}
const BALL = ballProfile(8);
const SMALL_BALL = ballProfile(4);

/** A blob: a ball squashed to (rx, ry, rz), centred on (x, y, z). Smooth, so it shades in soft bands. */
export function blob(b: MeshBuilder, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, segments = 14): void {
  b.at(compose(translation(x, y, z), scaling(rx, ry, rz)), () => b.lathe(segments <= 6 ? SMALL_BALL : BALL, { segments }));
}

/** A flower head or door knob: a tiny low-poly ball. */
export function bead(b: MeshBuilder, x: number, y: number, z: number, r: number): void {
  blob(b, x, y, z, r, r, r, 6);
}
