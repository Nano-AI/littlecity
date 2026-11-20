// More dock, more big ships, at the same time: berths fill together, a long
// quay holds ships end to end, ships under way keep out of each other's
// lanes (leaving ships first; arrivals wait beyond the edge), nobody is ever
// stuck, and no two hulls ever meet.

import { describe, expect, test, vi } from 'vitest';

// Long fixed-step harbour simulations: minutes of game time. On a machine shared with other work the
// default 30 s is not enough.
vi.setConfig({ testTimeout: 300_000 });
import { key } from '@/core/grid';
import type { Edit, World } from '@/core/world';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { hullSize } from '@/rules/life/berths.fact';
import { hullClear, mapEdge, obstacleColumns, seaField, type HullSize } from '@/rules/life/ship-routes';
import { resolveScenario, type Scenario } from '@/scenario';
import { applyEdit, canApply } from '@/world/world';
import harbourScn, { HARBOUR_DOCKS } from '../../../scenarios/life/ships-harbour.scenario';
import narrowScn from '../../../scenarios/life/ships-narrow.scenario';
import { createLife } from '../runtime';
import { createSignals, partPhases } from '../signals';
import { recordingStage } from '../testing/stage';
import ferry from './ferry.system';
import harbourSystem from './harbour.system';
import { harbourOf, type Ship } from './visit';

type Town = ReturnType<typeof resolveScenario>;
type Plan = { shape: Town['shape']; dressing: Town['dressing'] };

function planOf(world: World, base: Town): Plan {
  const shape = resolveShape(world, base.terrain);
  return { shape, dressing: resolveDressing(shape) };
}
function edit(world: World, base: Town, edits: Edit[]): World {
  let w = world;
  for (const e of edits) if (canApply(w, base.terrain, e).ok) w = applyEdit(w, base.terrain, e);
  return w;
}
const erase = (x: number, z: number): Edit => ({ type: 'eraseBlock', cell: key(x, 0, z) });

/** A hull as discs along it, at a pose. */
function discs(h: HullSize, s: Ship): { x: number; z: number; r: number }[] {
  const out = [];
  const sx = Math.sin(s.pose.yaw), cz = Math.cos(s.pose.yaw);
  for (let a = h.stern; a <= h.bow; a += 0.4) out.push({ x: s.pose.x + sx * a, z: s.pose.z + cz * a, r: h.halfBeam * (a > h.bow - 1 ? 0.5 : 1) });
  return out;
}
/** How far apart two hulls are (negative: they overlap). */
function gap(a: Ship, b: Ship): number {
  let best = Infinity;
  for (const p of discs(hullSize(a.kind as 'galleon'), a)) for (const q of discs(hullSize(b.kind as 'galleon'), b)) best = Math.min(best, Math.hypot(p.x - q.x, p.z - q.z) - p.r - q.r);
  return best;
}
const alongside = (s: Ship): boolean => s.phase === 'moored' || s.phase === 'warp-in' || s.phase === 'warp-out';
const active = (s: Ship): boolean => s.body !== null && s.phase !== 'idle';

function run(scn: Scenario, opts: { bare?: boolean; seconds: number; edits?: { at: number; make: (w: World, ships: readonly Ship[]) => Edit[] }[]; onStep: (t: number, ships: readonly Ship[], plan: Plan) => void }) {
  const full = resolveScenario(scn);
  const docks = [...full.world.blocks.entries()].filter(([, b]) => b.kind === 'dock').map(([k]) => k);
  const bareWorld = edit(full.world, full, docks.map((k) => ({ type: 'eraseBlock', cell: k })));
  let world = opts.bare ? bareWorld : full.world;
  let current: Plan = opts.bare ? planOf(bareWorld, full) : { shape: full.shape, dressing: full.dressing };
  const rec = recordingStage(current);
  const signals = createSignals(scn.seed);
  signals.setPhase(partPhases().day.start + 0.02);
  signals.hold('day');
  const life = createLife(rec.stage, signals, { behaviours: [], systems: [harbourSystem, ferry] });
  life.sync(current);
  if (opts.bare) {
    for (let i = 0; i < 40; i++) life.update(signals.advance(1 / 20));
    world = full.world;
    current = { shape: full.shape, dressing: full.dressing };
    rec.setTown(current.shape, current.dressing);
    life.sync(current);
  }
  const harbour = harbourOf(rec.stage)!;
  const edits = [...(opts.edits ?? [])];
  for (let t = 0; t < opts.seconds; t += 1 / 20) {
    if (edits.length && t >= edits[0]!.at) {
      const e = edits.shift()!;
      world = edit(world, full, e.make(world, harbour.ships));
      current = planOf(world, full);
      rec.setTown(current.shape, current.dressing);
      life.sync(current);
    }
    life.update(signals.advance(1 / 20));
    opts.onStep(t, harbour.ships, current);
  }
  return { harbour, current };
}

const fields = new WeakMap<object, ReturnType<typeof seaField>>();
const solid = (shape: Town['shape']): ReturnType<typeof seaField> => {
  let f = fields.get(shape);
  if (!f) fields.set(shape, (f = seaField(obstacleColumns(shape.terrain, shape.kinds))));
  return f;
};

/** Every pair of hulls on the water now, inside the map: none may overlap; and none touches land or a dock. */
function check(t: number, ships: readonly Ship[], plan: Plan, bad: string[]): void {
  const on = ships.filter((s) => active(s) && mapEdge(s.pose.x, s.pose.z) < -3.5);
  for (let i = 0; i < on.length; i++) {
    const a = on[i]!;
    if (!hullClear(solid(plan.shape), hullSize(a.kind as 'galleon'), a.pose.x, a.pose.z, a.pose.yaw, -0.02)) bad.push(`${t.toFixed(1)} ${a.kind} ${a.phase} on land`);
    for (let j = i + 1; j < on.length; j++) {
      const g = gap(a, on[j]!);
      if (g < 0) bad.push(`${t.toFixed(1)} ${a.kind} ${a.phase} meets ${on[j]!.kind} ${on[j]!.phase} (${g.toFixed(2)})`);
    }
  }
}

describe('big ships at the same time', () => {
  test('a big harbour fills: ships start coming within half a minute, three or more lie alongside together, the long quay holds two, and no hulls ever meet', () => {
    let first = Infinity, most = 0, northTwo = false, maxActive = 0;
    const kinds = new Set<string>();
    const bad: string[] = [];
    run(harbourScn, {
      bare: true,
      seconds: 300,
      onStep(t, ships, plan) {
        if (ships.some((s) => s.phase === 'arriving')) first = Math.min(first, t);
        const moored = ships.filter(alongside);
        most = Math.max(most, moored.length);
        if (moored.filter((s) => s.berth.z === 11).length >= 2) northTwo = true;
        maxActive = Math.max(maxActive, ships.filter(active).length);
        for (const s of moored) kinds.add(s.kind);
        check(t, ships, plan, bad);
      },
    });
    expect(first).toBeLessThan(30);
    expect(most).toBeGreaterThanOrEqual(3);
    expect(northTwo).toBe(true);
    expect(maxActive).toBeGreaterThanOrEqual(5);
    expect(kinds.size).toBeGreaterThanOrEqual(2);
    expect(bad.slice(0, 6)).toEqual([]);
  });

  test('a busy harbour keeps moving: after it has filled, a ship is usually coming or going; with seven or eight active no hulls meet', () => {
    let samples = 0, moving = 0, maxActive = 0;
    const bad: string[] = [];
    run(harbourScn, {
      seconds: 600,
      onStep(t, ships, plan) {
        check(t, ships, plan, bad);
        maxActive = Math.max(maxActive, ships.filter(active).length);
        if (t < 120 || Math.abs(t % 5) > 0.03) return;
        samples++;
        if (ships.some((s) => s.phase === 'arriving' || s.phase === 'leaving' || s.phase === 'warp-out' || s.phase === 'swing-out' || s.phase === 'warp-in' || s.phase === 'swing-in')) moving++;
      },
    });
    expect(moving / samples).toBeGreaterThan(0.5);
    expect(maxActive).toBeGreaterThanOrEqual(6);
    expect(bad.slice(0, 6)).toEqual([]);
  });

  test('three berths sharing one narrow channel: many visits each, nobody stuck, no two hulls ever meet', () => {
    const bad: string[] = [];
    const visits = new Map<string, number>();
    const last = new Map<string, string>();
    run(narrowScn, {
      seconds: 1500,
      onStep(t, ships, plan) {
        for (const s of ships) {
          if (s.phase === 'moored' && last.get(s.id) !== 'moored') visits.set(s.berth.key, (visits.get(s.berth.key) ?? 0) + 1);
          last.set(s.id, s.phase);
        }
        check(t, ships, plan, bad);
      },
    });
    expect(bad.slice(0, 6)).toEqual([]);
    expect(visits.size).toBeGreaterThanOrEqual(3);
    for (const [k, n] of visits) expect(n, k).toBeGreaterThanOrEqual(3);
  });

  test('docks taken from under several moored ships: each casts off and goes (or waits afloat), none meets another', () => {
    const bad: string[] = [];
    let mooredAtEdit = 0;
    const { harbour, current } = run(harbourScn, {
      seconds: 260,
      edits: [
        {
          at: 20,
          make: (_w, ships) => {
            mooredAtEdit = ships.filter(alongside).length;
            return HARBOUR_DOCKS.slice(0, 3).flatMap(([x0, z0, x1, z1]) => {
              const out: Edit[] = [];
              for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) out.push(erase(x, z));
              return out;
            });
          },
        },
      ],
      onStep: (t, ships, plan) => check(t, ships, plan, bad),
    });
    expect(mooredAtEdit).toBeGreaterThanOrEqual(2);
    expect(bad.slice(0, 6)).toEqual([]);
    const field = solid(current.shape);
    for (const s of harbour.ships) {
      if (!active(s)) continue;
      // Still here: alongside a quay that is still there, or afloat clear of everything.
      expect(hullClear(field, hullSize(s.kind as 'galleon'), s.pose.x, s.pose.z, s.pose.yaw, -0.05), `${s.kind} ${s.phase}`).toBe(true);
    }
  });

  test('deterministic with many ships', () => {
    const log = (): string => {
      const out: string[] = [];
      run(harbourScn, { bare: true, seconds: 120, onStep: (t, ships) => ships.forEach((s) => out.push(`${t.toFixed(2)} ${s.id} ${s.phase} ${s.pose.x.toFixed(3)}`)) });
      return out.join('\n');
    };
    expect(log()).toBe(log());
  });
});
