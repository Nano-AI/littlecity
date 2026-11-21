// L57 · the wedding, stepped with fixed time steps: the party is dressed for
// it while it lasts and in their own clothes after (they change at home); the
// procession keeps its order and spacing all along its way; the petals are
// swept up; weddings come round (with the time of day held, too); and it is
// called off cleanly when the chapel goes.

import { describe, expect, test } from 'vitest';
import type { DressingPlan } from '@/resolve/plan';
import { isFinery } from '@/parts/people/finery';
import { findScenario } from '@/scenario/discover';
import { WEDDING } from '@/style/town-life';
import weddingTown from '../../../scenarios/life/L57.wedding.scenario';
import { nearestOnTrack } from '../people/track';
import { clock, scenarioTown, watch, type TestTown } from '../people/testing';
import type { WeddingChain, WeddingPhase } from './chains/wedding';
import { createLivingTown, type LivingTown } from './index';
import { sized } from '../../../tests/helpers/tier';

const small = scenarioTown(weddingTown);
let grownTown: TestTown | null = null;
const grown = (): TestTown => (grownTown ??= scenarioTown(findScenario('grown-market')!));

interface Run {
  t: LivingTown;
  wed: WeddingChain;
  problems: string[];
}

/** Steps a town `seconds` at 30 steps a second (the time of day held at `part`), calling `each` every step. */
function run(where: TestTown, seconds: number, each?: (t: LivingTown, wed: WeddingChain, second: number) => void, part: 'day' | 'run' = 'day', dressing: DressingPlan = where.dressing): Run {
  const c = clock(where.world.seed, part);
  const t = createLivingTown({ seed: where.world.seed });
  t.sync(where.shape, dressing, c.time);
  const w = watch(t.crowd, { maxStuck: 12 });
  const wed = t.board.chains.find((x) => x.id === 'wedding') as WeddingChain;
  for (let i = 0; i < seconds * 30; i++) {
    t.step(c.tick(1 / 30), c.time);
    w.check();
    each?.(t, wed, i / 30);
  }
  return { t, wed, problems: w.problems };
}

describe('L57: the wedding', () => {
  test('a whole wedding in a grown town: a big party in finery, a procession in order, home and changed, petals swept', () => {
    const phases: WeddingPhase[] = [];
    let party = 0;
    const roles = new Set<string>();
    const badOrder: string[] = [];
    let marched = 0;
    let longest = 0;
    let undressedInParty = 0;
    let mostLying = 0;
    let watchers = 0;
    let endedAt = -1;
    const r = run(grown(), 600, (t, wed, s) => {
      if (phases[phases.length - 1] !== wed.phase) phases.push(wed.phase);
      if (wed.phase !== 'none') {
        party = Math.max(party, wed.members.length);
        for (const m of wed.members) roles.add(m.role);
      } else if (phases.includes('celebrate') && endedAt < 0) endedAt = s;
      mostLying = Math.max(mostLying, wed.petals?.lying ?? 0);
      // In it, in the guard or the column, they are in their finery.
      for (const m of wed.members) if (!m.lost && m.p.visible && (m.joined || m.p.goal?.errand?.tag === 'wedding:wait') && !isFinery(m.p.costume)) undressedInParty++;
      if (wed.phase === 'procession' && wed.track) {
        watchers += t.crowd.people.filter((p) => !p.party && p.startled > 0 && p.admire).length;
        // Rows in order along the way, a row's gap apart (the last row first in, the first last out).
        const rows = new Map<number, number[]>();
        for (const m of wed.members) {
          if (m.lost || !m.joined || m.join < 1 || m.row < 0) continue;
          const at = nearestOnTrack(wed.track, m.p.x, m.p.z);
          rows.set(m.row, [...(rows.get(m.row) ?? []), at]);
        }
        const keys = [...rows.keys()].sort((a, b) => a - b);
        if (keys.length >= 3) marched++;
        longest = Math.max(longest, keys.length);
        for (let i = 1; i < keys.length; i++) {
          const a = Math.min(...rows.get(keys[i - 1]!)!), b = Math.max(...rows.get(keys[i]!)!);
          const gap = (a - b) / (keys[i]! - keys[i - 1]!);
          if ((gap < WEDDING.spacing - 0.18 || gap > WEDDING.spacing + 0.18) && badOrder.length < 5) badOrder.push(`${s.toFixed(1)} s: rows ${keys[i - 1]} and ${keys[i]} ${gap.toFixed(2)} apart`);
        }
      }
    });
    expect(r.problems).toEqual([]);
    expect(phases.slice(0, 7)).toEqual(['none', 'gather', 'vows', 'out', 'procession', 'celebrate', 'none']);
    expect(party).toBeGreaterThanOrEqual(14);
    for (const role of ['bride', 'groom', 'usher', 'maid', 'guest', 'priest']) expect(roles.has(role), role).toBe(true);
    expect(undressedInParty).toBe(0);
    expect(marched).toBeGreaterThan(30 * 20);
    expect(longest).toBeGreaterThanOrEqual(6);
    expect(badOrder).toEqual([]);
    expect(watchers).toBeGreaterThan(0);
    expect(mostLying).toBeGreaterThan(150);
    // Long over: everybody is home and changed, and the way is swept.
    expect(endedAt).toBeGreaterThan(0);
    for (const p of r.t.crowd.people) {
      expect(isFinery(p.costume), `${p.id} still dressed (${p.mode}, ${p.goal?.errand?.tag})`).toBe(false);
      expect(p.party).toBe(false);
    }
    expect(r.wed.petals?.lying ?? 0).toBe(0);
  });

  test('a small town: a smaller party, still the whole thing, and nothing left lying', () => {
    const phases: WeddingPhase[] = [];
    let party = 0;
    const r = run(small, 560, (_t, wed) => {
      if (phases[phases.length - 1] !== wed.phase) phases.push(wed.phase);
      party = Math.max(party, wed.members.length);
    });
    expect(r.problems).toEqual([]);
    expect(phases).toContain('celebrate');
    expect(party).toBeGreaterThanOrEqual(4);
    expect(party).toBeLessThanOrEqual(WEDDING.party);
    for (const p of r.t.crowd.people) expect(isFinery(p.costume)).toBe(false);
  });

  test('the chapel erased mid-procession: called off, everybody walks home and changes, nobody leaves the graph', () => {
    const gone: DressingPlan = { ...small.dressing, sockets: small.dressing.sockets.filter((s) => !(s.type === 'errand' && (s.name ?? '').startsWith('wedding|'))) };
    let cut = -1;
    const r = run(small, 300, (t, wed, s) => {
      if (cut < 0 && wed.phase === 'procession' && wed.head > 1.5) {
        cut = s;
        t.sync(small.shape, gone, clock(small.world.seed, 'day').time);
      }
    });
    expect(cut).toBeGreaterThan(0);
    expect(r.problems).toEqual([]);
    expect(r.wed.phase).toBe('none');
    for (const p of r.t.crowd.people) {
      expect(isFinery(p.costume)).toBe(false);
      expect(p.party).toBe(false);
    }
  });

  test('the chapel gone while the guests gather: called off before it begins, and no wedding comes after', () => {
    const gone: DressingPlan = { ...small.dressing, sockets: small.dressing.sockets.filter((s) => !(s.type === 'errand' && (s.name ?? '').startsWith('wedding|'))) };
    let cut = false;
    const r = run(small, 200, (t, wed) => {
      if (!cut && wed.phase === 'gather' && wed.members.some((m) => isFinery(m.p.costume))) {
        cut = true;
        t.sync(small.shape, gone, clock(small.world.seed, 'day').time);
      }
    });
    expect(cut).toBe(true);
    expect(r.problems).toEqual([]);
    expect(r.wed.held).toBe(1);
    expect(r.wed.calledOff).toBe(1);
    for (const p of r.t.crowd.people) expect(isFinery(p.costume)).toBe(false);
  });

  test('cadence: the first within a minute of the town being seen, then again every few minutes, with the time of day held', () => {
    const starts: number[] = [];
    let was: WeddingPhase = 'none';
    const r = run(
      small,
      sized(900, 1800),
      (_t, wed, s) => {
        if (was === 'none' && wed.phase === 'gather') starts.push(s);
        was = wed.phase;
      },
      'day',
    );
    expect(r.problems).toEqual([]);
    expect(starts[0]).toBeGreaterThanOrEqual(WEDDING.first);
    expect(starts[0]).toBeLessThanOrEqual(WEDDING.first + WEDDING.firstSpread + 1);
    expect(starts.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < starts.length; i++) {
      const gap = starts[i]! - starts[i - 1]!;
      expect(gap).toBeGreaterThan(WEDDING.every);
      expect(gap).toBeLessThan(WEDDING.every + WEDDING.everySpread + WEDDING.most);
    }
  });

  test('never at night', () => {
    const c = clock(small.world.seed, 'night');
    const t = createLivingTown({ seed: small.world.seed });
    t.sync(small.shape, small.dressing, c.time);
    const wed = t.board.chains.find((x) => x.id === 'wedding') as WeddingChain;
    for (let i = 0; i < 120 * 30; i++) t.step(c.tick(1 / 30), c.time);
    expect(wed.held).toBe(0);
  });
});
