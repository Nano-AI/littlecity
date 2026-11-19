// L14 sparrows and L15 characters on their fixture, at fixed steps.

import { describe, expect, test } from 'vitest';
import { key, SEA_Y } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import { resolveScenario } from '@/scenario';
import scn from '../../../scenarios/rules/L15.characters.scenario';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { recordingStage, step } from '../testing/stage';
import characters, { SPARROW_AWAY } from './characters.behaviour';
import scare from './scare.system';

function live() {
  const town = resolveScenario(scn);
  const rec = recordingStage(town);
  const signals = createSignals(scn.seed);
  const life = createLife(rec.stage, signals, { behaviours: [characters], systems: [scare] });
  life.sync(town);
  signals.hold('day');
  const birds = town.dressing.actors.filter((a) => a.type === 'small-bird');
  const of = (v: string) => birds.filter((a) => a.variant === v);
  const pos = (id: string) => positionOf(rec.of(id).matrix);
  return { town, rec, signals, life, of, pos };
}

describe('sparrows (L14) and characters (L15)', () => {
  test('everyone keeps to their place; the owl is out only at night; the ducklings follow the duck on the water', () => {
    const { rec, signals, life, of, pos } = live();
    for (let k = 0; k < 40; k++) {
      step(life, signals, 0.5, 20);
      for (const v of ['sparrow', 'dove', 'stork', 'crow']) {
        for (const a of of(v)) {
          const [x, y, z] = pos(a.id);
          const [bx, by, bz] = positionOf(rec.of(a.id).base);
          expect(Math.hypot(x - bx, z - bz), `${v} near its place`).toBeLessThan(v === 'dove' ? 1.8 : 0.7);
          expect(y).toBeGreaterThanOrEqual(by - 1e-6);
        }
      }
      for (const a of of('duck')) expect(pos(a.id)[1]).toBeCloseTo(SEA_Y, 1);
    }
    const owl = of('owl')[0]!;
    expect(rec.of(owl.id).visible).toBe(false);
    signals.hold('night');
    step(life, signals, 0.5);
    expect(rec.of(owl.id).visible).toBe(true);
    const ducklings = rec.spawned.filter((r) => r.spec && 'actor' in r.spec && r.spec.variant === 'duckling');
    expect(ducklings).toHaveLength(3);
    const duck = pos(of('duck')[0]!.id);
    for (const d of ducklings) expect(Math.hypot(positionOf(d.matrix)[0] - duck[0], positionOf(d.matrix)[2] - duck[2])).toBeLessThan(0.8);
  });

  test('a block landing near puts the sparrows up, and they are back down a few seconds later', () => {
    const { signals, life, of, pos } = live();
    step(life, signals, 1);
    const sp = of('sparrow')[0]!;
    const [x, y, z] = pos(sp.id);
    signals.emit('blockLanded', key(Math.floor(x) + 1, 1, Math.floor(z)));
    step(life, signals, SPARROW_AWAY * 0.4);
    expect(pos(sp.id)[1]).toBeGreaterThan(y + 0.5);
    step(life, signals, SPARROW_AWAY * 0.8);
    expect(pos(sp.id)[1]).toBeLessThan(y + 0.08);
  });
});
