// The fly camera's maths (fly mode, design section 7). Pure: no Three.js, no DOM.
//
// A perspective eye, used instead of the orbit camera while someone flies the
// town. The ink, the patterns and the paper sky read depth as a straight
// distance along the view (written per fragment, shaders/surface.ts), so the
// near plane can sit at arm's length of a little person without costing the
// far town its depth precision.

import { SIZE_X, SIZE_Z } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import type { CameraPose, EyePose } from './api';
import { clampPose, frameOf } from './camera';

/** Closer than this nothing is drawn: well inside a wall at arm's length (a person is 0.46 tall). */
export const EYE_NEAR = 0.012;
/**
 * Everything drawn lies within this many units of the map's centre: the whole map, the slab and the
 * clouds. The far plane is that much past the centre, wherever the eye is; and an eye farther off
 * than this (a drone pulling back for a dolly zoom) moves its near plane out to the nearest of it,
 * which keeps the depth buffer as fine across the town at 3000 units as at arm's length.
 */
export const EYE_REACH = 150;
/** The narrowest and widest field of view (degrees, vertical). */
export const FOV_MIN = 0.5;
export const FOV_MAX = 120;
/**
 * Below this field of view (degrees) the perspective picture has all but converged on the orbit
 * camera's, and the page behind the town turns from the flyer's sky into the builder's paper,
 * fully so at FLAT_FOV / 4 (EyeFrame.flat).
 */
export const FLAT_FOV = 12;

const DEG = Math.PI / 180;

export interface EyeFrame {
  eye: Vec3;
  /** Unit vectors: screen right, screen up, the way the eye looks. */
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  /** tan of the half field of view, across and up. */
  tanX: number;
  tanY: number;
  near: number;
  far: number;
  /** CSS pixels per world unit at a distance of one unit (divide by the distance). */
  focal: number;
  /**
   * 0 to 1: how far the page behind the town has turned from the flyer's sky (horizon, far sea,
   * stars fixed to the sky) into the builder's paper (the slab's shadow, stars fixed to the page),
   * by the field of view (FLAT_FOV), so a dolly zoom out to the orbit camera ends on its page.
   */
  flat: number;
}

export function eyeFrame(pose: EyePose, width: number, height: number): EyeFrame {
  const yaw = pose.yaw * DEG;
  const pitch = Math.max(-89, Math.min(89, pose.pitch)) * DEG;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const forward: Vec3 = [-sy * cp, sp, -cy * cp];
  const right: Vec3 = [cy, 0, -sy];
  // up = right × forward
  const up: Vec3 = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]];
  const fov = Math.max(FOV_MIN, Math.min(FOV_MAX, pose.fov));
  const tanY = Math.tan((fov * DEG) / 2);
  const aspect = width / Math.max(1, height);
  const eye: Vec3 = [pose.eye[0], pose.eye[1], pose.eye[2]];
  const toMid = Math.hypot(eye[0] - SIZE_X / 2, eye[1], eye[2] - SIZE_Z / 2);
  const t = Math.min(1, Math.max(0, (FLAT_FOV - fov) / (FLAT_FOV * 0.75)));
  const tanX = tanY * aspect;
  // Depth is measured along the view: in a corner of the picture a point is nearer along it than it
  // is from the eye, by the cosine of the corner's angle.
  const corner = Math.sqrt(1 + tanX * tanX + tanY * tanY);
  return {
    eye,
    right,
    up,
    forward,
    tanX,
    tanY,
    near: Math.max(EYE_NEAR, (toMid - EYE_REACH) / corner),
    far: toMid + EYE_REACH,
    focal: height / 2 / tanY,
    flat: t * t * (3 - 2 * t),
  };
}

/**
 * The perspective eye that frames the scene as the orbit camera `cam` does, with a vertical field of
 * view of `fov` degrees, for a canvas of width × height CSS pixels: the start (or end) of a dolly zoom
 * between fly mode and the builder's view.
 *
 * How the orbit camera maps (camera.ts, frameOf): it is orthographic, looking along
 *   forward = −(cos p · sin y, sin p, cos p · cos y)      (y = yaw, p = pitch, degrees → radians)
 * at target (x, level × CELL_H, z), and shows a slab of the world SIZE_Z / zoom units tall (half
 * height halfH = 24 / zoom), whatever the canvas, and halfH × width / height across.
 * A perspective eye with the same yaw, the pitch negated (EyePose's pitch is above the horizon, the
 * orbit camera's below it) has the same forward, right and up vectors. Standing back from the target
 * along −forward by d = halfH / tan(fov / 2), its view of the plane through the target square to the
 * view is exactly the orbit camera's; a point off that plane by δ along the view lands (d / (d + δ))
 * times as far from the centre, so the narrower the field of view (the farther the eye), the closer
 * the two pictures. At fov 1° the eye is about 2750 / zoom units off, and at zoom 1 the island (some
 * ±35 units deep along the view) lands within about 1.3 % of where the orbit camera draws it. The pose is clamped as the view
 * clamps it (setCamera), so this matches what the orbit camera would actually show.
 */
export function eyeMatchingOrbit(cam: CameraPose, fov: number, width: number, height: number): EyePose {
  const pose = clampPose(cam, width / Math.max(1, height));
  const f = frameOf(pose, width, height);
  const fv = Math.max(FOV_MIN, Math.min(FOV_MAX, fov));
  const d = f.halfH / Math.tan((fv * DEG) / 2);
  return {
    eye: [f.target[0] - f.forward[0] * d, f.target[1] - f.forward[1] * d, f.target[2] - f.forward[2] * d],
    yaw: pose.yaw,
    pitch: -pose.pitch,
    fov: fv,
  };
}

/** CSS pixel position of a world point (and its distance along the view; behind the eye if ≤ 0). */
export function eyeProject(f: EyeFrame, p: Vec3, width: number, height: number): [number, number, number] {
  const d: Vec3 = [p[0] - f.eye[0], p[1] - f.eye[1], p[2] - f.eye[2]];
  const z = d[0] * f.forward[0] + d[1] * f.forward[1] + d[2] * f.forward[2];
  const x = d[0] * f.right[0] + d[1] * f.right[1] + d[2] * f.right[2];
  const y = d[0] * f.up[0] + d[1] * f.up[1] + d[2] * f.up[2];
  const w = Math.max(1e-6, z);
  return [((x / (w * f.tanX) + 1) / 2) * width, ((1 - y / (w * f.tanY)) / 2) * height, z];
}

/** The world ray under a CSS pixel. */
export function eyeRay(f: EyeFrame, x: number, y: number, width: number, height: number): { origin: Vec3; dir: Vec3 } {
  const a = ((x / width) * 2 - 1) * f.tanX;
  const b = (1 - (y / height) * 2) * f.tanY;
  const d: Vec3 = [f.forward[0] + f.right[0] * a + f.up[0] * b, f.forward[1] + f.right[1] * a + f.up[1] * b, f.forward[2] + f.right[2] * a + f.up[2] * b];
  const len = Math.hypot(d[0], d[1], d[2]);
  return { origin: f.eye, dir: [d[0] / len, d[1] / len, d[2] / len] };
}
