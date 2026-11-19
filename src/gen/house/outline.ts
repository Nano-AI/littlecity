// The outline of a set of cells on one level, edge by edge (Houses owner).
//
// A merged house is drawn from its outline, not from boxes: every exposed
// cell side is one WallEdge, and each end of an edge knows how the outline
// turns there. From that, a wall, a plinth, a trim band or a parapet at ANY
// distance inside or outside the cell line can be emitted with mitred
// corners and no gaps, overlaps or doubled faces:
//
//     +1  convex   the outline turns away: an inset shortens the edge
//      0  straight the next cell continues the wall
//     −1  concave  the outline turns toward us: an inset lengthens the edge
//
// Everything is emitted in the edge's face frame (src/gen/frames.ts): origin
// at the bottom centre of the cell face, +X to the viewer's right, +Y up,
// +Z out of the wall.

import { neighbor, NO_CELL, turn, type CellKey, type Dir4 } from '@/core/grid';
import type { MeshBuilder } from '@/gen/mesh';

export type Turn = -1 | 0 | 1;

export interface WallEdge {
  cell: CellKey;
  dir: Dir4;
  /** How the outline turns at the viewer's left and right end. */
  left: Turn;
  right: Turn;
}

/** The side to the viewer's left / right when facing side `d` of a cell from outside. */
export const leftOf = (d: Dir4): Dir4 => turn(d, 1);
export const rightOf = (d: Dir4): Dir4 => turn(d, -1);

function endTurn(has: (c: CellKey) => boolean, cell: CellKey, dir: Dir4, lateral: Dir4): Turn {
  const n = neighbor(cell, lateral);
  if (n === NO_CELL || !has(n)) return 1;
  const diag = neighbor(n, dir);
  return diag !== NO_CELL && has(diag) ? -1 : 0;
}

/** The edge on side `dir` of `cell`, given which cells belong to the outline's set. */
export function wallEdge(has: (c: CellKey) => boolean, cell: CellKey, dir: Dir4): WallEdge {
  return { cell, dir, left: endTurn(has, cell, dir, leftOf(dir)), right: endTurn(has, cell, dir, rightOf(dir)) };
}

/** Every exposed side of every cell, in cell then side order. */
export function outlineEdges(cells: readonly CellKey[], has: (c: CellKey) => boolean): WallEdge[] {
  const out: WallEdge[] = [];
  for (const cell of cells) {
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const n = neighbor(cell, d);
      if (n !== NO_CELL && has(n)) continue;
      out.push(wallEdge(has, cell, d));
    }
  }
  return out;
}

/** The x of an edge's left and right end for a surface `inset` inside the cell line (negative = outside). */
export const leftX = (e: WallEdge, inset: number): number => -0.5 + inset * e.left;
export const rightX = (e: WallEdge, inset: number): number => 0.5 - inset * e.right;

/** A flat wall face at `inset`, from y0 to y1, facing out. (In the edge's face frame.) */
export function wallFace(b: MeshBuilder, e: WallEdge, inset: number, y0: number, y1: number): void {
  const xl = leftX(e, inset), xr = rightX(e, inset);
  b.quad([xl, y0, -inset], [xr, y0, -inset], [xr, y1, -inset], [xl, y1, -inset]);
}

export interface BandOptions {
  /** Leave out the top face (something sits on it). */
  noTop?: boolean;
  /** Also draw the face looking back into the building (parapets). */
  inner?: boolean;
  /** Close the left / right end with a face (the band stops here instead of turning the corner). */
  capLeft?: boolean;
  capRight?: boolean;
  /** Use these ends instead of the edge's own (a band that stops short). */
  left?: Turn;
  right?: Turn;
}

/**
 * A band along the edge: its outer face at `outer` inside the cell line, its
 * back at `back` (further in), from y0 to y1, with a top. Corners are mitred
 * so the bands of neighbouring edges meet exactly.
 */
export function band(b: MeshBuilder, edge: WallEdge, outer: number, back: number, y0: number, y1: number, o: BandOptions = {}): void {
  const e: WallEdge = { ...edge, left: o.left ?? edge.left, right: o.right ?? edge.right };
  const xl = leftX(e, outer), xr = rightX(e, outer);
  const bl = leftX(e, back), br = rightX(e, back);
  b.quad([xl, y0, -outer], [xr, y0, -outer], [xr, y1, -outer], [xl, y1, -outer]);
  if (!o.noTop) b.quad([xl, y1, -outer], [xr, y1, -outer], [br, y1, -back], [bl, y1, -back]);
  if (o.inner) b.quad([br, y0, -back], [bl, y0, -back], [bl, y1, -back], [br, y1, -back]);
  if (o.capLeft) b.quad([bl, y0, -back], [xl, y0, -outer], [xl, y1, -outer], [bl, y1, -back]);
  if (o.capRight) b.quad([xr, y0, -outer], [br, y0, -back], [br, y1, -back], [xr, y1, -outer]);
}
