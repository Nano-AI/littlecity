// The shape of a flying buttress that hangs from its anchor with no pier
// (R-A03, a hanging run of one or two cells): a raking half arch. Its top
// falls away from the anchor, it is deep at the wall and thin at the tip,
// and its underside is one concave sweep. Heights are measured from the foot
// of the arch cells; `g` is the distance from the anchor in cells, `len` the
// length of the run.

import { CELL_H } from '@/core/grid';

export interface Rake {
  /** Distance from the anchor, in cells, at this cell's u = 0. */
  from: number;
  /** +1 if u runs away from the anchor, −1 if toward it. */
  dir: 1 | -1;
  len: number;
}

export function rakeAt(g: number, len: number): { top: number; bottom: number } {
  const t = Math.min(Math.max(g / len, 0), 1);
  const fall = len >= 2 ? 0.95 : 0.5;
  const deep = len >= 2 ? 0.95 : 0.6;
  const top = CELL_H - fall * t;
  return { top, bottom: top - (0.14 + deep * Math.pow(1 - t, 1.6)) };
}
