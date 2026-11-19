// A stamp's local frame: (u, v) in the stamp, turned a quarter `r` times
// and moved to (ox, oz) on the map. Local north (−v) turns with it, so a
// stamp written facing one way can be laid facing any way.

import { SIZE_X, SIZE_Z, type Dir4 } from '@/core/grid';
import type { Grower } from './grower';

export class Frame {
  constructor(
    readonly ox: number,
    readonly oz: number,
    readonly r: 0 | 1 | 2 | 3,
  ) {}
  x(u: number, v: number): number {
    switch (this.r) {
      case 0:
        return this.ox + u;
      case 1:
        return this.ox - v;
      case 2:
        return this.ox - u;
      default:
        return this.ox + v;
    }
  }
  z(u: number, v: number): number {
    switch (this.r) {
      case 0:
        return this.oz + v;
      case 1:
        return this.oz + u;
      case 2:
        return this.oz - v;
      default:
        return this.oz - u;
    }
  }
  at(u: number, v: number): [number, number] {
    return [this.x(u, v), this.z(u, v)];
  }
  /** A local direction (0 = −v, 1 = +u, 2 = +v, 3 = −u) on the map. */
  dir(d: Dir4): Dir4 {
    return ((d + this.r) & 3) as Dir4;
  }
}

export interface Found<T> {
  frame: Frame;
  score: number;
  data: T;
}

/**
 * Tries the stamp at every position and turn; `fit` returns null where it
 * does not fit, else a score (lower is better) and whatever it worked out.
 * Ties go by seeded chance, so different seeds lay out differently.
 */
export function search<T>(
  g: Grower,
  name: string,
  fit: (f: Frame) => { score: number; data: T } | null,
  opts: { turns?: readonly (0 | 1 | 2 | 3)[]; step?: number } = {},
): Found<T> | null {
  let best: Found<T> | null = null;
  const turns = opts.turns ?? [0, 1, 2, 3];
  const step = opts.step ?? 1;
  for (let oz = 0; oz < SIZE_Z; oz += step) {
    for (let ox = 0; ox < SIZE_X; ox += step) {
      for (const r of turns) {
        const f = new Frame(ox, oz, r);
        const got = fit(f);
        if (!got) continue;
        const score = got.score + g.rand(name, ox, oz, r) * 0.5;
        if (!best || score < best.score) best = { frame: f, score, data: got.data };
      }
    }
  }
  return best;
}
