// L29 and the L03 cap, stepped with fixed time steps on their fixture town.

import { describe, expect, test } from 'vitest';
import { invertAffine, multiply, positionOf } from '@/core/mat4';
import { hubInNeck } from '@/gen/windmill/cap';
import { resolveScenario } from '@/scenario';
import { MECHANISMS } from '@/style/animation';
import { WINDMILL } from '@/style/houses';
import scn from '../../../scenarios/rules/L29.mechanisms.scenario';
import { createLife } from '../runtime';
import { createSignals, partPhases, timeAt } from '../signals';
import { recordingStage, step } from '../testing/stage';
import sails from '../wind/sails.behaviour';
import bell, { bellAngle } from './bell.behaviour';
import clock, { gameHour } from './clock.behaviour';
import cap from './mill-cap.behaviour';
import sign, { signPush } from './sign.behaviour';
import jet, { beadAlong } from './water-jet.behaviour';

function live() {
  const town = resolveScenario(scn);
  const rec = recordingStage(town);
  const signals = createSignals(scn.seed);
  const life = createLife(rec.stage, signals, {
    behaviours: [cap, sails, bell, clock, jet, sign],
    systems: [],
    onError: (what, error) => {
      throw new Error(`${what}: ${String(error)}`);
    },
  });
  life.sync(town);
  return { town, rec, signals, life };
}
const at = (part: 'day' | 'dusk' | 'night' | 'dawn', along: number) => {
  const p = partPhases()[part];
  return timeAt(p.start + (p.end - p.start) * along, 100);
};
const finite = (m: ArrayLike<number>): boolean => Array.from(m).every(Number.isFinite);

describe('clock hands (L29)', () => {
  test('the clock tells the game time: six at dawn’s end, noon mid-day, six at dusk, nine at nightfall', () => {
    expect(gameHour(at('day', 0))).toBeCloseTo(6);
    expect(gameHour(at('day', 0.5))).toBeCloseTo(12);
    expect(gameHour(at('dusk', 0))).toBeCloseTo(18);
    expect(gameHour(at('night', 0))).toBeCloseTo(21);
    expect(gameHour(at('dawn', 0))).toBeCloseTo(5);
    expect(gameHour(at('dawn', 0.999))).toBeCloseTo(6, 1);
  });

  test('at noon both hands point up the dial; they stay on the dial’s centre', () => {
    const { town, rec, signals, life } = live();
    signals.hold('day');
    step(life, signals, 0.2);
    const hands = town.dressing.actors.filter((a) => a.type === 'clock-hands');
    expect(hands.length).toBeGreaterThan(1);
    for (const h of hands) {
      const r = rec.of(h.id);
      expect(positionOf(r.matrix)).toEqual(positionOf(r.base));
      // The hand's +Y (where it points) is the dial's +Y at twelve.
      const dot = r.matrix[4]! * r.base[4]! + r.matrix[5]! * r.base[5]! + r.matrix[6]! * r.base[6]!;
      expect(dot).toBeGreaterThan(0.99);
    }
  });
});

describe('bells (L29)', () => {
  test('still by day, swinging early in the evening, still again once the peal is over', () => {
    expect(bellAngle(at('day', 0.5), 0, 1.7 / 4)).toBe(0);
    let most = 0;
    for (let s = 0; s < MECHANISMS.pealTime; s += 0.05) {
      const p = partPhases().dusk;
      const t = timeAt(p.start + (p.end - p.start) * 0.5, s);
      most = Math.max(most, Math.abs(bellAngle(t, 0, s)));
    }
    expect(most).toBeGreaterThan(MECHANISMS.bellSwing * 0.8);
    expect(bellAngle(at('night', 0.5), 0, 0.4)).toBe(0);
    const { town, rec, signals, life } = live();
    const b = town.dressing.actors.find((a) => a.type === 'bell')!;
    signals.hold('day');
    step(life, signals, 1);
    expect(rec.of(b.id).matrix).toEqual(rec.of(b.id).base);
    // Run the evening in from the end of the day: the bell swings within its limit.
    signals.setPhase(partPhases().dusk.start);
    signals.hold('run');
    let swung = 0;
    for (let k = 0; k < 60 * 30; k++) {
      life.update(signals.advance(1 / 60));
      const m = rec.of(b.id).matrix;
      expect(finite(m)).toBe(true);
      expect(positionOf(m)).toEqual(positionOf(rec.of(b.id).base));
      swung = Math.max(swung, Math.abs(Math.asin(Math.max(-1, Math.min(1, m[6]!)))));
    }
    expect(swung).toBeGreaterThan(MECHANISMS.bellSwing * 0.5);
    expect(swung).toBeLessThanOrEqual(MECHANISMS.bellSwing + 1e-6);
  });
});

describe('the mill cap (L03)', () => {
  test('the cap comes round to face the wind, turning about the tower, and the sails stay on its hub', () => {
    const { town, rec, signals, life } = live();
    const c = town.dressing.actors.find((a) => a.type === 'mill-cap')!;
    const wheel = town.dressing.actors.find((a) => a.type === 'windmill-sails')!;
    const neck = multiply(rec.of(c.id).base, invertAffine(hubInNeck(WINDMILL.neckR)));
    for (let k = 0; k < 20; k++) {
      step(life, signals, 1);
      const m = rec.of(c.id).matrix;
      expect(finite(m)).toBe(true);
      // The tower's axis does not move: the turned neck is still over it.
      const turnedNeck = multiply(m, invertAffine(hubInNeck(WINDMILL.neckR)));
      expect(turnedNeck[12]).toBeCloseTo(neck[12]!, 6);
      expect(turnedNeck[14]).toBeCloseTo(neck[14]!, 6);
      // The wheel turns about the cap's hub (a frame behind it at most: the cap may update after the wheel).
      expect(Math.hypot(...positionOf(rec.of(wheel.id).matrix).map((v, i) => v - positionOf(m)[i]!))).toBeLessThan(0.002);
      // Facing into the wind, give or take what it has not yet caught up with.
      const w = signals.wind(neck[12]!, neck[14]!);
      const len = Math.hypot(turnedNeck[8]!, turnedNeck[10]!);
      expect((turnedNeck[8]! * -w.dirX + turnedNeck[10]! * -w.dirZ) / len).toBeGreaterThan(0.8);
    }
  });
});

describe('fountain jets and shop signs (L29)', () => {
  test('beads run from the lip into the pool, never outside the stream', () => {
    for (let s = 0; s < 3; s += 0.07) {
      const t = beadAlong(s, 1, 3, 0.3);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(1);
    }
    const { town, rec, signals, life } = live();
    step(life, signals, 2);
    const jets = town.dressing.actors.filter((a) => a.type === 'water-jet');
    expect(jets.length).toBeGreaterThan(2);
    for (const r of rec.spawned) expect(finite(r.matrix)).toBe(true);
    // Every bead is close to the lip of some jet (its own stream is under 0.4 long).
    const lips = jets.map((j) => positionOf(rec.of(j.id).base));
    const beads = rec.spawned.filter((r) => r.spec && 'actor' in r.spec && r.spec.variant === 'bead');
    expect(beads.length).toBe(jets.length * MECHANISMS.jetBeads);
    for (const r of beads) {
      const [bx, by, bz] = positionOf(r.matrix);
      expect(Math.min(...lips.map(([x, y, z]) => Math.hypot(bx - x, by - y, bz - z)))).toBeLessThan(0.45);
    }
  });

  test('a sign leans away from the wind across its board, and not at all from wind along it', () => {
    expect(signPush(1, 0, 1, 1, 0)).toBeGreaterThan(0);
    expect(signPush(-1, 0, 1, 1, 0)).toBeLessThan(0);
    expect(signPush(0, 1, 1, 1, 0)).toBe(0);
  });
});
