// L65 · the harvest supper, stepped with fixed time steps: tables carried in
// and set up, lanterns hung, guests bring dishes and sit, a toast, then
// everything carried home; with the time running it comes once, late in the
// day; held at dusk it keeps coming; none in summer or rain; called off
// cleanly when the square goes.

import { describe, expect, test } from 'vitest';
import type { DressingPlan } from '@/resolve/plan';
import { CLEAR, seasonAt, type WeatherSignal } from '../season';
import supperTown from '../../../scenarios/life/L65.supper.scenario';
import { clock, scenarioTown, watch, type TestTown } from '../people/testing';
import type { SupperChain, SupperPhase } from './chains/supper';
import { createLivingTown, type LivingTown } from './index';

const town = scenarioTown(supperTown);
const AUTUMN = seasonAt(0.625);
const RAIN: WeatherSignal = { ...CLEAR, kind: 'rain', rain: 0.8, cloud: 1 };

function run(where: TestTown, seconds: number, each?: (t: LivingTown, s: SupperChain, at: number) => void, part: 'day' | 'dusk' | 'night' | 'run' = 'dusk', season = AUTUMN, dressing: DressingPlan = where.dressing) {
  const c = clock(where.world.seed, part === 'run' ? 'day' : part);
  if (part === 'run') {
    c.hold('run');
  }
  const t = createLivingTown({ seed: where.world.seed });
  t.sync(where.shape, dressing, c.time);
  t.board.setSky(season, CLEAR);
  const w = watch(t.crowd, { maxStuck: 12 });
  const sup = t.board.chains.find((x) => x.id === 'supper') as SupperChain;
  for (let i = 0; i < seconds * 30; i++) {
    t.step(c.tick(1 / 30), c.time);
    w.check();
    each?.(t, sup, i / 30);
  }
  return { t, sup, problems: w.problems };
}

describe('L65: the harvest supper', () => {
  test('tables carried in, lanterns up, dishes brought, a toast, and everything carried home', () => {
    const phases: SupperPhase[] = [];
    let tables = 0, lit = false, seated = 0, talk = 0, toast = 0;
    const loads = new Set<string>();
    const r = run(town, 260, (t, sup) => {
      if (phases[phases.length - 1] !== sup.phase) phases.push(sup.phase);
      tables = Math.max(tables, sup.tablesUp);
      lit ||= sup.lanterns;
      seated = Math.max(seated, sup.diners.filter((d) => d.state === 'seated' && d.p.pose === 'sit').length);
      for (const d of sup.diners) if (d.p.load) loads.add(d.p.load);
      talk += sup.diners.filter((d) => d.p.bubble).length > 0 ? 1 : 0;
      toast = Math.max(toast, sup.diners.filter((d) => d.p.pose === 'cheer').length);
      void t;
    });
    expect(r.problems).toEqual([]);
    expect(phases.slice(0, 5)).toEqual(['none', 'setup', 'supper', 'pack', 'none']);
    expect(tables).toBeGreaterThanOrEqual(3);
    expect(lit).toBe(true);
    expect(seated).toBeGreaterThanOrEqual(8);
    for (const l of ['trestle', 'lantern-pole']) expect(loads.has(l), l).toBe(true);
    expect(talk).toBeGreaterThan(30);
    expect(toast).toBeGreaterThanOrEqual(6);
    expect(r.sup.toasts).toBe(1);
    // Long over: nothing left up, nobody in it.
    expect(r.sup.tablesUp).toBe(0);
    expect(r.sup.lanterns).toBe(false);
    for (const p of r.t.crowd.people) {
      expect(p.party, p.id).toBe(false);
      expect(p.load === 'trestle' || p.load === 'lantern-pole').toBe(false);
    }
  });

  test('none in summer, in the rain or at night', () => {
    expect(run(town, 90, undefined, 'dusk', seasonAt(0.375)).sup.held).toBe(0);
    expect(run(town, 90, undefined, 'night').sup.held).toBe(0);
    expect(run(town, 90, (t, _s, at) => at === 0 && t.board.setSky(AUTUMN, RAIN)).sup.held).toBe(0);
  });

  test('held at dusk it keeps coming; with the time running, once, late in the day', () => {
    expect(run(town, 600).sup.held).toBeGreaterThanOrEqual(2);
    const starts: number[] = [];
    let was: SupperPhase = 'none';
    run(town, 480, (t, s, at) => {
      if (was === 'none' && s.phase === 'setup') starts.push(at);
      was = s.phase;
      void t;
    }, 'run');
    expect(starts.length).toBe(1);
  });

  test('the square gone at supper: called off, the tables go, everybody home', () => {
    const gone: DressingPlan = { ...town.dressing, sockets: town.dressing.sockets.filter((s) => !(s.type === 'errand' && (s.name ?? '').startsWith('supper|'))) };
    let cut = -1;
    const r = run(town, 160, (t, s, at) => {
      if (cut < 0 && s.phase === 'supper') {
        cut = at;
        t.sync(town.shape, gone, clock(town.world.seed, 'dusk').time);
      }
    });
    expect(cut).toBeGreaterThan(0);
    expect(r.problems).toEqual([]);
    expect(r.sup.tablesUp).toBe(0);
    for (const p of r.t.crowd.people) expect(p.party).toBe(false);
  });
});
