// L64 · the snow day, stepped with fixed time steps: once snow lies deep the
// children come out, build a snowman in stages, split into sides and throw
// snowballs, then go home; the snowman stays until the thaw; none without
// snow or at night; called off cleanly when the square goes; held winter
// keeps giving snow days.

import { describe, expect, test } from 'vitest';
import type { DressingPlan } from '@/resolve/plan';
import { CLEAR, seasonAt, type WeatherSignal } from '../season';
import snowTown from '../../../scenarios/life/L64.snow-day.scenario';
import { clock, scenarioTown, watch, type TestTown } from '../people/testing';
import type { SnowDayChain, SnowPhase } from './chains/snow-day';
import { createLivingTown, type LivingTown } from './index';
import { sized } from '../../../tests/helpers/tier';

const town = scenarioTown(snowTown);
const SNOWY: WeatherSignal = { ...CLEAR, kind: 'snow', snow: 0.2, cloud: 0.8, cover: 0.9 };
const THAW: WeatherSignal = { ...CLEAR, cover: 0.1, thaw: 1 };

function run(where: TestTown, seconds: number, each?: (t: LivingTown, snow: SnowDayChain, s: number) => void, part: 'day' | 'night' = 'day', sky: WeatherSignal = SNOWY, dressing: DressingPlan = where.dressing) {
  const c = clock(where.world.seed, part);
  const t = createLivingTown({ seed: where.world.seed });
  t.sync(where.shape, dressing, c.time);
  t.board.setSky(seasonAt(0.875), sky);
  const w = watch(t.crowd, { maxStuck: 12 });
  const snow = t.board.chains.find((x) => x.id === 'snow') as SnowDayChain;
  for (let i = 0; i < seconds * 30; i++) {
    t.step(c.tick(1 / 30), c.time);
    w.check();
    each?.(t, snow, i / 30);
  }
  return { t, snow, problems: w.problems };
}

describe('L64: the snow day', () => {
  test('they come out, build a snowman, fight it out, and go home; the snowman stays until the thaw', () => {
    const phases: SnowPhase[] = [];
    let most = 0, stage = 0, endedAt = -1, kids = 0;
    const r = run(town, 200, (t, snow, s) => {
      if (phases[phases.length - 1] !== snow.phase) phases.push(snow.phase);
      most = Math.max(most, snow.players.length);
      kids = Math.max(kids, snow.players.filter((p) => p.p.child).length);
      stage = Math.max(stage, ...snow.snowmen.map((m) => m.stage), 0);
      if (endedAt < 0 && phases.includes('fight') && snow.phase === 'none') endedAt = s;
      if (endedAt > 0 && s > endedAt + 50 && s < endedAt + 51) {
        for (const p of t.crowd.people) expect(p.party, `${p.id} still in it`).toBe(false);
        t.board.setSky(t.board.season, THAW);
      }
    });
    expect(r.problems).toEqual([]);
    expect(phases.slice(0, 5)).toEqual(['none', 'gather', 'build', 'fight', 'none']);
    expect(most).toBeGreaterThanOrEqual(4);
    expect(kids).toBeGreaterThanOrEqual(1);
    expect(stage).toBe(5);
    expect(r.snow.thrown).toBeGreaterThan(10);
    // Thawed and gone, in a while.
    expect(r.snow.snowmen.length).toBe(0);
  });

  test('none without snow lying, or at night', () => {
    expect(run(town, 90, undefined, 'day', CLEAR).snow.days).toBe(0);
    expect(run(town, 90, undefined, 'night').snow.days).toBe(0);
  });

  test('the square gone mid-fight: called off, everybody home, the snowman with it', () => {
    const gone: DressingPlan = { ...town.dressing, sockets: town.dressing.sockets.filter((s) => !(s.type === 'errand' && (s.name ?? '').startsWith('snow|'))) };
    let cut = -1;
    const r = run(town, 160, (t, snow, s) => {
      if (cut < 0 && snow.phase === 'fight' && snow.thrown > 2) {
        cut = s;
        t.sync(town.shape, gone, clock(town.world.seed, 'day').time);
      }
    });
    expect(cut).toBeGreaterThan(0);
    expect(r.problems).toEqual([]);
    expect(r.snow.phase).toBe('none');
    expect(r.snow.snowmen.length).toBe(0);
    for (const p of r.t.crowd.people) expect(p.party).toBe(false);
  });

  test('held winter with snow lying keeps giving snow days (the snowman from before stands: straight to the fight)', () => {
    let was: SnowPhase = 'none';
    const starts: SnowPhase[] = [];
    const r = run(town, sized(560, 900), (_t, snow) => {
      if (was === 'gather' && snow.phase !== 'gather') starts.push(snow.phase);
      was = snow.phase;
    });
    expect(r.snow.days).toBeGreaterThanOrEqual(2);
    expect(starts[0]).toBe('build');
    expect(starts[1]).toBe('fight');
    expect(r.snow.snowmen.length).toBe(1);
  });
});
