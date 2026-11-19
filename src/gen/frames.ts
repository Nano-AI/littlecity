// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// Where logical positions are in the world. Rules place things by cell, side,
// slot or socket; these functions turn that into a frame (a Mat4) the same
// way for generators, the renderer, life and tests.
//
// Every frame has +Y up. For anything on a wall, +Z points out of the wall
// and +X to the viewer's right when facing the wall from outside.

import { CELL_H, DIR4, keyX, keyY, keyZ, unedge, type CellKey, type Dir4, type EdgeKey } from '@/core/grid';
import { frame, positionOf, type Mat4, type Mat4Like, type Vec3 } from '@/core/mat4';
import type { Anchor, CellPos, Feature, Socket } from '@/resolve/plan';

/** How far from the cell centre the edge and corner floor slots sit. */
export const SLOT_INSET = 0.35;

const UP: Vec3 = [0, 1, 0];

/** A frame at `origin` whose +Z points along (dx, dz) on the ground. */
export function facingFrame(origin: Vec3, dx: number, dz: number): Mat4 {
  const len = Math.hypot(dx, dz) || 1;
  const zx = dx / len;
  const zz = dz / len;
  return frame(origin, [zz, 0, -zx], UP, [zx, 0, zz]);
}

/** Centre of the cell's floor, world axes. The frame of a feature with a cell and no dir. */
export function cellFrame(cell: CellKey): Mat4 {
  return frame([keyX(cell) + 0.5, keyY(cell) * CELL_H, keyZ(cell) + 0.5], [1, 0, 0], UP, [0, 0, 1]);
}

/**
 * Bottom centre of the cell's face on side `dir`, +Z out of the face. The
 * frame of a feature with a cell and a dir. `lift` raises it (world units).
 */
export function faceFrame(cell: CellKey, dir: Dir4, lift = 0): Mat4 {
  const [dx, dz] = DIR4[dir]!;
  return facingFrame(
    [keyX(cell) + 0.5 + 0.5 * dx, keyY(cell) * CELL_H + lift, keyZ(cell) + 0.5 + 0.5 * dz],
    dx,
    dz,
  );
}

/**
 * Centre of an edge piece's boundary, on the floor. +X runs along the
 * boundary; +Z points to the cell on the far side (east for an E edge, south
 * for an S edge).
 */
export function edgeFrame(edge: EdgeKey): Mat4 {
  const { cell, side } = unedge(edge);
  return faceFrame(cell, side === 'E' ? 1 : 2);
}

const SLOT_OFFSET: Record<CellPos, readonly [number, number]> = {
  c: [0, 0],
  n: [0, -1],
  e: [1, 0],
  s: [0, 1],
  w: [-1, 0],
  ne: [1, -1],
  se: [1, 1],
  sw: [-1, 1],
  nw: [-1, -1],
};

/**
 * A floor slot of a cell: on the cell's floor, at the centre, an edge or a
 * corner. +Z faces `face` if given; otherwise toward the cell centre for edge
 * and corner slots, and south (+Z) for the centre slot.
 */
export function slotFrame(cell: CellKey, pos: CellPos, face?: Dir4): Mat4 {
  const [ox, oz] = SLOT_OFFSET[pos];
  const origin: Vec3 = [
    keyX(cell) + 0.5 + ox * SLOT_INSET,
    keyY(cell) * CELL_H,
    keyZ(cell) + 0.5 + oz * SLOT_INSET,
  ];
  if (face !== undefined) return facingFrame(origin, DIR4[face]![0], DIR4[face]![1]);
  if (pos === 'c') return facingFrame(origin, 0, 1);
  return facingFrame(origin, -ox, -oz);
}

/** The standard frame for a feature, or null when only its generator can know (region features). */
export function featureFrame(f: Pick<Feature, 'cell' | 'dir' | 'edge'>): Mat4 | null {
  if (f.cell !== undefined) return f.dir !== undefined ? faceFrame(f.cell, f.dir) : cellFrame(f.cell);
  if (f.edge !== undefined) return edgeFrame(f.edge);
  return null;
}

/**
 * Where a socket is when no part supplied its frame: half-way up the cell
 * face (with a dir), or the centre of the cell's top (without).
 */
export function socketFallbackFrame(s: Pick<Socket, 'cell' | 'dir'>): Mat4 {
  if (s.dir !== undefined) return faceFrame(s.cell, s.dir, CELL_H / 2);
  return frame([keyX(s.cell) + 0.5, (keyY(s.cell) + 1) * CELL_H, keyZ(s.cell) + 0.5], [1, 0, 0], UP, [0, 0, 1]);
}

/** Looks up the world frame of a socket by id. */
export type SocketFrames = (socketId: string) => Mat4Like | null | undefined;

export interface Placement {
  frame: Mat4;
  /** Length of the line for a { from, to } anchor; 0 otherwise. */
  span: number;
}

/**
 * The frame of an anchor. For a line it is at the `from` socket with +X
 * pointing at the `to` socket. Null if a socket it names has no frame.
 */
export function anchorFrame(at: Anchor, sockets: SocketFrames): Placement | null {
  if ('socket' in at) {
    const m = sockets(at.socket);
    return m ? { frame: Array.from(m), span: 0 } : null;
  }
  if ('from' in at) {
    const a = sockets(at.from);
    const b = sockets(at.to);
    if (!a || !b) return null;
    const p = positionOf(a);
    const q = positionOf(b);
    const d: Vec3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
    const span = Math.hypot(d[0], d[1], d[2]);
    if (span === 0) return { frame: Array.from(a), span: 0 };
    const x: Vec3 = [d[0] / span, d[1] / span, d[2] / span];
    // z = x × up, y = z × x; a vertical line falls back to world axes for z.
    let z: Vec3 = [-x[2], 0, x[0]];
    const zl = Math.hypot(z[0], z[2]);
    z = zl < 1e-6 ? [0, 0, 1] : [z[0] / zl, 0, z[2] / zl];
    const y: Vec3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return { frame: frame(p, x, y, z), span };
  }
  return { frame: slotFrame(at.cell, at.pos, at.face), span: 0 };
}
