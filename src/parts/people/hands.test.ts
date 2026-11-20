// Hands on what they hold: for every tool and load and every pose it is used
// in, sampled through the pose's drawings, the hand is on its grip, and the
// hand the pose math says is where the drawn arm puts it.

import { describe, expect, test } from 'vitest';
import type { Vec3 } from '@/core/mat4';
import { aimArm, applyHold, bodyToFigure, CHEST_TOOLS, handOf, handReach, holdLong, JUGGLE, loadGrips, longToolLine, SHAFTS } from './hands';
import { HOLD_OF, holdAnchor, type Load } from './loads';
import { lookOf, rigOf } from './person';
import { POSES, poseOf, rigMatrices, type PoseName } from './pose';
import { CARGO_AT, CARGO_GRIP } from '@/life/ships/crew';
import { REINS_HAND } from '@/life/people/garrison.system';

const look = lookOf(1234);
const rig = rigOf(look);
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The middle of a hand as the drawn arm piece puts it (figure frame). */
function drawnHand(m: Float32Array, side: 1 | -1): Vec3 {
  const k = (side > 0 ? 4 : 3) * 16, y = -handReach(rig);
  return [m[k + 4]! * y + m[k + 12]!, m[k + 5]! * y + m[k + 13]!, m[k + 6]! * y + m[k + 14]!];
}
/** Seconds into a pose at which its drawings change (held poses change a few times a second). */
const SAMPLES = Array.from({ length: 24 }, (_, i) => i * 0.11);
/** Hands within this of their grip (figure units: a person is 0.42 tall, a hand 0.03 across). */
const NEAR = 0.012;

describe('hands on what they hold', () => {
  test('the pose math for a hand is where the drawn arm puts it', () => {
    for (const name of ['walk', 'sweep', 'tend', 'wave', 'fish'] as PoseName[]) {
      for (const t of SAMPLES) {
        const pose = poseOf(name, t);
        const m = rigMatrices(look, pose, new Float32Array(80), 0, rig);
        for (const side of [1, -1] as const) expect(dist(drawnHand(m, side), bodyToFigure(handOf(pose, rig, side), pose, rig)), `${name} ${side}`).toBeLessThan(1e-4);
      }
    }
  });

  test('long tools: the broom sweeping, the scythe mowing, the rod fishing: both hands on the shaft, the broom on the floor', () => {
    const uses: ['broom' | 'scythe' | 'rod', PoseName][] = [['broom', 'sweep'], ['scythe', 'mow'], ['rod', 'fish']];
    for (const [tool, name] of uses) {
      for (const t of SAMPLES) {
        const pose = poseOf(name, t);
        const [from, to] = longToolLine(tool, pose);
        const held = holdLong(pose, rig, from, to);
        const m = rigMatrices(look, pose, new Float32Array(80), 0, rig);
        expect(dist(drawnHand(m, 1), held.gripR), `${tool} right hand at ${t}`).toBeLessThan(NEAR);
        expect(dist(drawnHand(m, -1), held.gripL), `${tool} left hand at ${t}`).toBeLessThan(NEAR);
        // The two hands apart along the shaft, the right the higher.
        expect(dist(held.gripR, held.gripL), tool).toBeGreaterThan(0.03);
        expect(held.gripR[1]).toBeGreaterThan(held.gripL[1] - 1e-6);
        if (tool === 'broom') expect(from[1]).toBeLessThan(0.02);
      }
    }
  });

  test('loads: every way of carrying, walking and standing, has its hands where it holds it', () => {
    const loads = Object.keys(HOLD_OF) as Load[];
    for (const load of loads) {
      for (const name of ['walk', 'stand', 'tend', 'chat'] as PoseName[]) {
        for (const t of SAMPLES) {
          const pose = poseOf(name, t);
          applyHold(pose, rig, { tool: null, load, hold: HOLD_OF[load], anchor: holdAnchor(load) });
          const g = loadGrips(HOLD_OF[load], holdAnchor(load));
          if (g.R) expect(dist(handOf(pose, rig, 1), g.R), `${load} right hand, ${name}`).toBeLessThan(NEAR * 1.5);
          if (g.L) expect(dist(handOf(pose, rig, -1), g.L), `${load} left hand, ${name}`).toBeLessThan(NEAR * 1.5);
        }
      }
    }
  });

  test('the L23 miller’s sack and baker’s tray at the chest', () => {
    for (const tool of Object.keys(CHEST_TOOLS)) {
      const pose = poseOf('walk', 0.3);
      applyHold(pose, rig, { tool, load: null, hold: null, anchor: null });
      expect(dist(handOf(pose, rig, 1), CHEST_TOOLS[tool]![0])).toBeLessThan(NEAR * 1.5);
      expect(dist(handOf(pose, rig, -1), CHEST_TOOLS[tool]![1])).toBeLessThan(NEAR * 1.5);
    }
  });

  test('a load stays in the hands whatever the pose (a cheer, a look round, a flinch), from every way of carrying', () => {
    for (const load of Object.keys(HOLD_OF) as Load[]) {
      for (const name of POSES.filter((n) => n !== 'mow')) {
        for (const t of [0, 0.37, 0.81]) {
          const pose = poseOf(name, t);
          applyHold(pose, rig, { tool: null, load, hold: HOLD_OF[load], anchor: holdAnchor(load) });
          const g = loadGrips(HOLD_OF[load], holdAnchor(load));
          if (g.R) expect(dist(handOf(pose, rig, 1), g.R), `${load} right hand, ${name}`).toBeLessThan(NEAR * 1.5);
          if (g.L) expect(dist(handOf(pose, rig, -1), g.L), `${load} left hand, ${name}`).toBeLessThan(NEAR * 1.5);
        }
      }
    }
  });

  test('L36 pike and torch, L37 lance: the right hand closed on the shaft, walking and standing', () => {
    // A slim soldier and a stout one: the shaft is in reach of both.
    for (const r of [rigOf({ ...look, girth: 0.9 }), rigOf({ ...look, girth: 1.15 })]) {
      for (const tool of Object.keys(SHAFTS)) {
        const [a, b] = SHAFTS[tool]!;
        for (const name of ['walk', 'stand'] as PoseName[]) {
          for (const t of SAMPLES) {
            const pose = poseOf(name, t);
            applyHold(pose, r, { tool, load: null, hold: null, anchor: null });
            const h = handOf(pose, r, 1);
            // Distance from the hand to the shaft's segment.
            const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
            const k = Math.max(0, Math.min(1, ((h[0] - a[0]) * d[0] + (h[1] - a[1]) * d[1] + (h[2] - a[2]) * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2)));
            expect(dist(h, [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k]), `${tool} ${name} ${t}`).toBeLessThan(NEAR);
          }
        }
      }
    }
  });

  test('L56 juggling: each hand under its ball, in both drawings', () => {
    for (const tool of Object.keys(JUGGLE)) {
      const pose = poseOf('juggle', 0.2);
      applyHold(pose, rig, { tool, load: null, hold: null, anchor: null });
      for (const side of [1, -1] as const) {
        const h = handOf(pose, rig, side), want = JUGGLE[tool]![side > 0 ? 0 : 1];
        expect(dist(h, want), `${tool} ${side}`).toBeLessThan(NEAR);
      }
    }
  });

  test('a sailor carrying cargo has a hand at either side of it; the rider’s left hand is on the reins', () => {
    const pose = poseOf('walk', 0.4);
    for (const side of [1, -1] as const) aimArm(pose, rig, side, [side * CARGO_GRIP[0], CARGO_GRIP[1], CARGO_GRIP[2]]);
    const s = look.scale;
    for (const side of [1, -1] as const) {
      const f = bodyToFigure(handOf(pose, rig, side), pose, rig);
      const h: Vec3 = [f[0] * s, f[1] * s, f[2] * s];
      // The cargo (crates, barrels and sacks 0.2 to 0.25 across) sits CARGO_AT forward with its bottom CARGO_AT up.
      expect(Math.abs(h[0]), 'at its side').toBeGreaterThan(0.085);
      expect(Math.abs(h[0])).toBeLessThan(0.13);
      expect(h[2], 'along its side').toBeGreaterThan(CARGO_AT[0] - 0.1);
      expect(h[1], 'up its side').toBeGreaterThan(CARGO_AT[1]);
      expect(h[1]).toBeLessThan(CARGO_AT[1] + 0.22);
    }
    const ride = poseOf('stand', 0);
    aimArm(ride, rig, -1, REINS_HAND);
    expect(dist(handOf(ride, rig, -1), REINS_HAND)).toBeLessThan(NEAR);
  });
});
