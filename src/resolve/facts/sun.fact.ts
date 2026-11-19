// The sunny side: which side faces the fixed light direction.

import { DIR4, type Dir4 } from '@/core/grid';
import { FACTS } from '@/style/facts';
import { defineFact } from './api';

export interface SunnySide {
  /** The light direction in the ground plane, [x, z]. */
  light: readonly [number, number];
  /** Sides whose outward normal points toward the light (dot > 0); with the default light, E and S. */
  faces: readonly Dir4[];
  /** The one side that faces the light most squarely (S by default). */
  best: Dir4;
  isSunny(d: Dir4): boolean;
}

export const sunnySide = defineFact<SunnySide>('sunnySide', () => {
  const [lx, lz] = FACTS.sun;
  const dots = DIR4.map(([dx, dz]) => dx * lx + dz * lz);
  const faces = ([0, 1, 2, 3] as Dir4[]).filter((d) => dots[d]! > 0);
  let best: Dir4 = 0;
  for (const d of [1, 2, 3] as Dir4[]) if (dots[d]! > dots[best]!) best = d;
  const set = new Set(faces);
  return { light: [lx, lz], faces, best, isSunny: (d) => set.has(d) };
});
