// A big ship in a blast (mischief, design section 13b): at the edge of it
// scorched, closer dismasted (either way it gives up its visit and sails off),
// closest broken: it goes down where it is, under the water, never smaller,
// and its berth is free for the next ship.

import { describe, expect, test } from 'vitest';
import { SEA_Y } from '@/core/grid';
import { resolveScenario } from '@/scenario';
import scn from '../../../scenarios/rules/L38.galleon.scenario';
import { createLife } from '../runtime';
import { createSignals, partPhases } from '../signals';
import { recordingStage } from '../testing/stage';
import harbourSystem from './harbour.system';
import { harbourOf, type Ship } from './visit';

function harbourTown() {
  const town = resolveScenario(scn);
  const rec = recordingStage({ shape: town.shape, dressing: town.dressing });
  const signals = createSignals(scn.seed);
  signals.setPhase(partPhases().day.start + 0.02);
  signals.hold('run');
  const life = createLife(rec.stage, signals, { behaviours: [], systems: [harbourSystem] });
  life.sync({ shape: town.shape, dressing: town.dressing });
  const harbour = harbourOf(rec.stage)!;
  const step = (seconds: number, each?: (s: readonly Ship[]) => void): void => {
    for (let t = 0; t < seconds; t += 1 / 20) {
      life.update(signals.advance(1 / 20));
      each?.(harbour.ships);
    }
  };
  // Until a ship lies alongside.
  for (let i = 0; i < 20 * 600 && !harbour.ships.some((s) => s.phase === 'moored'); i++) step(1 / 20);
  const ship = harbour.ships.find((s) => s.phase === 'moored')!;
  return { harbour, ship, step, rec };
}

/** A point off the ship's sea side, `d` beyond its hull. */
const off = (s: Ship, d: number): [number, number] => {
  const mid = (s.hull.stern + s.hull.bow) / 2;
  const x = s.pose.x + Math.sin(s.pose.yaw) * mid, z = s.pose.z + Math.cos(s.pose.yaw) * mid;
  return [x + Math.cos(s.pose.yaw) * (s.hull.halfBeam + d) * -s.dir, z - Math.sin(s.pose.yaw) * (s.hull.halfBeam + d) * -s.dir];
};

describe('a ship in a blast', () => {
  test('at the edge: scorched, it gives up its visit and sails away', () => {
    const { harbour, ship, step } = harbourTown();
    const [x, z] = off(ship, 2);
    const hits = harbour.strike(x, z, 0.9, 1.6, 2.7);
    expect(hits.map((h) => h.stage)).toEqual([1]);
    const seen = new Set<string>();
    step(120, () => seen.add(ship.phase));
    expect(seen.has('leaving')).toBe(true);
  });

  test('closer: dismasted, and away', () => {
    const { harbour, ship } = harbourTown();
    const [x, z] = off(ship, 1.2);
    expect(harbour.strike(x, z, 0.9, 1.6, 2.7).map((h) => h.stage)).toEqual([2]);
    expect(ship.phase).toBe('moored');
    // A second, lighter blast does nothing more.
    expect(harbour.strike(x, z, 0.1, 0.2, 2.7)).toEqual([]);
  });

  test('closest: it goes down under the water, never smaller, its berth free; another ship calls', () => {
    const { harbour, ship, step, rec } = harbourTown();
    const berth = ship.berth.key;
    const [x, z] = off(ship, 0.3);
    expect(harbour.strike(x, z, 0.9, 1.6, 2.7).map((h) => h.stage)).toEqual([3]);
    expect(ship.phase).toBe('sinking');
    let lowest = Infinity;
    let size = 0;
    step(12, () => {
      if (ship.phase !== 'sinking') return;
      lowest = Math.min(lowest, ship.m[13]!);
      size = Math.max(size, Math.abs(Math.hypot(ship.m[0]!, ship.m[1]!, ship.m[2]!) - 1));
    });
    // Under the water, the same size all the way down; and then gone, its visit over.
    expect(lowest).toBeLessThan(SEA_Y - 3);
    expect(size).toBeLessThan(1e-6);
    expect(ship.phase).toBe('idle');
    expect(harbour.ships.some((s) => s.phase !== 'idle' && s.berth.key === berth)).toBe(false);
    // Nothing of its pieces is left drawn.
    expect(rec.spawned.filter((r) => r.spec && 'actor' in r.spec && r.spec.actor === ship.kind && !r.released && r.visible && r.matrix[13]! > SEA_Y - 3).length).toBeLessThanOrEqual(harbour.ships.filter((s) => s.kind === ship.kind && s.phase !== 'idle').length);
    // In time another ship comes to that berth.
    let called = false;
    step(600, (ships) => {
      called ||= ships.some((s) => s.phase !== 'idle' && s.berth.key === berth);
    });
    expect(called).toBe(true);
  }, 240_000);
});
