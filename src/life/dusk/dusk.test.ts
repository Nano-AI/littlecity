// What dusk switches on (L07, lamps, L09), stepped on the fixture town.

import { describe, expect, test } from 'vitest';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { DUSKY } from '@/style/animation';
import { TIME } from '@/style/time';
import { createLife } from '../runtime';
import { createSignals, partPhases, timeAt } from '../signals';
import { recordingStage, step } from '../testing/stage';
import { beam, beamLevel, beamYaw, glow as pool } from './beam.behaviour';
import { eveningSeconds, nightProgress } from './evening';
import firefly, { firefliesOut, FIREFLY_UNTIL, flashing } from './firefly.behaviour';
import { canGlow, glowOf, litParam } from './glow';
import lamps, { catching, lampOrder, lightLamp } from './lamps.system';
import { setOccupied } from './occupancy';
import windowLight, { RAMP, wantsLight } from './window-light.behaviour';

const phases = partPhases();
const at = (part: 'day' | 'dusk' | 'night' | 'dawn', within: number) => timeAt(phases[part].start + (phases[part].end - phases[part].start) * within, 0);

function fixture() {
  const scn = findScenario('L07.window-light')!;
  const built = buildScenario(scn);
  const opts = scenarioResolveOptions(scn);
  const shape = resolveShape(built.world, built.terrain, opts);
  const dressing = resolveDressing(shape, opts);
  const rec = recordingStage({ shape, dressing });
  const signals = createSignals(scn.seed);
  const life = createLife(rec.stage, signals, { behaviours: [windowLight, beam, pool], systems: [lamps] });
  life.sync({ shape, dressing });
  return { rec, signals, life, shape, dressing };
}

describe('the evening clock', () => {
  test('it is 0 by day, starts when the page can first glow, and runs on through the night', () => {
    expect(eveningSeconds(at('day', 0.5))).toBe(0);
    expect(eveningSeconds(at('dusk', 0.05))).toBe(0);
    expect(canGlow(glowOf(at('dusk', 0.05)))).toBe(false);
    const late = eveningSeconds(at('dusk', 0.95));
    expect(late).toBeGreaterThan(RAMP); // every home has had its turn before night falls
    expect(eveningSeconds(at('night', 0.5))).toBeGreaterThan(late);
    expect(eveningSeconds(at('dawn', 0.5))).toBe(0);
    expect(nightProgress(at('night', 0.25))).toBeCloseTo(0.25, 6);
    // The moment it starts is the moment the page glow reaches the minimum.
    let first = 0;
    for (let i = 0; i <= 600; i++) if (eveningSeconds(at('dusk', i / 600)) > 0) { first = i / 600; break; }
    expect(canGlow(glowOf(at('dusk', first + 0.01)))).toBe(true);
    expect(first * TIME.dusk).toBeGreaterThan(10);
  });

  test('litParam makes "page glow × param" equal the level asked for', () => {
    expect(litParam(1, 0.25) * 0.25).toBeCloseTo(1, 9);
    expect(litParam(0.5, 0.8) * 0.8).toBeCloseTo(0.5, 9);
    expect(litParam(1, 0)).toBe(0);
    expect(litParam(0, 0.5)).toBe(0);
  });
});

describe('L07 windows', () => {
  const home = { order: 0.5, shop: false, bedtime: 0.6 };
  test('a home lights at its moment in the 20 s ramp, a shop at once, an empty house never', () => {
    let on = -1;
    for (let i = 0; i <= 600 && on < 0; i++) if (wantsLight(home, at('dusk', i / 600), true)) on = eveningSeconds(at('dusk', i / 600));
    expect(on).toBeGreaterThanOrEqual(0.5 * RAMP);
    expect(on).toBeLessThan(0.5 * RAMP + 0.2);
    const early = at('dusk', 0.45);
    expect(canGlow(glowOf(early))).toBe(true);
    expect(wantsLight({ ...home, shop: true }, early, true)).toBe(1);
    expect(wantsLight({ ...home, order: 0.99 }, early, true)).toBe(0);
    expect(wantsLight({ ...home, shop: true }, at('night', 0.2), false)).toBe(0);
    expect(wantsLight(home, at('day', 0.5), true)).toBe(0);
  });

  test('most homes go dark late at night; night owls stay up until dawn breaks', () => {
    expect(wantsLight(home, at('night', 0.5), true)).toBe(1);
    expect(wantsLight(home, at('night', 0.7), true)).toBe(0);
    expect(wantsLight(home, at('dawn', 0.1), true)).toBe(0);
    const owl = { ...home, bedtime: 2 };
    expect(wantsLight(owl, at('night', 0.99), true)).toBe(1);
    expect(wantsLight(owl, at('dawn', 0.2), true)).toBe(1);
    expect(wantsLight(owl, at('dawn', 0.8), true)).toBe(0);
  });

  test('by day no house is held; at night dark houses are held at 0 and a house whose people leave fades out', () => {
    const { rec, signals, life, dressing } = fixture();
    step(life, signals, 0.5);
    expect(rec.lifted.size).toBe(0);
    signals.hold('night');
    step(life, signals, 1);
    const lights = dressing.actors.filter((a) => a.type === 'window-light');
    const dark = lights.filter((a) => rec.lifted.has(a.home!));
    // Mid-night: some homes are in bed (held at 0), the rest are simply lit (not held).
    expect(dark.length).toBeGreaterThan(0);
    expect(dark.length).toBeLessThan(lights.length);
    for (const a of dark) expect(rec.of(`structure:${a.home}`).params[0]).toBe(0);
    const lit = lights.find((a) => !rec.lifted.has(a.home!))!;
    setOccupied(rec.stage, lit.home!, false);
    step(life, signals, DUSKY.houseFade / 2);
    const mid = rec.of(`structure:${lit.home}`).params[0];
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    step(life, signals, DUSKY.houseFade);
    expect(rec.of(`structure:${lit.home}`).params[0]).toBe(0);
    setOccupied(rec.stage, lit.home!, true);
    signals.hold('day');
    step(life, signals, 0.2);
    expect(rec.lifted.size).toBe(0);
  });
});

describe('lamps', () => {
  test('lamps along a street light in order, a few seconds apart; a lamp catches with a flicker', () => {
    const { shape, dressing, rec } = fixture();
    const found = dressing.props.filter((p) => p.type === 'lamp').map((p) => ({ id: p.id, pos: [rec.of(p.id).base[12]!, rec.of(p.id).base[13]!, rec.of(p.id).base[14]!] as const }));
    expect(found.length).toBe(9);
    const order = lampOrder(shape, found, 1);
    const along = [...found].sort((a, b) => a.pos[0] - b.pos[0]).map((l) => order.get(l.id)!);
    const steps = along.slice(1).map((t, i) => t - along[i]!);
    // One street: every step the same sign (one end to the other) and DUSKY.lampGap long.
    expect(new Set(steps.map(Math.sign)).size).toBe(1);
    for (const s of steps) expect(Math.abs(s)).toBeCloseTo(DUSKY.lampGap, 6);
    expect(Math.min(...along)).toBeLessThanOrEqual(DUSKY.lampSpread);
    expect(catching(-1)).toBe(0);
    expect(catching(0)).toBeLessThan(1);
    expect(catching(DUSKY.lampCatch)).toBe(1);
  });

  test('through an evening the lamps go from dark to lit one at a time, and the lamplighter can light one early', () => {
    const { rec, signals, life, dressing } = fixture();
    const ids = dressing.props.filter((p) => p.type === 'lamp').map((p) => p.id);
    const litCount = (): number => ids.filter((id) => rec.of(id).params[0] * glowOf(signals.time) > 0.99).length;
    signals.hold('run');
    signals.setPhase(phases.dusk.start + (phases.dusk.end - phases.dusk.start) * 0.3);
    const counts: number[] = [];
    for (let s = 0; s < 40; s++) {
      step(life, signals, 1);
      counts.push(litCount());
    }
    expect(counts[0]).toBe(0);
    expect(counts.at(-1)).toBe(ids.length);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
      expect(counts[i]! - counts[i - 1]!).toBeLessThanOrEqual(2);
    }
    // Early by hand.
    const again = fixture();
    again.signals.hold('run');
    again.signals.setPhase(phases.dusk.start + (phases.dusk.end - phases.dusk.start) * 0.4);
    step(again.life, again.signals, 0.1);
    const last = [...ids].sort((a, b) => again.rec.of(b).base[12]! - again.rec.of(a).base[12]! || 0);
    const target = last.find((id) => again.rec.of(id).params[0] === 0)!;
    expect(lightLamp(again.rec.stage, target)).toBe(true);
    step(again.life, again.signals, DUSKY.lampCatch + 0.2);
    expect(again.rec.of(target).params[0] * glowOf(again.signals.time)).toBeCloseTo(1, 5);
    expect(lightLamp(again.rec.stage, 'no-such-lamp')).toBe(false);
  });
});

describe('L09 the beam', () => {
  test('it shows only at night, coming up over a few seconds and dying as dawn begins', () => {
    expect(beamLevel(at('day', 0.5))).toBe(0);
    expect(beamLevel(at('dusk', 0.9))).toBe(0);
    expect(beamLevel(at('night', 0))).toBe(0);
    expect(beamLevel(at('night', 0.5))).toBe(1);
    expect(beamLevel(at('dawn', 0.5))).toBe(0);
    const early = beamLevel(at('night', 1 / TIME.night));
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(1);
  });

  test('beam and pool turn together, once every DUSKY.beamTurn seconds, and are hidden by day', () => {
    const { rec, signals, life, dressing } = fixture();
    const b = dressing.actors.find((a) => a.type === 'lighthouse-beam')!;
    const g = dressing.actors.find((a) => a.type === 'beam-glow')!;
    step(life, signals, 0.2);
    expect(rec.of(b.id).visible).toBe(false);
    expect(rec.of(g.id).visible).toBe(false);
    signals.hold('night');
    const yaws: number[] = [];
    for (let f = 0; f < DUSKY.beamTurn * 60; f++) {
      life.update(signals.advance(1 / 60));
      const mb = rec.of(b.id).matrix, mg = rec.of(g.id).matrix;
      expect(Math.atan2(mb[8]!, mb[10]!)).toBeCloseTo(Math.atan2(mg[8]!, mg[10]!), 9);
      yaws.push(Math.atan2(mb[8]!, mb[10]!));
    }
    expect(rec.of(b.id).visible).toBe(true);
    // The pool lies on the water; the beam stays at the lantern.
    expect(rec.of(g.id).matrix[13]!).toBeLessThan(0.5);
    expect(rec.of(b.id).matrix[13]!).toBe(rec.of(b.id).base[13]!);
    // One full turn: every quarter of the compass was visited.
    expect(new Set(yaws.map((y) => Math.floor((y + Math.PI) / (Math.PI / 2)) % 4)).size).toBe(4);
    expect(beamYaw(DUSKY.beamTurn, 7)).toBeCloseTo(beamYaw(0, 7), 6);
  });
});

describe('L10 fireflies', () => {
  test('they are out from lamp-lighting until the middle of the night, never by day or at dawn', () => {
    expect(firefliesOut(at('day', 0.5))).toBe(false);
    expect(firefliesOut(at('dusk', 0.1))).toBe(false);
    expect(firefliesOut(at('dusk', 0.7))).toBe(true);
    expect(firefliesOut(at('night', FIREFLY_UNTIL - 0.05))).toBe(true);
    expect(firefliesOut(at('night', FIREFLY_UNTIL + 0.05))).toBe(false);
    expect(firefliesOut(at('dawn', 0.5))).toBe(false);
    let lit = 0;
    for (let i = 0; i < 1000; i++) if (flashing(i * 0.01, 2, 0.3)) lit++;
    expect(lit).toBeGreaterThan(420);
    expect(lit).toBeLessThan(580); // lit about half the time
  });

  test('each drifts within a cell or so of its spot and blinks; all are hidden by day', () => {
    const scn = findScenario('L10.fireflies')!;
    const built = buildScenario(scn);
    const shape = resolveShape(built.world, built.terrain);
    const dressing = resolveDressing(shape);
    const rec = recordingStage({ shape, dressing });
    const signals = createSignals(scn.seed);
    const life = createLife(rec.stage, signals, { behaviours: [firefly], systems: [] });
    life.sync({ shape, dressing });
    const flies = dressing.actors.filter((a) => a.type === 'firefly');
    expect(flies.length).toBeGreaterThanOrEqual(10);
    step(life, signals, 1);
    expect(flies.every((f) => !rec.of(f.id).visible)).toBe(true);
    signals.hold('dusk');
    const seen = flies.map(() => new Set<boolean>());
    for (let f = 0; f < 600; f++) {
      life.update(signals.advance(1 / 60));
      flies.forEach((fly, i) => {
        const r = rec.of(fly.id);
        seen[i]!.add(r.visible);
        if (r.moves === 0) return;
        expect(Math.hypot(r.matrix[12]! - r.base[12]!, r.matrix[14]! - r.base[14]!)).toBeLessThan(1.4);
        expect(r.matrix[13]! - r.base[13]!).toBeGreaterThan(0.05);
      });
    }
    for (const s of seen) expect(s.size).toBe(2); // every one was seen lit and seen dark
  });
});
