// A ship bombed alongside (design section 13b): its crew do not vanish with
// it. They go over the side and swim away for open water and the edge of the
// map; the wreckage drifts and goes under; in the end nothing of it is left.

import { expect, test } from 'vitest';
import { resolveScenario } from '@/scenario';
import scn from '../../../scenarios/rules/L38.galleon.scenario';
import { createLife } from '../runtime';
import { createSignals, partPhases } from '../signals';
import { recordingStage } from '../testing/stage';
import harbourSystem from '../ships/harbour.system';
import { harbourOf } from '../ships/visit';
import { mischiefOf } from './director';
import mischiefSystem from './mischief.system';
import shipwreckSystem from './shipwreck.system';

test('a ship bombed alongside: down it goes, its crew over the side and swimming away; nothing left after', () => {
  const town = resolveScenario(scn);
  const rec = recordingStage(town);
  const signals = createSignals(scn.seed);
  signals.setPhase(partPhases().day.start + 0.02);
  signals.hold('run');
  const life = createLife(rec.stage, signals, { behaviours: [], systems: [harbourSystem, mischiefSystem, shipwreckSystem] });
  life.sync(town);
  const harbour = harbourOf(rec.stage)!;
  const d = mischiefOf(rec.stage);
  const step = (s: number): void => {
    for (let t = 0; t < s; t += 1 / 20) {
      life.update(signals.advance(1 / 20));
      d.flush();
    }
  };
  for (let i = 0; i < 600 && !harbour.ships.some((s) => s.phase === 'moored'); i++) step(1);
  const ship = harbour.ships.find((s) => s.phase === 'moored')!;
  const mid = (ship.hull.stern + ship.hull.bow) / 2;
  const x = ship.pose.x + Math.sin(ship.pose.yaw) * mid, z = ship.pose.z + Math.cos(ship.pose.yaw) * mid;
  // On its sea side, right against the hull.
  const off = ship.hull.halfBeam + 0.2;
  d.dropBomb([x - Math.cos(ship.pose.yaw) * off * ship.dir, 1.2, z + Math.sin(ship.pose.yaw) * off * ship.dir]);
  for (let i = 0; i < 100 && ship.phase !== 'sinking'; i++) step(0.1);
  expect(ship.phase).toBe('sinking');
  const swimmers = (): { x: number; z: number; age: number }[] => (globalThis as unknown as { __lcSwimmers: { x: number; z: number; age: number }[] }).__lcSwimmers;
  const crew = swimmers().length;
  expect(crew).toBe(ship.kind === 'galleon' ? 3 : 2);
  const at = swimmers().map((w) => [w.x, w.z]);
  step(6);
  // Swimming: every one of them has moved off.
  swimmers().forEach((w, i) => expect(Math.hypot(w.x - at[i]![0]!, w.z - at[i]![1]!)).toBeGreaterThan(1));
  // In the end: all out of the harbour, the wreckage gone under, nothing of it drawn.
  step(150);
  expect(swimmers().length).toBe(0);
  expect(d.drawn()).toBe(0);
}, 300_000);
