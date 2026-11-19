// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// A minimal 4 × 4 matrix kit so pure code needs no Three.js. Layout is
// column-major, the same as THREE.Matrix4.elements, so the two interchange:
// `new THREE.Matrix4().fromArray(m)` and `matrix.elements` both work.

/** 16 numbers, column-major. Translation is at indices 12, 13, 14. */
export type Mat4Like = ArrayLike<number>;
export type Mat4 = number[];
export type Vec3 = readonly [number, number, number];

export function identity(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
export function translation(x: number, y: number, z: number): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}
export function scaling(x: number, y = x, z = x): Mat4 {
  return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
}
/** Rotation about +X by `rad` (right-handed). */
export function rotationX(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}
/** Rotation about +Y by `rad` (right-handed: +Z turns toward +X). */
export function rotationY(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}
/** Rotation about +Z by `rad` (right-handed). */
export function rotationZ(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
/** a × b: apply b first, then a. */
export function multiply(a: Mat4Like, b: Mat4Like): Mat4 {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r]! * b[c * 4]! + a[4 + r]! * b[c * 4 + 1]! + a[8 + r]! * b[c * 4 + 2]! + a[12 + r]! * b[c * 4 + 3]!;
    }
  }
  return out;
}
/** Product of several matrices, left to right (the rightmost applies first). */
export function compose(...ms: Mat4Like[]): Mat4 {
  let out: Mat4 = identity();
  for (const m of ms) out = multiply(out, m);
  return out;
}
/** A frame from an origin and three axes (the columns). */
export function frame(origin: Vec3, xAxis: Vec3, yAxis: Vec3, zAxis: Vec3): Mat4 {
  return [
    xAxis[0], xAxis[1], xAxis[2], 0,
    yAxis[0], yAxis[1], yAxis[2], 0,
    zAxis[0], zAxis[1], zAxis[2], 0,
    origin[0], origin[1], origin[2], 1,
  ];
}
export function transformPoint(m: Mat4Like, p: Vec3): [number, number, number] {
  return [
    m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!,
    m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!,
    m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!,
  ];
}
/** Transforms a direction (ignores translation). Does not renormalise. */
export function transformDir(m: Mat4Like, d: Vec3): [number, number, number] {
  return [
    m[0]! * d[0] + m[4]! * d[1] + m[8]! * d[2],
    m[1]! * d[0] + m[5]! * d[1] + m[9]! * d[2],
    m[2]! * d[0] + m[6]! * d[1] + m[10]! * d[2],
  ];
}
export function positionOf(m: Mat4Like): [number, number, number] {
  return [m[12]!, m[13]!, m[14]!];
}
/** Determinant of the upper-left 3 × 3 (negative means the matrix mirrors). */
export function det3(m: Mat4Like): number {
  return (
    m[0]! * (m[5]! * m[10]! - m[9]! * m[6]!) -
    m[4]! * (m[1]! * m[10]! - m[9]! * m[2]!) +
    m[8]! * (m[1]! * m[6]! - m[5]! * m[2]!)
  );
}
/** Inverse of an affine matrix (rotation, scale, shear, translation). */
export function invertAffine(m: Mat4Like): Mat4 {
  const a = m[0]!, b = m[1]!, c = m[2]!;
  const d = m[4]!, e = m[5]!, f = m[6]!;
  const g = m[8]!, h = m[9]!, i = m[10]!;
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  if (det === 0) throw new Error('invertAffine: singular matrix');
  const s = 1 / det;
  const r0 = (e * i - f * h) * s, r1 = (c * h - b * i) * s, r2 = (b * f - c * e) * s;
  const r4 = (f * g - d * i) * s, r5 = (a * i - c * g) * s, r6 = (c * d - a * f) * s;
  const r8 = (d * h - e * g) * s, r9 = (b * g - a * h) * s, r10 = (a * e - b * d) * s;
  const tx = m[12]!, ty = m[13]!, tz = m[14]!;
  return [
    r0, r1, r2, 0,
    r4, r5, r6, 0,
    r8, r9, r10, 0,
    -(r0 * tx + r4 * ty + r8 * tz), -(r1 * tx + r5 * ty + r9 * tz), -(r2 * tx + r6 * ty + r10 * tz), 1,
  ];
}
