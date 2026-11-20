// The barge and the bridges (L41): it passes under a bridge only where it
// truly fits, and nothing it sweeps ever touches a bridge. A river one, two
// and three columns wide, crossed by a bridge of every span from the river's
// width to six, at the water (an arch, its opening a quarter storey high),
// one storey up (a deck at the bank's level: under it less than half a
// storey) and two storeys up (more than a storey clear). The barge stands
// half a storey out of the water with its load, the bargeman a little more.
//
// Checked twice: the run the rule plans (its hull swept along the route),
// and the barge itself, poled up and down for five minutes, every step.

import { describe, expect, test } from 'vitest';
import { CELL_H, columnIndex, keyX, keyY, keyZ, SEA_Y } from '@/core/grid';
import { hullSize } from '@/rules/life/berths.fact';
import { bargeRun, type RiverRun } from '@/rules/life/L41.river-barge.rule';
import { resolveScenario, scenario, type ResolvedScenario } from '@/scenario';
import { createLife } from '../runtime';
import { createSignals, partPhases } from '../signals';
import { recordingStage } from '../testing/stage';
import harbourSystem from './harbour.system';
import { bigShipsOf } from './news';

const HULL = hullSize('barge');
/** How high the barge stands out of the water, the bargeman at his pole included (world units). */
const TOP = 0.7;

/** A river `w` wide running north to the sea, a dock at each end, a bridge `span` long across it at level `y`. */
function town(w: number, span: number, y: number) {
  const x0 = 21;
  const b0 = x0 - Math.floor((span - w) / 2);
  return scenario({
    name: `barge-bridge-${w}-${span}-${y}`,
    seed: 4100 + w * 100 + span * 10 + y,
    about: 'test',
    terrain(t) {
      t.flat(1);
      t.water(4, 36, 43, 43);
      t.water(x0, 4, x0 + w - 1, 35);
    },
    build(b) {
      for (let z = 9; z <= 10; z++) b.block('dock', x0, 0, z);
      for (let z = 26; z <= 27; z++) b.block('dock', x0 + w - 1, 0, z);
      b.path(x0 - 3, 9, x0 - 1, 9).path(x0 + w, 27, x0 + w + 3, 27);
      for (let x = b0; x < b0 + span; x++) {
        const wet = x >= x0 && x < x0 + w;
        b.block('arch', x, wet ? y : Math.max(1, y), 18);
      }
    },
  });
}

/** Columns the barge must keep out of: anything at the water or one storey up, or higher but too low to pass under. */
function lowColumns(t: ResolvedScenario): Set<number> {
  const out = new Set<number>();
  for (const c of t.shape.facts.kinds.keys()) {
    if (t.shape.terrain.height[columnIndex(keyX(c), keyZ(c))] !== 0) continue;
    // Whatever an arch's opening, its underside is never below the cell's foot.
    if (keyY(c) * CELL_H - SEA_Y < TOP) out.add(columnIndex(keyX(c), keyZ(c)));
  }
  return out;
}

/** The columns a hull (stern to bow, half beam wide) at (x, z) heading `yaw` covers any of. */
function hullTouches(x: number, z: number, yaw: number, low: Set<number>): boolean {
  const sx = Math.sin(yaw), cz = Math.cos(yaw);
  for (let a = HULL.stern; a <= HULL.bow + 1e-6; a += 0.1) {
    for (let k = -HULL.halfBeam; k <= HULL.halfBeam + 1e-6; k += HULL.halfBeam / 3) {
      const px = x + sx * a + cz * k, pz = z + cz * a - sx * k;
      if (low.has(columnIndex(Math.floor(px), Math.floor(pz)))) return true;
    }
  }
  return false;
}

/** The planned run swept by the hull: every 0.1 along it. */
function runTouches(run: RiverRun, low: Set<number>): boolean {
  const r = run.route;
  for (let i = 1; i < r.length; i++) {
    const [ax, az] = r[i - 1]!, [bx, bz] = r[i]!;
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    for (let s = 0; s <= len; s += 0.1) if (hullTouches(ax + ((bx - ax) * s) / len, az + ((bz - az) * s) / len, yaw, low)) return true;
  }
  return false;
}

const CASES: [number, number, number][] = [];
for (const w of [1, 2, 3]) for (let span = w; span <= 6; span++) for (const y of [0, 1, 2]) CASES.push([w, span, y]);

describe('the barge and the bridges', () => {
  test.each(CASES)('river %i wide, bridge span %i at level %i: the run never touches the bridge', (w, span, y) => {
    const t = resolveScenario(town(w, span, y));
    const run = bargeRun(t.shape.facts);
    const low = lowColumns(t);
    if (run) expect(runTouches(run, low)).toBe(false);
    // A bridge at the water or one storey up shuts the river: no run passes it.
    if (run && y <= 1) expect(run.route.every(([, z]) => z < 18) || run.route.every(([, z]) => z > 19)).toBe(true);
    // Two storeys up there is room under it, the mast lowered: a river wide enough for the barge has its run.
    if (y === 2 && w === 3) expect(run, 'a run under the high bridge').not.toBeNull();
  });

  test.each([
    [3, 3, 2],
    [3, 5, 2],
    [3, 4, 1],
    [3, 3, 0],
  ])('river %i wide, span %i at level %i: the barge itself, every step for five minutes', (w, span, y) => {
    const scn = town(w, span, y);
    const t = resolveScenario(scn);
    const low = lowColumns(t);
    const rec = recordingStage(t);
    const signals = createSignals(scn.seed);
    signals.setPhase(partPhases().day.start + 0.02);
    signals.hold('run');
    const life = createLife(rec.stage, signals, { behaviours: [], systems: [harbourSystem] });
    life.sync(t);
    let seen = 0, under = 0;
    for (let s = 0; s < 300; s += 1 / 20) {
      life.update(signals.advance(1 / 20));
      for (const b of bigShipsOf(rec.stage)) {
        if (b.halfBeam !== HULL.halfBeam) continue;
        seen++;
        expect(hullTouches(b.x, b.z, b.yaw, low), `barge at ${b.x.toFixed(2)},${b.z.toFixed(2)} yaw ${b.yaw.toFixed(2)} at ${s.toFixed(1)}s`).toBe(false);
        if (Math.floor(b.z) === 18) under++;
      }
    }
    life.dispose();
    if (y === 2) {
      expect(seen).toBeGreaterThan(0);
      expect(under, 'it passes under the high bridge').toBeGreaterThan(0);
    }
  });
});
