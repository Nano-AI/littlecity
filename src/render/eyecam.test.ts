import { describe, expect, test } from 'vitest';
import { SIZE_X, SIZE_Z } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import type { CameraPose } from './api';
import { clampPose, frameOf, project } from './camera';
import { eyeFrame, eyeMatchingOrbit, eyeProject, EYE_NEAR, EYE_REACH } from './eyecam';

const W = 1280, H = 800;
const DEG = Math.PI / 180;
const MID: Vec3 = [SIZE_X / 2, 0, SIZE_Z / 2];

/** Points on a sphere of EYE_REACH round the map's centre, and the map's own corners and centre. */
function scenePoints(): Vec3[] {
  const pts: Vec3[] = [MID, [0, 0, 0], [SIZE_X, 0, 0], [0, 0, SIZE_Z], [SIZE_X, 20, SIZE_Z]];
  for (let a = 0; a < 360; a += 15) for (let e = -90; e <= 90; e += 15) {
    const r = EYE_REACH - 1e-6;
    pts.push([MID[0] + r * Math.cos(e * DEG) * Math.cos(a * DEG), r * Math.sin(e * DEG), MID[2] + r * Math.cos(e * DEG) * Math.sin(a * DEG)]);
  }
  return pts;
}

describe('fly camera', () => {
  test("the depth range holds the whole scene, from arm's length to a drone 3000+ units off, at any field of view", () => {
    for (const dist of [0, 20, 200, 3000, 6000]) for (const fov of [0.5, 1, 2, 60, 120]) for (const yaw of [0, 45, 200]) {
      // An eye up and back from the map's centre, looking at it.
      const pitch = -30;
      const back: Vec3 = [Math.sin(yaw * DEG) * Math.cos(pitch * DEG), -Math.sin(pitch * DEG), Math.cos(yaw * DEG) * Math.cos(pitch * DEG)];
      const eye: Vec3 = [MID[0] + back[0] * dist, 1.2 + back[1] * dist, MID[2] + back[2] * dist];
      const f = eyeFrame({ eye, yaw, pitch, fov }, W, H);
      expect(f.near).toBeGreaterThanOrEqual(EYE_NEAR);
      expect(f.near).toBeLessThan(f.far);
      for (const p of scenePoints()) {
        const [x, y, z] = eyeProject(f, p, W, H);
        if (z <= 0 || x < 0 || x > W || y < 0 || y > H) continue;   // not in the picture
        expect(z).toBeGreaterThanOrEqual(f.near);
        expect(z).toBeLessThanOrEqual(f.far);
      }
      // Far off, the near plane comes out to the scene, keeping the depth buffer fine across it.
      if (dist >= 3000 && fov <= 2) expect(f.far / f.near).toBeLessThan(1.2);
    }
  });

  test('a field of view down to half a degree is honoured, and narrower is held at it', () => {
    expect(eyeFrame({ eye: [24, 2, 60], yaw: 0, pitch: 0, fov: 0.5 }, W, H).tanY).toBeCloseTo(Math.tan(0.25 * DEG), 12);
    expect(eyeFrame({ eye: [24, 2, 60], yaw: 0, pitch: 0, fov: 0.1 }, W, H).tanY).toBeCloseTo(Math.tan(0.25 * DEG), 12);
  });

  test('the page behind turns from sky to paper as the field of view narrows', () => {
    const flat = (fov: number): number => eyeFrame({ eye: [24, 2, 60], yaw: 0, pitch: 0, fov }, W, H).flat;
    expect(flat(70)).toBe(0);
    expect(flat(12)).toBe(0);
    expect(flat(6)).toBeGreaterThan(0);
    expect(flat(6)).toBeLessThan(1);
    expect(flat(3)).toBe(1);
    expect(flat(0.5)).toBe(1);
  });

  describe('eyeMatchingOrbit', () => {
    const poses: CameraPose[] = [
      { yaw: 45, pitch: 35, zoom: 1, target: [24, 0, 24] },
      { yaw: 210, pitch: 60, zoom: 3.2, target: [9, 1, 30] },
      { yaw: -20, pitch: 12, zoom: 6, target: [40, 2, 5] },
    ];

    test('looks the way the orbit camera looks, from behind its target', () => {
      for (const cam of poses) {
        const w = eyeMatchingOrbit(cam, 1, W, H);
        const o = frameOf(clampPose(cam, W / H), W, H);
        const f = eyeFrame(w, W, H);
        for (let i = 0; i < 3; i++) {
          expect(f.forward[i]).toBeCloseTo(o.forward[i]!, 12);
          expect(f.right[i]).toBeCloseTo(o.right[i]!, 12);
          expect(f.up[i]).toBeCloseTo(o.up[i]!, 12);
        }
        expect(w.fov).toBe(1);
        expect(eyeProject(f, o.target, W, H)).toEqual([expect.closeTo(W / 2, 6), expect.closeTo(H / 2, 6), expect.any(Number)]);
      }
    });

    test('the plane through the target lands exactly where the orbit camera draws it', () => {
      for (const cam of poses) for (const fov of [0.5, 1, 30, 70]) {
        const o = frameOf(clampPose(cam, W / H), W, H);
        const f = eyeFrame(eyeMatchingOrbit(cam, fov, W, H), W, H);
        for (const [a, b] of [[-1, -1], [1, -1], [0.3, 0.8], [-0.9, 0.2]] as const) {
          const at = (i: 0 | 1 | 2): number => o.target[i] + o.right[i] * a * o.halfW + o.up[i] * b * o.halfH;
          const p: Vec3 = [at(0), at(1), at(2)];
          const [ox, oy] = project(o, p, W, H);
          const [wx, wy] = eyeProject(f, p, W, H);
          expect(wx).toBeCloseTo(ox, 6);
          expect(wy).toBeCloseTo(oy, 6);
        }
      }
    });

    test('at a degree, the whole island is within a few pixels of the orbit picture', () => {
      const cam: CameraPose = { yaw: 45, pitch: 35, zoom: 1, target: [24, 0, 24] };
      const o = frameOf(clampPose(cam, W / H), W, H);
      const f = eyeFrame(eyeMatchingOrbit(cam, 1, W, H), W, H);
      expect(f.far).toBeGreaterThan(2000);
      let worst = 0;
      for (const x of [0, 12, 24, 36, 48]) for (const z of [0, 12, 24, 36, 48]) for (const y of [0, 8]) {
        const [ox, oy] = project(o, [x, y, z], W, H);
        const [wx, wy, depth] = eyeProject(f, [x, y, z], W, H);
        expect(depth).toBeGreaterThan(f.near);
        expect(depth).toBeLessThan(f.far);
        worst = Math.max(worst, Math.hypot(wx - ox, wy - oy));
      }
      expect(worst).toBeLessThan(8);
    });
  });
});
