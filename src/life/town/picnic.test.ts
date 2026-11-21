// L66 · picnics, stepped with fixed time steps: blankets carried out and
// spread, people sit round them, children chase, then everything carried
// home; none in winter or rain; rain packs it up; held spring keeps giving
// picnics; the grass built over calls it off.

import { describe, expect, test } from 'vitest';
import type { DressingPlan } from '@/resolve/plan';
import { CLEAR, seasonAt, type SeasonSignal, type WeatherSignal } from '../season';
import picnicTown from '../../../scenarios/life/L66.picnic.scenario';
import { clock, scenarioTown, watch, type TestTown } from '../people/testing';
import type { PicnicChain } from './chains/picnic';
import { createLivingTown, type LivingTown } from './index';
import { sized } from '../../../tests/helpers/tier';

const town = scenarioTown(picnicTown);
const SPRING = seasonAt(0.125);
const RAIN: WeatherSignal = { ...CLEAR, kind: 'rain', rain: 0.8, cloud: 1 };

function run(where: TestTown, seconds: number, each?: (t: LivingTown, pc: PicnicChain, at: number) => void, season: SeasonSignal = SPRING, part: 'day' | 'night' = 'day', dressing: DressingPlan = where.dressing) {
  const c = clock(where.world.seed, part);
  const t = createLivingTown({ seed: where.world.seed });
  t.sync(where.shape, dressing, c.time);
  t.board.setSky(season, CLEAR);
  const w = watch(t.crowd, { maxStuck: 12 });
  const pc = t.board.chains.find((x) => x.id === 'picnic') as PicnicChain;
  for (let i = 0; i < seconds * 30; i++) {
    t.step(c.tick(1 / 30), c.time);
    w.check();
    each?.(t, pc, i / 30);
  }
  return { t, pc, problems: w.problems };
}

const putAway = (t: LivingTown): void => {
  for (const p of t.crowd.people) {
    expect(p.party, p.id).toBe(false);
    expect(p.load === 'hamper' || (p.load ?? '').startsWith('blanket-'), `${p.id} holds ${p.load}`).toBe(false);
  }
};

describe('L66: picnics', () => {
  test('blankets carried out and spread, sat round, children chasing, all carried home', () => {
    let spread = 0, sitting = 0, running = 0, ended = -1;
    const r = run(town, 380, (t, pc, at) => {
      spread = Math.max(spread, pc.spread);
      sitting = Math.max(sitting, pc.picnickers.filter((k) => k.p.pose === 'sit').length);
      running += pc.picnickers.some((k) => k.role === 'child' && k.state === 'stay' && k.p.pose === 'run') ? 1 : 0;
      if (ended < 0 && pc.held > 0 && !pc.on) ended = at;
      if (ended > 0 && at > ended + 100 && at < ended + 100 + 1 / 30) putAway(t);
    });
    expect(r.problems).toEqual([]);
    expect(spread).toBeGreaterThanOrEqual(2);
    expect(sitting).toBeGreaterThanOrEqual(2);
    expect(running).toBeGreaterThan(0);
    expect(ended).toBeGreaterThan(0);
  });

  test('none in winter, at night or in the rain', () => {
    expect(run(town, 80, undefined, seasonAt(0.875)).pc.held).toBe(0);
    expect(run(town, 80, undefined, SPRING, 'night').pc.held).toBe(0);
    expect(run(town, 80, (t, _p, at) => at === 0 && t.board.setSky(SPRING, RAIN)).pc.held).toBe(0);
  });

  test('rain packs it up and everything goes home', () => {
    let rained = -1;
    const r = run(town, 160, (t, pc, at) => {
      if (rained < 0 && pc.spread >= 1) {
        rained = at;
        t.board.setSky(SPRING, RAIN);
      }
    });
    expect(rained).toBeGreaterThan(0);
    expect(r.problems).toEqual([]);
    expect(r.pc.on).toBe(false);
    putAway(r.t);
  });

  test('held spring keeps giving picnics', () => {
    expect(run(town, sized(560, 900)).pc.held).toBeGreaterThanOrEqual(2);
  });

  test('the grass built over: called off, everybody home', () => {
    const gone: DressingPlan = { ...town.dressing, sockets: town.dressing.sockets.filter((s) => !(s.type === 'errand' && (s.name ?? '').startsWith('picnic|'))) };
    let cut = -1;
    const r = run(town, 150, (t, pc, at) => {
      if (cut < 0 && pc.spread >= 1) {
        cut = at;
        t.sync(town.shape, gone, clock(town.world.seed, 'day').time);
      }
    });
    expect(cut).toBeGreaterThan(0);
    expect(r.problems).toEqual([]);
    expect(r.pc.spread).toBe(0);
    putAway(r.t);
  });
});
