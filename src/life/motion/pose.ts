// Posing helpers: the handful of matrices motion code builds every frame,
// written straight into a result with no intermediate arrays. Same layout
// and conventions as src/core/mat4.ts (column-major, right-handed, a yaw of
// θ turns +Z toward +X, so something built facing +Z heads along
// (sin θ, cos θ) on the ground: yaw = Math.atan2(dx, dz)).
//
// Every function returns a fresh array unless given `out`. Pass `out` only
// for a matrix handed to InstanceHandle.setMatrix at once (the stage copies it).

import type { Mat4, Mat4Like } from '@/core/mat4';

/** a × b into `out` (which may be neither a nor b). */
export function mulInto(out: Mat4, a: Mat4Like, b: Mat4Like): Mat4 {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4]!, b1 = b[c * 4 + 1]!, b2 = b[c * 4 + 2]!, b3 = b[c * 4 + 3]!;
    out[c * 4] = a[0]! * b0 + a[4]! * b1 + a[8]! * b2 + a[12]! * b3;
    out[c * 4 + 1] = a[1]! * b0 + a[5]! * b1 + a[9]! * b2 + a[13]! * b3;
    out[c * 4 + 2] = a[2]! * b0 + a[6]! * b1 + a[10]! * b2 + a[14]! * b3;
    out[c * 4 + 3] = a[3]! * b0 + a[7]! * b1 + a[11]! * b2 + a[15]! * b3;
  }
  return out;
}

/** Translate to (x, y, z), turn by `yaw` about the vertical, then scale: where a thing stands and which way it heads. */
export function place(x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, out: Mat4 = new Array<number>(16)): Mat4 {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  out[0] = c * sx; out[1] = 0; out[2] = -s * sx; out[3] = 0;
  out[4] = 0; out[5] = sy; out[6] = 0; out[7] = 0;
  out[8] = s * sz; out[9] = 0; out[10] = c * sz; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}

/**
 * The full pose of a flying or floating thing: at (x, y, z), heading `yaw`, nose up by `pitch`, rolled
 * by `roll` about its length (+Z), scaled. Order: T · Ry(yaw) · Rx(−pitch) · Rz(roll) · S.
 */
export function fly(x: number, y: number, z: number, yaw: number, pitch = 0, roll = 0, scale = 1, out: Mat4 = new Array<number>(16)): Mat4 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(-pitch), sp = Math.sin(-pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // Ry · Rx
  const m00 = cy, m01 = 0, m02 = -sy;
  const m10 = sy * sp, m11 = cp, m12 = cy * sp;
  const m20 = sy * cp, m21 = -sp, m22 = cy * cp;
  // · Rz
  out[0] = (m00 * cr + m10 * sr) * scale; out[1] = (m01 * cr + m11 * sr) * scale; out[2] = (m02 * cr + m12 * sr) * scale; out[3] = 0;
  out[4] = (-m00 * sr + m10 * cr) * scale; out[5] = (-m01 * sr + m11 * cr) * scale; out[6] = (-m02 * sr + m12 * cr) * scale; out[7] = 0;
  out[8] = m20 * scale; out[9] = m21 * scale; out[10] = m22 * scale; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}

/**
 * Squash and stretch about a point on the ground: scale by (sx, sy, sz) about (px, py, pz), tip by
 * `tiltX` and `tiltZ` (radians about the X and Z axes through the pivot), then lift by `dy`. What a
 * landing, a wobble and a pop-in all are. Small angles only: the tilts are applied as a shear-free
 * rotation Rz · Rx.
 */
export function squash(px: number, py: number, pz: number, sx: number, sy: number, sz: number, dy = 0, tiltX = 0, tiltZ = 0, out: Mat4 = new Array<number>(16)): Mat4 {
  const cx = Math.cos(tiltX), sxn = Math.sin(tiltX);
  const cz = Math.cos(tiltZ), szn = Math.sin(tiltZ);
  // R = Rz(tiltZ) · Rx(tiltX), columns scaled by (sx, sy, sz)
  const r00 = cz, r10 = szn, r20 = 0;
  const r01 = -szn * cx, r11 = cz * cx, r21 = sxn;
  const r02 = szn * sxn, r12 = -cz * sxn, r22 = cx;
  out[0] = r00 * sx; out[1] = r10 * sx; out[2] = r20 * sx; out[3] = 0;
  out[4] = r01 * sy; out[5] = r11 * sy; out[6] = r21 * sy; out[7] = 0;
  out[8] = r02 * sz; out[9] = r12 * sz; out[10] = r22 * sz; out[11] = 0;
  // T(p + dy) · R·S · T(−p)
  out[12] = px - (out[0]! * px + out[4]! * py + out[8]! * pz);
  out[13] = py + dy - (out[1]! * px + out[5]! * py + out[9]! * pz);
  out[14] = pz - (out[2]! * px + out[6]! * py + out[10]! * pz);
  out[15] = 1;
  return out;
}

/** The heading (yaw) of a frame's +Z axis on the ground. */
export function yawOf(m: Mat4Like): number {
  return Math.atan2(m[8]!, m[10]!);
}
