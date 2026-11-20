// L31 clouds and L30 the balloon, on their fixture, at fixed steps.

import { describe, expect, test } from 'vitest';
import { SIZE_X, SIZE_Z } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import { resolveScenario } from '@/scenario';
import scn from '../../../scenarios/rules/L31.sky.scenario';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { recordingStage, step } from '../testing/stage';
import balloon, { BALLOON_CROSSING, BALLOON_EVERY } from './balloon.behaviour';
import cloud, { CLOUD_REACH } from './cloud.behaviour';

function live() {
  const town = resolveScenario(scn);
  const rec = recordingStage(town);
  const signals = createSignals(scn.seed);
  const life = createLife(rec.stage, signals, { behaviours: [cloud, balloon], systems: [] });
  life.sync(town);
  signals.hold('day');
  return { town, rec, signals, life };
}

describe('clouds (L31)', () => {
  test('clouds drift downwind high over the paper, come round again, and cast no shadow', () => {
    const { town, rec, signals, life } = live();
    const clouds = town.dressing.actors.filter((a) => a.type === 'cloud');
    const before = clouds.map((a) => positionOf(rec.of(a.id).matrix));
    step(life, signals, 10, 20);
    const w = signals.wind(SIZE_X / 2, SIZE_Z / 2);
    clouds.forEach((a, i) => {
      const [x, y, z] = positionOf(rec.of(a.id).matrix);
      expect(y).toBeGreaterThan(7);
      const moved = (x - before[i]![0]) * w.dirX + (z - before[i]![2]) * w.dirZ;
      expect(Math.abs(moved)).toBeGreaterThan(0.5);
    });
    // Over a long while every cloud stays within reach of the map: it comes round, never wanders off.
    for (let k = 0; k < 60; k++) {
      step(life, signals, 10, 5);
      for (const a of clouds) {
        const [x, , z] = positionOf(rec.of(a.id).matrix);
        expect(Math.hypot(x - SIZE_X / 2, z - SIZE_Z / 2)).toBeLessThan(CLOUD_REACH + 30);
      }
    }
    // No shadows on the island or the sea (removed at the owner's request).
    expect(rec.spawned.filter((r) => r.spec && 'actor' in r.spec && r.spec.variant === 'shadow')).toHaveLength(0);
  });
});

describe('the far balloon (L30)', () => {
  test('hidden most of the time; now and then it crosses, far off the map, and is gone again', () => {
    const { town, rec, signals, life } = live();
    const b = town.dressing.actors.find((a) => a.type === 'balloon')!;
    let shown = 0, frames = 0;
    for (let t = 0; t < BALLOON_EVERY * 2.5; t += 1) {
      step(life, signals, 1, 5);
      frames++;
      const r = rec.of(b.id);
      if (!r.visible) continue;
      shown++;
      const [x, y, z] = positionOf(r.matrix);
      expect(x < 0 || z < 0).toBe(true);
      expect(y).toBeGreaterThan(2.5);
    }
    expect(shown).toBeGreaterThan(BALLOON_CROSSING * 0.8);
    expect(shown).toBeLessThan(frames * 0.6);
  });
});
