// The runtime's own promises (see the header of runtime.ts): state follows
// the socket, a failing behaviour is switched off without stopping the
// frame loop, and the recording stage and effects service behave.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import { identity } from '@/core/mat4';
import { defineRule } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { resolveTown } from '@/resolve/index';
import { flatTerrain, TownBuilder } from '@/scenario';
import { MOTION } from '@/style/animation';
import { emptyWorld } from '@/world/world';
import { demoRules } from '../../tests/fixtures/demo';
import { defineBehaviour, defineSystem, type SpawnSpec } from './api';
import { fxOf } from './fx/fx';
import fxSystem from './fx/fx.system';
import { angleDelta, arc, easeIn, easeInOut, easeOut, pop, settle } from './motion/ease';
import { fly, place, squash } from './motion/pose';
import { onTwos, Twos } from './motion/twos';
import { createLife, stateKey } from './runtime';
import { createSignals } from './signals';
import { recordingStage, step } from './testing/stage';

const terrain = flatTerrain(9);
const smokeRule = (id: string) =>
  defineRule<{ socket: string }>({
    id,
    part: 'life',
    tier: 1,
    priority: 40,
    find: ({ facts }) => socketsOfType(facts, 'chimney-top').map((s) => ({ anchor: s.cell, structure: s.structure, data: { socket: s.id } })),
    apply: (c, out) => void out.actor({ type: 'smoke', at: { socket: c.data.socket }, home: c.structure }),
  });
const base = demoRules.filter((r) => r.id !== 'L-X01.demo-smoke');
const town = (build: (b: TownBuilder) => void, rule: string) => {
  const b = new TownBuilder(emptyWorld(9), terrain);
  build(b);
  return resolveTown(b.world, terrain, { rules: [...base, smokeRule(rule)] });
};

describe('the runtime', () => {
  test('state follows the socket: an item with a new id on a surviving socket keeps its state', () => {
    const log: string[] = [];
    const smoke = defineBehaviour({
      actor: 'smoke',
      create: (item) => (log.push(`create ${item.id}`), { n: 0 }),
      update: (state) => void state.n++,
      dispose: (_s, ctx) => void log.push(`dispose ${ctx.item.id}`),
    });
    const a = town((b) => b.house(10, 10).house(14, 10), 'L-A.smoke');
    const rec = recordingStage(a);
    const signals = createSignals(9);
    const life = createLife(rec.stage, signals, { behaviours: [smoke], systems: [] });
    life.sync(a);
    expect(life.counts.behaviours).toBe(2);
    step(life, signals, 0.1);
    // The same town resolved by another rule: every item id changes, every socket id survives.
    const b = town((t) => t.house(10, 10).house(20, 10), 'L-B.smoke');
    expect(b.dressing.actors.map((x) => x.id).some((id) => a.dressing.actors.some((y) => y.id === id))).toBe(false);
    rec.setTown(b.shape, b.dressing);
    life.sync(b);
    // (10, 10) kept its state; the chimney at (14, 10) is gone, the one at (20, 10) is new.
    expect(log.filter((l) => l.startsWith('create'))).toHaveLength(3);
    expect(log.filter((l) => l.startsWith('dispose'))).toEqual([`dispose L-A.smoke@${key(14, 1, 10)}`]);
    life.dispose();
  });

  test('the state key is the socket for socket-anchored items and the item id otherwise', () => {
    const t = town((b) => b.house(10, 10), 'L-A.smoke');
    const actor = t.dressing.actors[0]!;
    expect(stateKey('actor', actor)).toBe(`actor:smoke@${(actor.at as { socket: string }).socket}`);
    expect(stateKey('actor', { ...actor, at: null })).toBe(`actor:${actor.id}`);
  });

  test('a behaviour that throws is reported once and switched off; the others keep running', () => {
    const errors: string[] = [];
    let good = 0;
    const t = town((b) => b.house(10, 10).house(14, 10), 'L-A.smoke');
    const bad = t.dressing.actors[0]!.id;
    const smoke = defineBehaviour({
      actor: 'smoke',
      create: (item) => ({ id: item.id }),
      update(state) {
        if (state.id === bad) throw new Error('boom');
        good++;
      },
    });
    const broken = defineSystem({
      id: 'broken',
      create: () => ({}),
      update() {
        throw new Error('system boom');
      },
    });
    const rec = recordingStage(t);
    const signals = createSignals(9);
    const life = createLife(rec.stage, signals, { behaviours: [smoke], systems: [broken], onError: (what) => void errors.push(what) });
    life.sync(t);
    step(life, signals, 0.5);
    expect(errors).toEqual(["system 'broken' (update)", "actor 'smoke' (update)"]);
    expect(good).toBe(30);
    expect(life.counts).toEqual({ behaviours: 1, systems: 0 });
  });
});

describe('effects', () => {
  test('an effect is shown, posed over its life, hidden at the end, and its instance is reused', () => {
    const t = town((b) => b.house(10, 10), 'L-A.smoke');
    const rec = recordingStage(t);
    const signals = createSignals(9);
    const life = createLife(rec.stage, signals, { behaviours: [], systems: [fxSystem] });
    life.sync(t);
    const spec: SpawnSpec = { actor: 'puff' };
    const seen: number[] = [];
    let done = 0;
    fxOf(rec.stage).play(spec, 0.5, (u, m) => (seen.push(u), void place(u, 0, 0, 0, 1, 1, 1, m)), { smooth: true, done: () => void done++ });
    expect(rec.spawned).toHaveLength(1);
    expect(rec.spawned[0]!.visible).toBe(false);
    step(life, signals, 0.25);
    expect(rec.spawned[0]!.visible).toBe(true);
    expect(rec.spawned[0]!.matrix[12]).toBeCloseTo(0.25 / 0.5, 5);
    step(life, signals, 0.3);
    expect(rec.spawned[0]!.visible).toBe(false);
    expect(done).toBe(1);
    expect(seen.every((u) => u > 0 && u < 1)).toBe(true);
    // The next effect of the same kind takes the same instance.
    fxOf(rec.stage).play(spec, 0.5, (_u, m) => void place(0, 0, 0, 0, 1, 1, 1, m));
    expect(rec.spawned).toHaveLength(1);
    // On twos (the default): about 12 drawings a second, not 60.
    const moves = rec.spawned[0]!.moves;
    step(life, signals, 0.4);
    const drawn = rec.spawned[0]!.moves - moves;
    expect(drawn).toBeGreaterThanOrEqual(4);
    expect(drawn).toBeLessThanOrEqual(6);
    life.dispose();
    expect(rec.spawned[0]!.released).toBe(true);
  });
});

describe('the motion kit', () => {
  test('the easing family starts at 0, ends at 1 and overshoots only where it says', () => {
    for (const f of [easeIn, easeOut, easeInOut, pop]) {
      expect(f(0)).toBeCloseTo(0, 9);
      expect(f(1)).toBeCloseTo(1, 9);
      expect(f(-1)).toBeCloseTo(0, 9);
      expect(f(2)).toBeCloseTo(1, 9);
    }
    let most = 0;
    for (let i = 0; i <= 100; i++) {
      most = Math.max(most, pop(i / 100));
      expect(easeOut(i / 100)).toBeLessThanOrEqual(1);
      expect(easeInOut(i / 100)).toBeLessThanOrEqual(1);
    }
    expect(most).toBeGreaterThan(1.05);
    expect(most).toBeLessThan(1.15);
    expect(settle(0)).toBe(0);
    expect(Math.abs(settle(1))).toBeLessThan(1e-9);
    expect(arc(0.5)).toBe(1);
    expect(angleDelta(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2, 9);
  });

  test('on twos: twelve drawings a second, each held for five frames at 60 fps', () => {
    expect(MOTION.poseFps).toBe(12);
    const times = new Set<number>();
    for (let f = 0; f < 60; f++) times.add(onTwos(f / 60 + 1e-6));
    expect(times.size).toBe(12);
    const tw = new Twos(0);
    let ticks = 0, total = 0;
    for (let f = 0; f < 120; f++) {
      const s = tw.tick(1 / 60);
      if (s > 0) ticks++;
      total += s;
    }
    expect(ticks).toBe(24);
    expect(total).toBeCloseTo(2, 6);
    // Phases spread the drawings over different frames.
    const a = new Twos(0), b = new Twos(0.5);
    let together = 0;
    for (let f = 0; f < 60; f++) {
      const ta = a.tick(1 / 60), tb = b.tick(1 / 60);
      if (ta > 0 && tb > 0) together++;
    }
    expect(together).toBe(0);
  });

  test('poses: place heads along (sin yaw, cos yaw); fly pitches the nose up; squash keeps its pivot', () => {
    const m = place(1, 2, 3, Math.PI / 2);
    expect([m[8]!, m[9]!, m[10]!].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 0, 0]);
    expect([m[12], m[13], m[14]]).toEqual([1, 2, 3]);
    const f = fly(0, 0, 0, 0, Math.PI / 6);
    expect(f[9]!).toBeCloseTo(0.5, 6); // +Z (the nose) rises
    const s = squash(4, 1, 5, 1.1, 0.8, 1.1, 0, 0.02, -0.03);
    const p = [4, 1, 5];
    const out = [0, 1, 2].map((r) => s[r]! * p[0]! + s[4 + r]! * p[1]! + s[8 + r]! * p[2]! + s[12 + r]!);
    expect(out[0]).toBeCloseTo(4, 9);
    expect(out[1]).toBeCloseTo(1, 9);
    expect(out[2]).toBeCloseTo(5, 9);
    expect(squash(4, 1, 5, 1, 1, 1).map((v) => v + 0)).toEqual(identity());
  });
});
