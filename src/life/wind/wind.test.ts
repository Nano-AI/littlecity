// L02 and L03, stepped with fixed time steps on the fixture town.

import { describe, expect, test } from 'vitest';
import { positionOf } from '@/core/mat4';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { buildScenario } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { WINDY } from '@/style/animation';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { recordingStage, step } from '../testing/stage';
import sails, { sailSpeed } from './sails.behaviour';
import smoke, { dayPuff } from './smoke.behaviour';
import vane from './weathervane.behaviour';

function fixture() {
  const built = buildScenario(findScenario('L02.smoke')!);
  const shape = resolveShape(built.world, built.terrain);
  const dressing = resolveDressing(shape);
  const rec = recordingStage({ shape, dressing });
  const signals = createSignals(built.scenario.seed);
  const life = createLife(rec.stage, signals, { behaviours: [smoke, sails, vane], systems: [] });
  life.sync({ shape, dressing });
  return { rec, signals, life, shape, dressing };
}
const finite = (m: ArrayLike<number>): boolean => Array.from(m).every(Number.isFinite);

describe('L02 smoke', () => {
  test('by day 4 of 6 puffs smoke, evenly spread; all 6 at dusk; each chimney draws on twos', () => {
    expect([0, 1, 2, 3, 4, 5].filter((i) => dayPuff(i, 6, 4))).toHaveLength(4);
    const { rec, signals, life, dressing } = fixture();
    const chimneys = dressing.actors.filter((a) => a.type === 'smoke');
    const puffs = (): number => rec.spawned.filter((s) => s.visible).length + chimneys.filter((c) => rec.of(c.id).visible).length;
    step(life, signals, WINDY.smokeLife * 1.2);
    expect(puffs()).toBe(chimneys.length * WINDY.smokePuffs);
    const moves = rec.spawned[0]!.moves;
    step(life, signals, 1);
    expect(rec.spawned[0]!.moves - moves).toBeLessThanOrEqual(13);
    signals.hold('dusk');
    step(life, signals, WINDY.smokeLife * 1.2);
    expect(puffs()).toBe(chimneys.length * WINDY.smokePuffsBusy);
    signals.hold('day');
    step(life, signals, WINDY.smokeLife * 1.2);
    expect(puffs()).toBe(chimneys.length * WINDY.smokePuffs);
  });

  test('puffs rise from the pot and lean downwind, never upwind; nothing is ever NaN', () => {
    const { rec, signals, life, dressing } = fixture();
    const chimney = dressing.actors.find((a) => a.type === 'smoke')!;
    const [cx, cy, cz] = positionOf(rec.of(chimney.id).base);
    let checked = 0;
    for (let f = 0; f < 600; f++) {
      life.update(signals.advance(1 / 60));
      if (f % 20) continue;
      const wind = signals.wind(cx, cz);
      const own = rec.spawned[0]!; // the first chimney's second puff: one that smokes all day
      if (!own.visible) continue;
      expect(finite(own.matrix)).toBe(true);
      const [x, y, z] = positionOf(own.matrix);
      expect(y).toBeGreaterThanOrEqual(cy - 1e-6);
      expect(y - cy).toBeLessThan(WINDY.smokeRise + 0.2);
      // Its drift along the wind is forward; the sideways wag is small.
      expect((x - cx) * wind.dirX + (z - cz) * wind.dirZ).toBeGreaterThan(-0.08);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
    life.dispose();
    expect(rec.spawned.every((s) => s.released)).toBe(true);
  });
});

describe('L03 sails and weathervanes', () => {
  test('a wheel wants to turn faster in more wind and face-on than side-on, and never stops dead', () => {
    expect(sailSpeed(0.8, 1)).toBeGreaterThan(sailSpeed(0.3, 1));
    expect(sailSpeed(0.8, 1)).toBeGreaterThan(sailSpeed(0.8, 0));
    expect(sailSpeed(0, 0)).toBe(WINDY.sailIdle);
  });

  test('the wheel turns about its hub: its place stays put while its arms go round, on twos', () => {
    const { rec, signals, life, dressing } = fixture();
    const wheel = dressing.actors.find((a) => a.type === 'windmill-sails')!;
    const r = rec.of(wheel.id);
    const angles: number[] = [];
    for (let f = 0; f < 240; f++) {
      life.update(signals.advance(1 / 60));
      expect(positionOf(r.matrix)).toEqual(positionOf(r.base));
      angles.push(Math.atan2(r.matrix[1]!, r.matrix[0]!));
    }
    expect(new Set(angles.map((a) => a.toFixed(4))).size).toBeGreaterThan(30);
    expect(r.moves).toBeLessThanOrEqual(50); // 12 drawings a second over 4 seconds
  });

  test('a vane comes round to point its head into the wind', () => {
    const { rec, signals, life, dressing } = fixture();
    const v = dressing.actors.find((a) => a.type === 'weathervane');
    expect(v, 'the fixture has a weathervane').toBeDefined();
    step(life, signals, 6);
    const r = rec.of(v!.id);
    const [x, , z] = positionOf(r.base);
    const wind = signals.wind(x, z);
    // +Z of the vane (its head) against the wind's direction: pointing into it, within its hunting.
    const hx = r.matrix[8]!, hz = r.matrix[10]!;
    expect(hx * -wind.dirX + hz * -wind.dirZ).toBeGreaterThan(0.6);
  });
});
