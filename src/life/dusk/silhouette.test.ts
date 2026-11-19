// L07: silhouettes in lit windows, stepped through a held night and a
// running one on the everything town: only ever in a window whose house is
// lit on a storey that is awake, never more than a few at once, the same
// every run.

import { describe, expect, test } from 'vitest';
import { resolveScenario } from '@/scenario';
import everything from '../../../scenarios/core/everything.scenario';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { recordingStage } from '../testing/stage';
import { houseDarkOf, houseGlowOf } from './occupancy';
import silhouettes, { actAt, PANE, SILHOUETTES } from './silhouette.system';
import windowLight from './window-light.behaviour';

type Slots = { slots: { window: { socket: string; house: number; storey: number } | null; shown: boolean }[] };

function night(run: 'night' | 'run', seconds: number) {
  const town = resolveScenario(everything);
  const rec = recordingStage(town);
  const signals = createSignals(everything.seed);
  const life = createLife(rec.stage, signals, { behaviours: [windowLight], systems: [silhouettes] });
  life.sync(town);
  if (run === 'night') signals.hold('night');
  else {
    signals.hold('dusk');
    signals.hold('run');
  }
  const seen: string[] = [];
  let most = 0;
  let shown = 0;
  const problems: string[] = [];
  for (let i = 0; i < seconds * 30; i++) {
    life.update(signals.advance(1 / 30));
    const state = (globalThis as { __lcSilhouettes?: Slots }).__lcSilhouettes!;
    const visible = rec.spawned.filter((s) => !s.released && s.visible && s.matrix.some((v) => v !== 0));
    most = Math.max(most, visible.length);
    for (const slot of state.slots) {
      if (!slot.shown) continue;
      const w = slot.window!;
      const level = houseGlowOf(rec.stage, w.house), dark = houseDarkOf(rec.stage, w.house);
      if ((level < 0.98 || w.storey < dark) && problems.length < 5) problems.push(`${w.socket} shown with level ${level}, storey ${w.storey} < dark ${dark}`);
    }
    if (visible.length > 0) shown++;
    if (i % 30 === 0) seen.push(state.slots.map((s) => s.window?.socket ?? '-').join(','));
  }
  return { problems, most, shown, seen };
}

describe('silhouettes at lit windows (L07)', () => {
  test('an act never spills over the pane: the figure stays inside it, the curtain covers at most half', () => {
    for (const act of ['cross', 'pause', 'curtain'] as const) {
      for (const side of [1, -1] as const) {
        for (let t = 0; t < 7; t += 0.05) {
          const a = actAt(act, t, side);
          if (a.done) break;
          expect(Math.abs(a.fx) + a.fw / 2).toBeLessThanOrEqual(PANE.x + 1e-9);
          expect(a.cw).toBeLessThanOrEqual(PANE.x + 1e-9);
        }
      }
    }
  });

  test('a held night: a few at a time, each only in a lit window on a storey still awake', () => {
    const r = night('night', 60);
    expect(r.problems).toEqual([]);
    expect(r.shown).toBeGreaterThan(30 * 10);
    expect(r.most).toBeLessThanOrEqual(SILHOUETTES.slots * 2);
  });

  test('a running evening into the night: the same, while houses go to bed under them', () => {
    const r = night('run', 150);
    expect(r.problems).toEqual([]);
    expect(r.shown).toBeGreaterThan(0);
  });

  test('the same night twice is the same night', () => {
    expect(night('night', 20).seen).toEqual(night('night', 20).seen);
  });
});
