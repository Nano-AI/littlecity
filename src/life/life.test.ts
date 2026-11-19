import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import { identity, positionOf, type Mat4Like } from '@/core/mat4';
import { resolveTown } from '@/resolve/index';
import { flatTerrain, TownBuilder } from '@/scenario';
import { TIME } from '@/style/time';
import { emptyWorld } from '@/world/world';
import { demoBehaviours, demoRules, demoSystems } from '../../tests/fixtures/demo';
import { defineBehaviour, defineSystem, type InstanceHandle, type LifeStage } from './api';
import { collectBehaviours, collectSystems } from './discover';
import { createLife } from './runtime';
import { createSignals, partPhases } from './signals';

const terrain = flatTerrain(9);
const town = (build: (b: TownBuilder) => void) => {
  const b = new TownBuilder(emptyWorld(9), terrain);
  build(b);
  return resolveTown(b.world, terrain, { rules: demoRules });
};

/** A LifeStage that records what life did, with no renderer. */
function fakeStage() {
  const matrices = new Map<string, Mat4Like>();
  const released: string[] = [];
  const handle = (id: string): InstanceHandle => ({
    base: identity(),
    setMatrix: (m) => void matrices.set(id, m),
    setVisible() {},
    setParams() {},
    release: () => void released.push(id),
  });
  const stage: LifeStage = {
    instance: (id) => handle(id),
    spawn: () => handle('spawned'),
    spawnMesh: () => handle('mesh'),
    liftStructure: (id) => handle(`structure:${id}`),
    socket: () => identity(),
  };
  return { stage, matrices, released };
}

describe('signals', () => {
  test('the dusk cycle runs day, dusk, night, dawn', () => {
    const s = createSignals(1);
    expect(s.time).toMatchObject({ phase: 0, part: 'day', isDay: true, light: 1 });
    s.hold('dusk');
    expect(s.time).toMatchObject({ part: 'dusk', isDusk: true, isDay: false });
    expect(s.time.light).toBeGreaterThan(0);
    expect(s.time.light).toBeLessThan(1);
    s.hold('night');
    expect(s.time).toMatchObject({ isNight: true, light: 0 });
    s.setPhase(partPhases().dawn.mid);
    expect(s.time.isDawn).toBe(true);
    const loop = TIME.day + TIME.dusk + TIME.night + TIME.dawn;
    expect(loop).toBe(480);
  });

  test('signals clamp dt: a sleeping tab never jumps time', () => {
    const s = createSignals(1);
    expect(s.advance(5)).toBe(TIME.maxStep);
    expect(s.time.seconds).toBeCloseTo(0.1, 9);
    expect(s.advance(-1)).toBe(0);
    expect(s.advance(Number.NaN)).toBe(0);
    expect(s.advance(0.016)).toBeCloseTo(0.016, 9);
    expect(s.time.phase).toBeCloseTo(0.116 / 480, 9);
  });

  test('holding stops the cycle but not life time', () => {
    const s = createSignals(1);
    s.hold('night');
    const phase = s.time.phase;
    for (let i = 0; i < 50; i++) s.advance(0.1);
    expect(s.time.phase).toBe(phase);
    expect(s.time.seconds).toBeCloseTo(5, 6);
    expect(s.holding).toBe('night');
  });

  test('events reach subscribers until they unsubscribe', () => {
    const s = createSignals(1);
    const got: number[] = [];
    const off = s.on('blockLanded', (cell) => got.push(cell));
    s.emit('blockLanded', key(1, 2, 3));
    s.emit('blockRemoved', key(9, 9, 9));
    off();
    s.emit('blockLanded', key(4, 5, 6));
    expect(got).toEqual([key(1, 2, 3)]);
    const w = s.wind(10, 10);
    expect(Math.hypot(w.dirX, w.dirZ)).toBeCloseTo(1, 6);
  });
});

describe('behaviours and systems', () => {
  test('discovery collects them and refuses duplicates', () => {
    expect(demoBehaviours.map((b) => `${b.category}:${b.type}`)).toEqual(['actor:smoke']);
    expect(demoSystems.map((s) => s.id)).toEqual(['demo.census']);
    const b = defineBehaviour({ prop: 'flag', create: () => ({}), update() {} });
    expect(() => collectBehaviours({ '/a.behaviour.ts': { default: b }, '/b.behaviour.ts': { default: b } })).toThrow(/two behaviours/);
    const sys = defineSystem({ id: 's', create: () => ({}), update() {} });
    expect(() => collectSystems({ '/a.system.ts': { a: sys, b: sys } })).toThrow(/two systems/);
  });

  test('a behaviour runs for each matching item and moves its instance', () => {
    const { stage, matrices } = fakeStage();
    const signals = createSignals(9);
    const life = createLife(stage, signals, { behaviours: demoBehaviours, systems: [] });
    const t = town((b) => b.house(10, 10).house(14, 10));
    life.sync(t);
    life.update(signals.advance(0.1));
    expect(matrices.size).toBe(2);
    const first = [...matrices.values()][0]!;
    expect(positionOf(first)[1]).toBeGreaterThan(0);
    life.dispose();
  });

  test('state survives a re-resolve while the item id survives; gone items are disposed', () => {
    const { stage } = fakeStage();
    const signals = createSignals(9);
    const log: string[] = [];
    const states = new Map<string, { n: number }>();
    const smoke = defineBehaviour({
      actor: 'smoke',
      create(item) {
        log.push(`create ${item.id}`);
        const state = { n: 0 };
        states.set(item.id, state);
        return state;
      },
      update: (state) => void state.n++,
      changed: (_s, ctx) => void log.push(`changed ${ctx.item.id}`),
      dispose: (_s, ctx) => void log.push(`dispose ${ctx.item.id}`),
    });
    const life = createLife(stage, signals, { behaviours: [smoke], systems: [] });
    const a = key(10, 1, 10);
    const b = key(14, 1, 10);
    life.sync(town((t) => t.house(10, 10).house(14, 10)));
    life.update(0.1);
    life.update(0.1);
    // Between an edit and its dressing nothing is torn down.
    const next = town((t) => t.house(10, 10).house(20, 10));
    life.sync({ shape: next.shape, dressing: null });
    life.update(0.1);
    expect(log).toEqual([`create L-X01.demo-smoke@${a}`, `create L-X01.demo-smoke@${b}`]);
    life.sync(next);
    life.update(0.1);
    expect(states.get(`L-X01.demo-smoke@${a}`)!.n).toBe(4);
    expect(log.slice(2).sort()).toEqual([`create L-X01.demo-smoke@${key(20, 1, 10)}`, `dispose L-X01.demo-smoke@${b}`]);
    life.dispose();
    expect(log.filter((l) => l.startsWith('dispose'))).toHaveLength(3);
  });

  test('systems get every town change with the previous town, then update each frame', () => {
    const { stage } = fakeStage();
    const signals = createSignals(9);
    let state: { syncs: number; changed: number; updates: number } | undefined;
    const census = defineSystem({ ...demoSystems[0]!, create: (ctx) => (state = demoSystems[0]!.create(ctx)) });
    const life = createLife(stage, signals, { behaviours: [], systems: [census] });
    life.sync(town((b) => b.house(10, 10).house(14, 10)));
    expect(state).toEqual({ syncs: 1, changed: 2, updates: 0 });
    life.sync(town((b) => b.house(10, 10).house(14, 10).house(30, 30)));
    expect(state).toEqual({ syncs: 2, changed: 3, updates: 0 }); // only the new house differs
    life.update(0.1);
    expect(state!.updates).toBe(1);
  });
});
