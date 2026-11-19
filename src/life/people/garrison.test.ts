// L37: the rider sits astride: the feet come down outside the horse's barrel.

import { expect, test } from 'vitest';
import { rigOf, soldierLook } from '@/parts/people/person';
import { rigMatrices, sitDrop } from '@/parts/people/pose';
import { straddle } from './garrison.system';

test("a rider's feet come down either side of the horse, outside its barrel", () => {
  const look = soldierLook(7, '#cc4444');
  const rig = rigOf(look);
  const local = new Float32Array(80);
  rigMatrices(look, { legL: 0.4, legR: 0.4, armL: 0.7, armR: 0.3, outL: 0.05, outR: 0.1, lean: 0.04, lift: 0, twist: 0 }, local, sitDrop(rig, 0), rig);
  straddle(local, 0.55);
  // A foot: the end of the leg, `leg` down its own −Y.
  const foot = (i: number): number => local[i * 16 + 12]! - local[i * 16 + 4]! * rig.leg;
  // The barrel is 0.078 across each side, in world units; the figure is drawn at look.scale.
  const barrel = 0.078 / look.scale;
  expect(foot(1)).toBeLessThan(-barrel);
  expect(foot(2)).toBeGreaterThan(barrel);
});
