// L05 leaves and L35 insects on their fixture, at fixed steps.

import { describe, expect, test } from 'vitest';
import { positionOf } from '@/core/mat4';
import { resolveScenario } from '@/scenario';
import scn from '../../../scenarios/rules/L05.leaves.scenario';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { recordingStage, step } from '../testing/stage';
import insect from './insect.behaviour';
import leaf, { LEAF_EVERY } from './leaf.behaviour';

function live() {
  const town = resolveScenario(scn);
  const rec = recordingStage(town);
  const signals = createSignals(scn.seed);
  const life = createLife(rec.stage, signals, { behaviours: [leaf, insect], systems: [] });
  life.sync(town);
  return { town, rec, signals, life };
}

describe('falling leaves (L05)', () => {
  test('each tree lets a leaf go now and then; it comes down to the ground near the tree and is gone', () => {
    const { town, rec, signals, life } = live();
    const leaves = town.dressing.actors.filter((a) => a.type === 'leaf');
    expect(leaves.length).toBeGreaterThan(2);
    const fell = new Set<string>();
    let landed = 0;
    for (let k = 0; k < LEAF_EVERY.leaf * 2.5 * 10; k++) {
      step(life, signals, 0.1, 30);
      for (const a of leaves) {
        const r = rec.of(a.id);
        if (!r.visible) continue;
        fell.add(a.id);
        const [x, y, z] = positionOf(r.matrix);
        const [bx, by, bz] = positionOf(r.base);
        expect(y).toBeGreaterThanOrEqual(by);
        expect(y).toBeLessThan(by + 1.6);
        expect(Math.hypot(x - bx, z - bz)).toBeLessThan(4);
        if (y < by + 0.02) landed++;
      }
    }
    expect(fell.size).toBe(leaves.length);
    expect(landed).toBeGreaterThan(0);
    // Most of the time a tree's leaf is not in the air: one leaf, now and then.
    const shown = leaves.filter((a) => rec.of(a.id).visible).length;
    expect(shown).toBeLessThan(leaves.length);
  });
});

describe('insects (L35)', () => {
  test('butterflies stay over their garden by day, low, and are gone at night', () => {
    const { town, rec, signals, life } = live();
    const flies = town.dressing.actors.filter((a) => a.type === 'insect');
    expect(flies.length).toBeGreaterThan(0);
    signals.hold('day');
    for (let k = 0; k < 40; k++) {
      step(life, signals, 0.5, 30);
      for (const a of flies) {
        const r = rec.of(a.id);
        expect(r.visible).toBe(true);
        const [x, y, z] = positionOf(r.matrix);
        const [bx, by, bz] = positionOf(r.base);
        expect(Math.hypot(x - bx, z - bz)).toBeLessThan(1.75);
        expect(y - by).toBeGreaterThan(0.04);
        expect(y - by).toBeLessThan(0.65);
      }
    }
    signals.hold('night');
    step(life, signals, 0.2);
    for (const a of flies) expect(rec.of(a.id).visible).toBe(false);
  });
});
