// The camera's maths (Look, Stage 1). Pure: no Three.js, no DOM, so it is
// unit-tested in Node. The view (index.ts) holds two poses, the GOAL the UI
// steers and the SHOWN pose that eases toward it, and builds its projection
// from `frameOf(shown)`.
//
// The camera is orthographic. It looks at `target` from the direction given
// by yaw and pitch; zoom 1 fits the 48-column map in the view's height.

import { CELL_H, SIZE_X, SIZE_Y, SIZE_Z } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import type { CameraPose } from './api';

export const PITCH_MIN = 10;
export const PITCH_MAX = 85;
export const ZOOM_MAX = 14;
/** How far the camera sits from its target. Only the clip planes depend on it. */
export const CAMERA_DISTANCE = 200;
/**
 * The clip planes keep to what can be drawn: anything within 130 units of the target. From any legal
 * target that is the whole map, the paper under it and the clouds drifting in from off the page
 * (camera.test.ts checks it). The tighter the range, the finer the depth buffer's steps; the coplanar
 * tie-break in the surface shader is counted in those steps (index.ts, Z_STEP).
 */
export const CAMERA_NEAR = CAMERA_DISTANCE - 130;
export const CAMERA_FAR = CAMERA_DISTANCE + 130;
/** The target may leave the map by this many columns, so the slab's edge can be centred. */
const TARGET_MARGIN = 3;
/** Higher is snappier. The shown pose covers 1 − e^(−RATE × dt) of the gap each frame. */
const EASE_RATE = 14;

const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * The widest view allowed: far enough out that the whole island (the map's
 * diagonal) fits whichever way the view is turned, on any aspect ratio.
 */
export function zoomMin(aspect: number): number {
  return clamp(aspect * 0.62, 0.22, 0.7);
}

/** A legal pose: pitch 10–85 (never from under the island), zoom and target in range. */
export function clampPose(p: CameraPose, aspect: number): CameraPose {
  return {
    yaw: p.yaw,
    pitch: clamp(p.pitch, PITCH_MIN, PITCH_MAX),
    zoom: clamp(p.zoom, zoomMin(aspect), ZOOM_MAX),
    target: [
      clamp(p.target[0], -TARGET_MARGIN, SIZE_X + TARGET_MARGIN),
      clamp(p.target[1], 0, SIZE_Y),
      clamp(p.target[2], -TARGET_MARGIN, SIZE_Z + TARGET_MARGIN),
    ],
  };
}

/** Everything the projection needs, in world units. */
export interface CameraFrame {
  /** The looked-at point. */
  target: Vec3;
  /** Unit vectors: screen right, screen up, and the direction the camera looks. */
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  /** Camera position. */
  eye: Vec3;
  /** Half the view's size in world units. */
  halfW: number;
  halfH: number;
}

export function frameOf(pose: CameraPose, width: number, height: number): CameraFrame {
  const yaw = pose.yaw * DEG;
  const pitch = pose.pitch * DEG;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  // From the target toward the camera.
  const back: Vec3 = [cp * sy, sp, cp * cy];
  const target: Vec3 = [pose.target[0], pose.target[1] * CELL_H, pose.target[2]];
  const halfH = SIZE_Z / 2 / pose.zoom;
  return {
    target,
    right: [cy, 0, -sy],
    up: [-sp * sy, cp, -sp * cy],
    forward: [-back[0], -back[1], -back[2]],
    eye: [target[0] + back[0] * CAMERA_DISTANCE, target[1] + back[1] * CAMERA_DISTANCE, target[2] + back[2] * CAMERA_DISTANCE],
    halfW: halfH * (width / Math.max(1, height)),
    halfH,
  };
}

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** CSS pixel position of a world point. */
export function project(f: CameraFrame, p: Vec3, width: number, height: number): [number, number] {
  const d: Vec3 = [p[0] - f.target[0], p[1] - f.target[1], p[2] - f.target[2]];
  return [((dot(d, f.right) / f.halfW + 1) / 2) * width, ((1 - dot(d, f.up) / f.halfH) / 2) * height];
}

/** The world ray under a CSS pixel. It starts on the camera's plane, in front of everything. */
export function rayAt(f: CameraFrame, x: number, y: number, width: number, height: number): { origin: Vec3; dir: Vec3 } {
  const a = ((x / width) * 2 - 1) * f.halfW;
  const b = (1 - (y / height) * 2) * f.halfH;
  return {
    origin: [f.eye[0] + f.right[0] * a + f.up[0] * b, f.eye[1] + f.right[1] * a + f.up[1] * b, f.eye[2] + f.right[2] * a + f.up[2] * b],
    dir: f.forward,
  };
}

/**
 * World units along the ground (right, and "into the screen") for a screen
 * offset in world units. A vertical screen offset is stretched by 1 / sin(pitch),
 * so the ground under the pointer follows the pointer.
 */
function groundOffset(f: CameraFrame, pitchDeg: number, a: number, b: number): [number, number] {
  const len = Math.hypot(f.up[0], f.up[2]) || 1;
  const stretch = 1 / Math.max(0.17, Math.sin(pitchDeg * DEG));
  return [f.right[0] * a + (f.up[0] / len) * b * stretch, f.right[2] * a + (f.up[2] / len) * b * stretch];
}

/** Slides the target along the ground so the picture moves by (dx, dy) CSS pixels. */
export function panPose(pose: CameraPose, dx: number, dy: number, width: number, height: number): CameraPose {
  const f = frameOf(pose, width, height);
  const perPixel = (f.halfH * 2) / Math.max(1, height);
  const [mx, mz] = groundOffset(f, pose.pitch, -dx * perPixel, dy * perPixel);
  return clampPose({ ...pose, target: [pose.target[0] + mx, pose.target[1], pose.target[2] + mz] }, width / Math.max(1, height));
}

/** Multiplies zoom. With (x, y), the ground point under that CSS pixel stays under it. */
export function zoomPose(pose: CameraPose, factor: number, width: number, height: number, x?: number, y?: number): CameraPose {
  const aspect = width / Math.max(1, height);
  const zoom = clamp(pose.zoom * factor, zoomMin(aspect), ZOOM_MAX);
  if (x === undefined || y === undefined || zoom === pose.zoom) return clampPose({ ...pose, zoom }, aspect);
  const f = frameOf(pose, width, height);
  const a = ((x / width) * 2 - 1) * f.halfW;
  const b = (1 - (y / height) * 2) * f.halfH;
  const [gx, gz] = groundOffset(f, pose.pitch, a, b);
  const keep = 1 - pose.zoom / zoom;
  return clampPose({ ...pose, zoom, target: [pose.target[0] + gx * keep, pose.target[1], pose.target[2] + gz * keep] }, aspect);
}

/** One damping step of the shown pose toward the goal. `dt` in seconds; 0 or less snaps. */
export function easePose(shown: CameraPose, goal: CameraPose, dt: number): CameraPose {
  if (!(dt > 0)) return goal;
  const k = 1 - Math.exp(-EASE_RATE * dt);
  const mix = (a: number, b: number): number => (Math.abs(b - a) < 1e-4 ? b : a + (b - a) * k);
  return {
    yaw: mix(shown.yaw, goal.yaw),
    pitch: mix(shown.pitch, goal.pitch),
    // Zoom eases in log space, so zooming in and out feel alike.
    zoom: Math.abs(goal.zoom - shown.zoom) < 1e-4 ? goal.zoom : Math.exp(mix(Math.log(shown.zoom), Math.log(goal.zoom))),
    target: [mix(shown.target[0], goal.target[0]), mix(shown.target[1], goal.target[1]), mix(shown.target[2], goal.target[2])],
  };
}

export function samePose(a: CameraPose, b: CameraPose): boolean {
  return a.yaw === b.yaw && a.pitch === b.pitch && a.zoom === b.zoom && a.target[0] === b.target[0] && a.target[1] === b.target[1] && a.target[2] === b.target[2];
}

/** Screen pixels per world unit (CSS pixels). */
export function pixelsPerUnit(pose: CameraPose, height: number): number {
  return (height * pose.zoom) / SIZE_Z;
}
