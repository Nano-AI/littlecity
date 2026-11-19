// L29: the door-leaf behaviour, stepped with fixed time steps against a
// recording stage: a shut door is never touched, an open one swings and
// comes back to exactly where it was built, and its glass follows the
// house's windows (lit only while somebody is home).

import { describe, expect, test } from 'vitest';
import { resolveScenario } from '@/scenario';
import peopleTown from '../../../scenarios/people/people-town.scenario';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { setHouseGlow } from '../dusk/occupancy';
import { createDoors } from '../people/doors';
import { recordingStage, step } from '../testing/stage';
import leaf, { doorKeyOf } from './door-leaf.behaviour';
import { setDoorTable } from './table';

function live() {
  const town = resolveScenario(peopleTown);
  const rec = recordingStage(town);
  const signals = createSignals(peopleTown.seed);
  const life = createLife(rec.stage, signals, {
    behaviours: [leaf],
    systems: [],
    onError: (what, error) => {
      throw new Error(`${what}: ${String(error)}`);
    },
  });
  const doors = createDoors();
  setDoorTable(rec.stage, doors);
  life.sync(town);
  return { town, rec, signals, life, doors };
}

describe('door leaves (L29)', () => {
  test('a shut door is never moved; an opened one swings out and comes back to exactly its built frame', () => {
    const { town, rec, signals, life, doors } = live();
    const leaves = town.dressing.actors.filter((a) => a.type === 'door-leaf' && a.variant === 'plain');
    expect(leaves.length).toBeGreaterThan(3);
    step(life, signals, 1);
    const moves = leaves.map((a) => rec.of(a.id).moves);
    step(life, signals, 2);
    // Nobody near: not touched again.
    expect(leaves.map((a) => rec.of(a.id).moves)).toEqual(moves);
    const one = leaves[0]!;
    const key = doorKeyOf(one.at);
    const r = rec.of(one.id);
    for (let i = 0; i < 30; i++) {
      doors.claim(key);
      doors.step(1 / 30);
      step(life, signals, 1 / 30);
    }
    expect(r.matrix).not.toEqual(r.base);
    for (let i = 0; i < 90; i++) {
      doors.step(1 / 30);
      step(life, signals, 1 / 30);
    }
    r.matrix.forEach((v, i) => expect(v).toBeCloseTo(r.base[i]!, 9));
  });

  test("a door's glass is lit as the house's windows are", () => {
    const { town, rec, signals, life } = live();
    const one = town.dressing.actors.find((a) => a.type === 'door-leaf' && a.home !== undefined)!;
    step(life, signals, 0.1);
    expect(rec.of(one.id).params[0]).toBe(1);
    setHouseGlow(rec.stage, one.home!, 0);
    step(life, signals, 0.1);
    expect(rec.of(one.id).params[0]).toBe(0);
    setHouseGlow(rec.stage, one.home!, 0.6);
    step(life, signals, 0.1);
    expect(rec.of(one.id).params[0]).toBe(0.6);
  });
});
