// Shared helpers for discovery round 1 (docs/swarm/discovery/round-1.md).
// Not a scenario: the runner only picks up *.scenario.ts.

import { key } from '@/core/grid';
import type { CameraSpec, TownBuilder } from '@/scenario';

/** The four quarters at playing distance, and the same at dusk. */
export function quarters(target: [number, number, number], zoom = 1.7): CameraSpec[] {
  return [
    { name: 'q-se', yaw: 45, pitch: 35, zoom, target },
    { name: 'q-ne', yaw: 135, pitch: 35, zoom, target },
    { name: 'q-nw', yaw: 225, pitch: 35, zoom, target },
    { name: 'q-sw', yaw: 315, pitch: 35, zoom, target },
    { name: 'dusk-se', yaw: 45, pitch: 35, zoom, target, time: 'dusk' },
    { name: 'dusk-nw', yaw: 225, pitch: 35, zoom, target, time: 'dusk' },
  ];
}

/** A close-up camera. */
export function close(name: string, x: number, y: number, z: number, yaw = 45, zoom = 4.5, pitch = 30): CameraSpec {
  return { name, yaw, pitch, zoom, target: [x + 0.5, y, z + 0.5] };
}

/** A path through the given corners (x first, then z on each leg), skipping cells that already hold a floor. */
export function road(b: TownBuilder, ...points: (readonly [number, number])[]): void {
  let [x, z] = points[0]!;
  const lay = (): void => {
    if (!b.world.floors.has(key(x, b.floorLevel(x, z), z))) b.path(x, z);
  };
  lay();
  for (const [tx, tz] of points.slice(1)) {
    while (x !== tx) {
      x += Math.sign(tx - x);
      lay();
    }
    while (z !== tz) {
      z += Math.sign(tz - z);
      lay();
    }
  }
}

/** A small deterministic random source for "clicked without a plan" towns. */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
