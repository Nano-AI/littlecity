// No two floating things ever overlap, anywhere, at any time: big ships,
// the barge, the tall ship passing, rowboats moored and rowing aside or in,
// the rower, sailboats, the fishing boat, and the stand-ins that row
// departing boats out. Each by its own hull (a line of discs along it), every
// pair, every step, through long runs of real towns: the `everything` town,
// the big harbour, and grown towns on generated islands with rivers.

import { describe, expect, test } from 'vitest';
import { resolveScenario, type Scenario } from '@/scenario';
import everything from '../../../scenarios/core/everything.scenario';
import grown4 from '../../../scenarios/core/grown-town-4.scenario';
import grown5 from '../../../scenarios/core/grown-town-5.scenario';
import grown6 from '../../../scenarios/core/grown-town-6.scenario';
import grown7 from '../../../scenarios/core/grown-town-7.scenario';
import harbourScn from '../../../scenarios/life/ships-harbour.scenario';
import fishing from '../boats/fishing-boat.behaviour';
import rowboat from '../boats/rowboat.behaviour';
import rower from '../boats/rower.behaviour';
import sailboat from '../boats/sailboat.behaviour';
import { createLife } from '../runtime';
import { createSignals, partPhases } from '../signals';
import { recordingStage } from '../testing/stage';
import ferry from './ferry.system';
import harbourSystem from './harbour.system';
import { bigShipsOf, floatsOf, type BigShipNews } from './news';
import { sized } from '../../../tests/helpers/tier';

/** A hull as discs along it. */
function discs(f: BigShipNews): { x: number; z: number; r: number }[] {
  const out = [];
  const sx = Math.sin(f.yaw), cz = Math.cos(f.yaw);
  const len = f.bow - f.stern;
  const n = Math.max(2, Math.ceil(len / 0.25));
  for (let i = 0; i <= n; i++) {
    const a = f.stern + (len * i) / n;
    // The ends are narrower than the middle.
    const u = i / n;
    const w = u < 0.15 || u > 0.85 ? 0.6 : 1;
    out.push({ x: f.x + sx * a, z: f.z + cz * a, r: f.halfBeam * w });
  }
  return out;
}

function gap(a: BigShipNews, b: BigShipNews): number {
  const reach = Math.max(-a.stern, a.bow) + Math.max(-b.stern, b.bow) + a.halfBeam + b.halfBeam;
  if (Math.hypot(a.x - b.x, a.z - b.z) > reach + 1) return Infinity;
  let best = Infinity;
  for (const p of discs(a)) for (const q of discs(b)) best = Math.min(best, Math.hypot(p.x - q.x, p.z - q.z) - p.r - q.r);
  return best;
}

function run(scn: Scenario, seconds: number): { worst: number; where: string; seen: number } {
  const town = resolveScenario(scn);
  const rec = recordingStage(town);
  const signals = createSignals(scn.seed);
  signals.setPhase(partPhases().day.start + 0.02);
  signals.hold('run');
  const life = createLife(rec.stage, signals, { behaviours: [rowboat, sailboat, fishing, rower], systems: [harbourSystem, ferry] });
  life.sync(town);
  let worst = Infinity, where = '', seen = 0;
  for (let t = 0; t < seconds; t += 1 / 20) {
    life.update(signals.advance(1 / 20));
    const all: [string, BigShipNews][] = [...floatsOf(rec.stage), ...bigShipsOf(rec.stage).map((s, i): [string, BigShipNews] => [`big${i}`, s])];
    seen = Math.max(seen, all.length);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const g = gap(all[i]![1], all[j]![1]);
        if (g < worst) {
          worst = g;
          where = `${t.toFixed(1)}s ${all[i]![0]} @${all[i]![1].x.toFixed(1)},${all[i]![1].z.toFixed(1)} and ${all[j]![0]} @${all[j]![1].x.toFixed(1)},${all[j]![1].z.toFixed(1)}`;
        }
      }
    }
  }
  life.dispose();
  return { worst, where, seen };
}

describe('nothing afloat ever overlaps anything else afloat', () => {
  // The gate runs the busiest town, the big harbour and one grown town with rivers; the full run
  // (LC_FULL=1) adds three more grown towns on generated islands.
  test.each(sized([
    ['everything', everything],
    ['ships-harbour', harbourScn],
    ['grown-town-4', grown4],
  ] as const, [
    ['everything', everything],
    ['ships-harbour', harbourScn],
    ['grown-town-4', grown4],
    ['grown-town-5', grown5],
    ['grown-town-6', grown6],
    ['grown-town-7', grown7],
  ] as const))('%s: every pair, every step, for five minutes', (_name, scn) => {
    const { worst, where, seen } = run(scn, 300);
    expect(seen).toBeGreaterThan(3);
    expect(worst, where).toBeGreaterThan(0);
  });
});
