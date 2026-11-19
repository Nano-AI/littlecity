import { describe, expect, test } from 'vitest';
import { CELL_H, SIZE_X, SIZE_Y, SIZE_Z } from '@/core/grid';
import type { CameraPose } from './api';
import { CAMERA_FAR, CAMERA_NEAR, clampPose, easePose, frameOf, panPose, PITCH_MAX, PITCH_MIN, pixelsPerUnit, project, rayAt, zoomMin, ZOOM_MAX, zoomPose } from './camera';

const W = 1280, H = 800;
const pose: CameraPose = { yaw: 45, pitch: 35, zoom: 2, target: [24, 1, 24] };

/** Where the ray under a pixel meets the horizontal plane at world height y. */
function groundUnder(p: CameraPose, x: number, y: number, planeY: number): [number, number] {
  const r = rayAt(frameOf(p, W, H), x, y, W, H);
  const t = (planeY - r.origin[1]) / r.dir[1];
  return [r.origin[0] + r.dir[0] * t, r.origin[2] + r.dir[2] * t];
}

describe('camera', () => {
  test('nothing that can be drawn is cut by the near or far plane, from any legal pose', () => {
    // The map, the paper under it, the tallest stack, and clouds out to where they come back in
    // (src/life/sky/cloud.behaviour.ts: 44 units from the centre, lobes up to ~18 units long).
    const reach = 66;
    let nearest = Infinity, farthest = -Infinity;
    for (const tx of [-3, SIZE_X + 3]) for (const tz of [-3, SIZE_Z + 3]) for (const ty of [0, SIZE_Y]) {
      for (let yaw = 0; yaw < 360; yaw += 15) for (const pitch of [PITCH_MIN, 35, PITCH_MAX]) {
        const f = frameOf(clampPose({ yaw, pitch, zoom: 2, target: [tx, ty, tz] }, 1.6), W, H);
        for (let a = 0; a < 360; a += 10) for (const y of [-4, SIZE_Y * CELL_H + 14]) {
          const p = [SIZE_X / 2 + reach * Math.cos((a * Math.PI) / 180), y, SIZE_Z / 2 + reach * Math.sin((a * Math.PI) / 180)];
          const depth = (p[0]! - f.eye[0]) * f.forward[0] + (p[1]! - f.eye[1]) * f.forward[1] + (p[2]! - f.eye[2]) * f.forward[2];
          nearest = Math.min(nearest, depth);
          farthest = Math.max(farthest, depth);
        }
      }
    }
    expect(nearest).toBeGreaterThan(CAMERA_NEAR + 5);
    expect(farthest).toBeLessThan(CAMERA_FAR - 5);
  });

  test('tilt is clamped so you cannot look from under the island; zoom and target stay in range', () => {
    expect(clampPose({ ...pose, pitch: -40 }, 1.6).pitch).toBe(PITCH_MIN);
    expect(clampPose({ ...pose, pitch: 120 }, 1.6).pitch).toBe(PITCH_MAX);
    expect(clampPose({ ...pose, zoom: 1000 }, 1.6).zoom).toBe(ZOOM_MAX);
    expect(clampPose({ ...pose, zoom: 0.001 }, 1.6).zoom).toBe(zoomMin(1.6));
    const far = clampPose({ ...pose, target: [900, -5, -900] }, 1.6).target;
    expect(far[0]).toBeLessThanOrEqual(SIZE_X + 3);
    expect(far[1]).toBe(0);
    expect(far[2]).toBeGreaterThanOrEqual(-3);
    expect(frameOf(clampPose({ ...pose, pitch: -40 }, 1.6), W, H).forward[1]).toBeLessThan(0);
  });

  test('the widest zoom fits the whole map diagonal on a desktop and on a phone held upright', () => {
    for (const [w, h] of [[1280, 800], [390, 844], [844, 390]] as const) {
      const widest: CameraPose = { yaw: 45, pitch: 35, zoom: zoomMin(w / h), target: [SIZE_X / 2, 0, SIZE_Z / 2] };
      const f = frameOf(widest, w, h);
      for (const corner of [[0, 0], [SIZE_X, 0], [0, SIZE_Z], [SIZE_X, SIZE_Z]] as const) {
        const [x, y] = project(f, [corner[0], 0, corner[1]], w, h);
        expect(x).toBeGreaterThanOrEqual(-1);
        expect(x).toBeLessThanOrEqual(w + 1);
        expect(y).toBeGreaterThanOrEqual(-1);
        expect(y).toBeLessThanOrEqual(h + 1);
      }
    }
  });

  test('zoom 1 fits the 48-column map in the view height; the target is at the centre of the view', () => {
    const f = frameOf({ ...pose, zoom: 1 }, W, H);
    expect(f.halfH * 2).toBe(SIZE_Z);
    expect(pixelsPerUnit({ ...pose, zoom: 1 }, H)).toBeCloseTo(H / SIZE_Z, 9);
    const [x, y] = project(frameOf(pose, W, H), [24, CELL_H, 24], W, H);
    expect(x).toBeCloseTo(W / 2, 6);
    expect(y).toBeCloseTo(H / 2, 6);
  });

  test('yaw 0 looks north, yaw 90 looks west', () => {
    const north = frameOf({ ...pose, yaw: 0 }, W, H).forward;
    expect(north[0]).toBeCloseTo(0, 9);
    expect(north[2]).toBeLessThan(0);
    const west = frameOf({ ...pose, yaw: 90 }, W, H).forward;
    expect(west[0]).toBeLessThan(0);
    expect(west[2]).toBeCloseTo(0, 9);
  });

  test('screenToRay and worldToScreen agree', () => {
    const f = frameOf(pose, W, H);
    const r = rayAt(f, 300, 500, W, H);
    for (const t of [10, 150, 260]) {
      const p: [number, number, number] = [r.origin[0] + r.dir[0] * t, r.origin[1] + r.dir[1] * t, r.origin[2] + r.dir[2] * t];
      const [x, y] = project(f, p, W, H);
      expect(x).toBeCloseTo(300, 6);
      expect(y).toBeCloseTo(500, 6);
    }
    // The ray starts in front of everything on the map.
    expect(r.origin[1]).toBeGreaterThan(32 * CELL_H);
  });

  test('pan: the ground under the pointer follows the pointer', () => {
    const before = groundUnder(pose, 400, 300, CELL_H);
    const panned = panPose(pose, 120, -60, W, H);
    const after = groundUnder(panned, 520, 240, CELL_H);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
    expect(panned.target[1]).toBe(pose.target[1]);
  });

  test('zoom about a point keeps the ground under that point fixed', () => {
    const before = groundUnder(pose, 900, 250, CELL_H);
    const zoomed = zoomPose(pose, 1.7, W, H, 900, 250);
    expect(zoomed.zoom).toBeCloseTo(3.4, 9);
    const after = groundUnder(zoomed, 900, 250, CELL_H);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
    // Without a point it zooms about the centre.
    expect(zoomPose(pose, 2, W, H).target).toEqual(pose.target);
  });

  test('damping: the shown pose glides to the goal, at the same rate whatever the frame rate, and lands on it', () => {
    const goal: CameraPose = { yaw: 135, pitch: 60, zoom: 6, target: [10, 2, 30] };
    let at60 = pose, at30 = pose;
    for (let i = 0; i < 12; i++) at60 = easePose(at60, goal, 1 / 60);
    for (let i = 0; i < 6; i++) at30 = easePose(at30, goal, 1 / 30);
    expect(at60.yaw).toBeCloseTo(at30.yaw, 6);
    expect(at60.yaw).toBeGreaterThan(45);
    expect(at60.yaw).toBeLessThan(135);
    let shown = pose;
    for (let i = 0; i < 240; i++) shown = easePose(shown, goal, 1 / 60);
    expect(shown).toEqual(goal);
    // A zero step (time did not advance) snaps rather than stalling for ever.
    expect(easePose(pose, goal, 0)).toEqual(goal);
  });
});
