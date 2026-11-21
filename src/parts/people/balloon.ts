// A comic speech balloon (the scuffle's swearing, a chat over somebody's head): one flat rounded
// card, the balloon and its tail cut from ONE outline, so the pen draws a single smooth line round
// both with no seam where the tail joins and no facets on the curve. It is drawn in its XY plane
// facing +Z, and the people system turns it to the camera. Pure: MeshBuilder in, triangles out.

import { type Vec3 } from '@/core/mat4';
import { type MeshBuilder } from '@/gen/mesh';

export interface BalloonShape {
  /** Half width and half height of the balloon, and the height of its middle over the tail's tip (the origin). */
  rx: number;
  ry: number;
  cy: number;
  /** Half its thickness. */
  t: number;
  /** Where the tail leaves the balloon: the angles of its two roots (radians, 0 is +X, the bottom is -pi/2). */
  left?: number;
  right?: number;
  /** The tail's tip, x (y is 0), and how much it bows to one side on the way down. */
  tipX?: number;
  bow?: number;
  /** Points round the balloon's curve. */
  segments?: number;
  /** A gentle wobble of the rim, as a hand draws one (0: a clean ellipse). */
  wobble?: number;
  seed?: number;
}

/** The outline, counter-clockwise seen from +Z: round the balloon from the tail's right root to its left, then down the tail and back. */
export function balloonOutline(s: BalloonShape): [number, number][] {
  const left = s.left ?? -Math.PI / 2 - 0.32, right = s.right ?? -Math.PI / 2 + 0.06;
  const n = s.segments ?? 32;
  const tipX = s.tipX ?? -0.25 * s.rx, bow = s.bow ?? 0.12 * s.rx;
  const wob = s.wobble ?? 0, seed = s.seed ?? 0;
  const at = (a: number): [number, number] => {
    const k = 1 + wob * Math.sin(a * 3 + seed * 1.7) * Math.sin(a * 2 - seed);
    return [Math.cos(a) * s.rx * k, s.cy + Math.sin(a) * s.ry * k];
  };
  const out: [number, number][] = [];
  const span = left + Math.PI * 2 - right;
  const steps = Math.max(8, Math.round((n * span) / (Math.PI * 2)));
  for (let i = 0; i <= steps; i++) out.push(at(right + (span * i) / steps));
  // Down the tail from the left root to the tip and back up to the right root: two gentle curves
  // (quadratic, bowed the same way), so it reads as a neat tapering hook.
  const L = at(left), R = at(right), tip: [number, number] = [tipX, 0];
  const curve = (p: [number, number], q: [number, number], c: [number, number], k: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let i = 1; i < k; i++) {
      const t = i / k, u = 1 - t;
      pts.push([u * u * p[0] + 2 * u * t * c[0] + t * t * q[0], u * u * p[1] + 2 * u * t * c[1] + t * t * q[1]]);
    }
    return pts;
  };
  const midL: [number, number] = [(L[0] + tip[0]) / 2 + bow, (L[1] + tip[1]) / 2];
  const midR: [number, number] = [(R[0] + tip[0]) / 2 + bow * 1.4, (R[1] + tip[1]) / 2];
  out.push(...curve(L, tip, midL, 4), tip, ...curve(tip, R, midR, 4));
  return out;
}

/**
 * The balloon as a card: front (+Z) and back faces from the one outline, and its rim, whose normals are
 * smooth round the curve and keep a corner only at the tail's tip and roots.
 */
export function balloon(b: MeshBuilder, s: BalloonShape): void {
  const pts = balloonOutline(s);
  const t = s.t, n = pts.length;
  b.polygon(pts.map(([x, y]): Vec3 => [x, y, t]));
  b.polygon(pts.map(([x, y]): Vec3 => [x, y, -t]).reverse());
  const edgeN = (i: number): [number, number] => {
    const p = pts[i]!, q = pts[(i + 1) % n]!;
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l];
  };
  const blend = (own: [number, number], other: [number, number]): Vec3 => {
    // The normal where `own` meets `other`: blended unless the corner is sharp (the tail's tip and roots).
    if (own[0] * other[0] + own[1] * other[1] < 0.6) return [own[0], own[1], 0];
    const x = own[0] + other[0], y = own[1] + other[1], l = Math.hypot(x, y) || 1;
    return [x / l, y / l, 0];
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, p = pts[i]!, q = pts[j]!;
    const own = edgeN(i);
    const np = blend(own, edgeN((i + n - 1) % n)), nq = blend(own, edgeN(j));
    b.quad([p[0], p[1], -t], [q[0], q[1], -t], [q[0], q[1], t], [p[0], p[1], t], { normals: [np, nq, nq, np] });
  }
}

/** A flat stroke on a balloon's face: a ribbon `w` wide through `pts` (XY), at depth z, facing +Z. Crisp, one ink. */
export function stroke(b: MeshBuilder, pts: readonly (readonly [number, number])[], w: number, z: number): void {
  const n = pts.length;
  const side = (i: number): [number, number] => {
    const p = pts[Math.max(0, i - 1)]!, q = pts[Math.min(n - 1, i + 1)]!;
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
    return [(-dy / l) * (w / 2), (dx / l) * (w / 2)];
  };
  const up: Vec3 = [0, 0, 1];
  for (let i = 0; i + 1 < n; i++) {
    const p = pts[i]!, q = pts[i + 1]!, sp = side(i), sq = side(i + 1);
    b.quad([p[0] - sp[0], p[1] - sp[1], z], [q[0] - sq[0], q[1] - sq[1], z], [q[0] + sq[0], q[1] + sq[1], z], [p[0] + sp[0], p[1] + sp[1], z], { normals: [up, up, up, up] });
  }
}

/** A flat round dot on a balloon's face, facing +Z. */
export function dot(b: MeshBuilder, x: number, y: number, r: number, z: number, segments = 12): void {
  const pts: Vec3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, z]);
  }
  b.polygon(pts);
}
