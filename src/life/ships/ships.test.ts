// The big ships' visits (L38–L40), stepped with a fixed clock against a
// recording stage: never through land, docks or another boat; alongside the
// quay at the end; a visit completes and comes round again; a berth taken
// away mid-visit ends it cleanly; the same town and clock give the same
// visits.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import type { World } from '@/core/world';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { hullSize } from '@/rules/life/berths.fact';
import { hullClear, obstacleColumns, seaField } from '@/rules/life/ship-routes';
import { resolveScenario } from '@/scenario';
import { applyEdit } from '@/world/world';
import scn from '../../../scenarios/rules/L38.galleon.scenario';
import { createLife } from '../runtime';
import { createSignals, partPhases } from '../signals';
import { recordingStage } from '../testing/stage';
import harbourSystem from './harbour.system';
import { harbourOf, type Ship } from './visit';
import { angleDelta } from '../motion/ease';

type Town = ReturnType<typeof resolveScenario>;

const fields = new WeakMap<object, ReturnType<typeof seaField>>();
/** Land and every built column (no margins): what a hull must never touch. */
function solid(shape: Town['shape']): ReturnType<typeof seaField> {
  let f = fields.get(shape);
  if (!f) fields.set(shape, (f = seaField(obstacleColumns(shape.terrain, shape.kinds))));
  return f;
}

function townOf(world: World, base: Town): { shape: Town['shape']; dressing: Town['dressing'] } {
  const shape = resolveShape(world, base.terrain);
  return { shape, dressing: resolveDressing(shape) };
}

/** The L38 town with its quay cut short (no berth), and the full one. */
function towns(): { full: Town; bare: { shape: Town['shape']; dressing: Town['dressing'] }; world: World } {
  const full = resolveScenario(scn);
  let w = full.world;
  for (let x = 20; x <= 27; x++) w = applyEdit(w, full.terrain, { type: 'eraseBlock', cell: key(x, 0, 27) });
  return { full, bare: townOf(w, full), world: full.world };
}

function run(opts: { start: 'bare' | 'full'; seconds: number; edits?: { at: number; erase: [number, number, number][] }[]; onStep?: (t: number, ships: readonly Ship[], town: Town['shape']) => void }) {
  const { full, bare } = towns();
  const rec = recordingStage(opts.start === 'bare' ? bare : full);
  const signals = createSignals(scn.seed);
  signals.setPhase(partPhases().day.start + 0.02);
  signals.hold('run');
  const life = createLife(rec.stage, signals, { behaviours: [], systems: [harbourSystem] });
  let current = opts.start === 'bare' ? bare : { shape: full.shape, dressing: full.dressing };
  life.sync(current);
  if (opts.start === 'bare') {
    // A few seconds of the bare town, then the quay is built.
    for (let i = 0; i < 60; i++) life.update(signals.advance(1 / 20));
    current = { shape: full.shape, dressing: full.dressing };
    rec.setTown(current.shape, current.dressing);
    life.sync(current);
  }
  const harbour = harbourOf(rec.stage)!;
  let world = full.world;
  const dt = 1 / 20;
  const edits = [...(opts.edits ?? [])];
  for (let t = 0; t < opts.seconds; t += dt) {
    if (edits.length && t >= edits[0]!.at) {
      const e = edits.shift()!;
      for (const [x, y, z] of e.erase) world = applyEdit(world, full.terrain, { type: 'eraseBlock', cell: key(x, y, z) });
      current = townOf(world, full);
      rec.setTown(current.shape, current.dressing);
      life.sync(current);
    }
    life.update(signals.advance(dt));
    opts.onStep?.(t, harbour.ships, current.shape);
  }
  return { harbour, rec, signals };
}

describe('big ships (L38–L40)', () => {
  test('the first ship comes over the horizon soon after the berth is built, and comes alongside parallel to the quay', () => {
    let appeared = -1, moored = -1;
    let worstYaw = 0, worstGap = 0;
    run({
      start: 'bare',
      seconds: 150,
      onStep(t, ships) {
        for (const s of ships) {
          if (s.phase === 'arriving' && appeared < 0) appeared = t;
          if (s.phase === 'moored' && moored < 0) moored = t;
          if (s.phase === 'moored') {
            worstYaw = Math.max(worstYaw, Math.abs(angleDelta(s.pose.yaw, s.mooring.yaw)));
            // The side lies `alongside` off the quay face.
            const f = s.berth.face;
            const d = (s.pose.x - f.ax) * f.ox + (s.pose.z - f.az) * f.oz - s.hull.halfBeam;
            worstGap = Math.max(worstGap, Math.abs(d - 0.14));
          }
        }
      },
    });
    expect(appeared).toBeGreaterThanOrEqual(0);
    expect(appeared).toBeLessThan(25);
    expect(moored).toBeGreaterThan(appeared);
    expect(moored).toBeLessThan(110);
    expect(worstYaw).toBeLessThan(0.01);
    expect(worstGap).toBeLessThan(0.02);
  });

  test('never touches land, a dock or a pier at any step; a visit completes and comes round again', () => {
    const hits: string[] = [];
    const phases: string[] = [];
    run({
      start: 'full',
      seconds: 700,
      onStep(t, ships, shape) {
        const field = solid(shape);
        for (const s of ships) {
          if (phases[phases.length - 1] !== `${s.kind}:${s.phase}`) phases.push(`${s.kind}:${s.phase}`);
          if (!s.body || s.scale < 0.98) continue;
          if (!hullClear(field, hullSize(s.kind as 'galleon'), s.pose.x, s.pose.z, s.pose.yaw, 0.0)) hits.push(`${t.toFixed(1)} ${s.kind} ${s.phase} ${s.pose.x.toFixed(2)},${s.pose.z.toFixed(2)} yaw ${s.pose.yaw.toFixed(2)} swing ${s.voyage?.swing} m ${JSON.stringify(s.mooring)} t ${s.t.toFixed(2)}`);
        }
      },
    });
    expect(hits.slice(0, 8).join(' | ')).toBe('');
    // Opened with the galleon in; it leaves, and later a ship comes in again.
    expect(phases[0]).toBe('galleon:moored');
    const left = phases.indexOf('galleon:leaving');
    expect(left).toBeGreaterThan(0);
    expect(phases.slice(left).some((p) => p.endsWith(':moored'))).toBe(true);
  });

  test('two ships are never at sea at once, and never alongside the same berth together', () => {
    let worst = 0;
    run({
      start: 'full',
      seconds: 900,
      onStep(_t, ships) {
        const atSea = ships.filter((s) => s.phase === 'arriving' || s.phase === 'leaving').length;
        worst = Math.max(worst, atSea);
        const alongside = ships.filter((s) => s.phase === 'moored' || s.phase === 'warp-in' || s.phase === 'warp-out');
        expect(new Set(alongside.map((s) => s.berth.key)).size).toBe(alongside.length);
      },
    });
    expect(worst).toBeLessThanOrEqual(1);
  });

  test('taking the quay away mid-visit sends the ship off cleanly, without touching anything', () => {
    let gone = false;
    const hits: string[] = [];
    const { harbour } = run({
      start: 'bare',
      seconds: 120,
      // The ship is well on its way in by 35 s; then the quay goes.
      edits: [{ at: 35, erase: [[22, 0, 27], [23, 0, 27], [24, 0, 27]] }],
      onStep(t, ships, shape) {
        const field = solid(shape);
        for (const s of ships) {
          if (t > 35 && (s.phase === 'leaving' || s.phase === 'fading')) gone = true;
          if (s.body && s.scale > 0.98 && !hullClear(field, hullSize(s.kind as 'galleon'), s.pose.x, s.pose.z, s.pose.yaw, 0)) hits.push(`${t.toFixed(1)} ${s.phase}`);
        }
      },
    });
    expect(gone).toBe(true);
    expect(hits).toEqual([]);
    // Every ship of the old calls has finished and gone.
    expect(harbour.ships.every((s) => s.phase === 'idle' || !s.orphan)).toBe(true);
  });

  test('the same town and clock give the same visits', () => {
    const log = (): string[] => {
      const out: string[] = [];
      run({ start: 'bare', seconds: 90, onStep: (t, ships) => ships.forEach((s) => out.push(`${t.toFixed(2)} ${s.id} ${s.phase} ${s.pose.x.toFixed(4)} ${s.pose.z.toFixed(4)}`)) });
      return out;
    };
    expect(log()).toEqual(log());
  });
});
