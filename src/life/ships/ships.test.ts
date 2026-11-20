// The big ships' visits (L38–L42) and the small boats beside them, stepped
// with a fixed clock against a recording stage:
//   - they come in through the edge of the map and moor parallel to the quay;
//   - they never touch land, a dock or another boat; visits repeat, and the
//     kinds that fit take turns;
//   - nothing ever changes size or goes invisible (the edge of the map cuts
//     them off in the renderer), whatever is done to the town mid-visit;
//   - every boat ends up away over the edge or afloat in free water;
//   - the same town and clock give the same visits.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import type { Edit, World } from '@/core/world';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { hullSize } from '@/rules/life/berths.fact';
import { lowObstacles } from '@/rules/life/L41.river-barge.rule';
import { hullClear, mapEdge, obstacleColumns, seaField } from '@/rules/life/ship-routes';
import { resolveScenario } from '@/scenario';
import { applyEdit, canApply } from '@/world/world';
import bargeScn from '../../../scenarios/rules/L41.river-barge.scenario';
import passScn from '../../../scenarios/rules/L42.passing-sails.scenario';
import scn from '../../../scenarios/rules/L38.galleon.scenario';
import fishing from '../boats/fishing-boat.behaviour';
import rowboat from '../boats/rowboat.behaviour';
import sailboat from '../boats/sailboat.behaviour';
import { angleDelta } from '../motion/ease';
import { createLife } from '../runtime';
import { createSignals, partPhases } from '../signals';
import { recordingStage, type Recorded } from '../testing/stage';
import ferry, { leaversOf } from './ferry.system';
import harbourSystem from './harbour.system';
import { bigShipsOf, fromHull } from './news';
import { harbourOf, type Ship } from './visit';

type Town = ReturnType<typeof resolveScenario>;
type Plan = { shape: Town['shape']; dressing: Town['dressing'] };

const fields = new WeakMap<object, ReturnType<typeof seaField>>();
/** Land and every built column (no margins): what a hull must never touch. */
function solid(shape: Town['shape']): ReturnType<typeof seaField> {
  let f = fields.get(shape);
  if (!f) fields.set(shape, (f = seaField(obstacleColumns(shape.terrain, shape.kinds))));
  return f;
}

function planOf(world: World, base: Town): Plan {
  const shape = resolveShape(world, base.terrain);
  return { shape, dressing: resolveDressing(shape) };
}

/** Applies the edits that are legal (a scenario's player could make them), skipping the rest. */
function edit(world: World, base: Town, edits: Edit[]): World {
  let w = world;
  for (const e of edits) if (canApply(w, base.terrain, e).ok) w = applyEdit(w, base.terrain, e);
  return w;
}
const erase = (x: number, y: number, z: number): Edit => ({ type: 'eraseBlock', cell: key(x, y, z) });
const dock = (x: number, z: number): Edit => ({ type: 'placeBlock', cell: key(x, 0, z), kind: 'dock', color: 0, from: null });

/** The hull instances of every boat (not its sails, flags, crew or goods). */
const HULLS = new Set(['galleon', 'cog', 'galley', 'barge', 'rower', 'rowboat', 'sailboat', 'fishing-boat']);

/** The scale along each axis of a matrix (its three column lengths). */
const scales = (m: readonly number[]): number[] => [0, 4, 8].map((c) => Math.hypot(m[c]!, m[c + 1]!, m[c + 2]!));

interface Run {
  bare?: boolean;
  seconds: number;
  boats?: boolean;
  edits?: { at: number; make: (world: World, ships: readonly Ship[]) => Edit[] }[];
  onStep?: (t: number, ships: readonly Ship[], town: Plan, rec: ReturnType<typeof recordingStage>) => void;
}

function run(opts: Run) {
  const full = resolveScenario(scn);
  // The bare town: the quay cut short and no pier, no berth a ship fits (the rowboats stay).
  const bareWorld = edit(full.world, full, [...[20, 21, 22, 23, 24, 25, 26, 27].map((x) => erase(x, 0, 27)), ...[29, 30].map((z) => erase(31, 0, z))]);
  let world = opts.bare ? bareWorld : full.world;
  let current: Plan = opts.bare ? planOf(bareWorld, full) : { shape: full.shape, dressing: full.dressing };
  const rec = recordingStage(current);
  const signals = createSignals(scn.seed);
  signals.setPhase(partPhases().day.start + 0.02);
  signals.hold('run');
  const life = createLife(rec.stage, signals, { behaviours: opts.boats ? [sailboat, fishing, rowboat] : [], systems: [harbourSystem, ferry] });
  life.sync(current);
  if (opts.bare) {
    for (let i = 0; i < 60; i++) life.update(signals.advance(1 / 20));
    world = full.world;
    current = { shape: full.shape, dressing: full.dressing };
    rec.setTown(current.shape, current.dressing);
    life.sync(current);
  }
  const harbour = harbourOf(rec.stage)!;
  const dt = 1 / 20;
  const edits = [...(opts.edits ?? [])];
  for (let t = 0; t < opts.seconds; t += dt) {
    if (edits.length && t >= edits[0]!.at) {
      const e = edits.shift()!;
      world = edit(world, full, e.make(world, harbour.ships));
      current = planOf(world, full);
      rec.setTown(current.shape, current.dressing);
      life.sync(current);
    }
    life.update(signals.advance(dt));
    opts.onStep?.(t, harbour.ships, current, rec);
  }
  return { harbour, rec, signals, town: current, full };
}

/** Fittings that must never shrink or blink out either: the gangplank and the goods. */
const FITTINGS = new Set(['gangplank', 'ship-goods']);

/**
 * Fails if any boat's hull, gangplank or load of goods is ever drawn at another size than its own, or hidden
 * once shown; or if any person (a sailor, a bargeman: a mesh of their own) is hidden once shown.
 */
function watchHulls(rec: ReturnType<typeof recordingStage>, problems: string[]): void {
  const seen = new Map<Recorded, boolean>();
  for (const r of rec.spawned) {
    if (!r.spec && !r.released) {
      if (r.moves > 0 && !r.visible) problems.push(`a figure hidden (${r.id})`);
      continue;
    }
    const actor = r.spec && 'actor' in r.spec ? r.spec.actor : '';
    if ((!HULLS.has(actor) && !FITTINGS.has(actor)) || r.released) continue;
    const m = r.matrix;
    const zero = m[0] === 0 && m[5] === 0 && m[10] === 0;
    if (zero) continue;
    const shown = seen.get(r) ?? false;
    if (!shown) seen.set(r, true);
    for (const s of scales(m)) if (Math.abs(s - 1) > 1e-3) problems.push(`${actor} drawn at scale ${s.toFixed(3)}`);
    if (!r.visible) problems.push(`${actor} hidden`);
  }
}

describe('big ships (L38–L40)', () => {
  test('the first ship comes in through the edge of the map soon after the quay is built, and lies alongside parallel to it', () => {
    let entered = -1, moored = -1, worstYaw = 0, worstGap = 0, startedOutside = false;
    run({
      bare: true,
      seconds: 150,
      onStep(t, ships) {
        for (const s of ships) {
          if (s.phase === 'arriving' && entered < 0) {
            startedOutside ||= mapEdge(s.pose.x, s.pose.z) > 0;
            const bow = mapEdge(s.pose.x + Math.sin(s.pose.yaw) * s.hull.bow, s.pose.z + Math.cos(s.pose.yaw) * s.hull.bow);
            if (bow < 0) entered = t;
          }
          if (s.phase === 'moored' && moored < 0) moored = t;
          if (s.phase === 'moored') {
            worstYaw = Math.max(worstYaw, Math.abs(angleDelta(s.pose.yaw, s.mooring.yaw)));
            const f = s.berth.face;
            const d = (s.pose.x - f.ax) * f.ox + (s.pose.z - f.az) * f.oz - s.hull.halfBeam;
            worstGap = Math.max(worstGap, Math.abs(d - 0.14));
          }
        }
      },
    });
    expect(startedOutside).toBe(true);
    expect(entered).toBeGreaterThanOrEqual(0);
    expect(entered).toBeLessThan(35);
    expect(moored).toBeGreaterThan(entered);
    expect(moored).toBeLessThan(120);
    expect(worstYaw).toBeLessThan(0.01);
    expect(worstGap).toBeLessThan(0.02);
  });

  test('never touches land or a dock; visits repeat and the ships that fit take turns; each leaves out through the edge', () => {
    const hits: string[] = [];
    const kinds = new Set<string>();
    const outAt: number[] = [];
    const last = new Map<string, { phase: string; edge: number }>();
    run({
      seconds: 1500,
      onStep(t, ships, plan) {
        const field = solid(plan.shape);
        for (const s of ships) {
          const was = last.get(s.id);
          if (was?.phase === 'leaving' && s.phase === 'idle') outAt.push(was.edge);
          if (s.phase === 'moored') kinds.add(s.kind);
          const sx = Math.sin(s.pose.yaw), cz = Math.cos(s.pose.yaw);
          last.set(s.id, { phase: s.phase, edge: Math.min(mapEdge(s.pose.x + sx * s.hull.bow, s.pose.z + cz * s.hull.bow), mapEdge(s.pose.x + sx * s.hull.stern, s.pose.z + cz * s.hull.stern)) });
          if (!s.body || mapEdge(s.pose.x, s.pose.z) > -4) continue;
          if (!hullClear(field, hullSize(s.kind as 'galleon'), s.pose.x, s.pose.z, s.pose.yaw, 0)) hits.push(`${t.toFixed(1)} ${s.kind} ${s.phase} ${s.pose.x.toFixed(2)},${s.pose.z.toFixed(2)},${s.pose.yaw.toFixed(2)} s ${s.s.toFixed(1)}/${s.voyage?.path.length.toFixed(1)} swing ${s.voyage?.swing.toFixed(2)}`);
        }
      },
    });
    expect(hits.slice(0, 8).join(' | ')).toBe('');
    expect(kinds.size).toBeGreaterThanOrEqual(2);
    expect(outAt.length).toBeGreaterThanOrEqual(2);
    // Gone only once all of it is beyond the edge of the map.
    for (const e of outAt) expect(e).toBeGreaterThan(0);
  });

  test('two ships are never at sea at once, and never alongside the same berth together', () => {
    let worst = 0;
    run({
      seconds: 900,
      onStep(_t, ships) {
        const sea = ships.filter((s) => s.phase === 'arriving' || s.phase === 'leaving');
        worst = Math.max(worst, sea.length);
        const alongside = ships.filter((s) => s.phase === 'moored' || s.phase === 'warp-in' || s.phase === 'warp-out');
        expect(new Set(alongside.map((s) => s.berth.key)).size).toBe(alongside.length);
      },
    });
    expect(worst).toBeLessThanOrEqual(1);
  });

  test('every nasty edit mid-visit: no boat ever shrinks, fades or vanishes; each ends away over the edge or afloat in free water', () => {
    const problems: string[] = [];
    const phases = new Set<string>();
    let hullsWatched = 0;
    const lagoonWall = [8, 9, 10, 11, 12, 13, 14, 15].map((x) => dock(x, 33));
    const { harbour, rec, town } = run({
      bare: true,
      boats: true,
      seconds: 420,
      edits: [
        // Mid-approach: wall off part of the lane and lay a line of docks across the way in (a bridge would do the same).
        { at: 30, make: () => [...lagoonWall, ...[30, 31, 32, 33, 34, 35].map((z) => dock(18, z))] },
        // Alongside: fill the water under the hull, then take the quay away.
        { at: 110, make: (_w, ships) => ships.filter((s) => s.body).flatMap((s) => [dock(Math.floor(s.pose.x), Math.floor(s.pose.z)), dock(Math.floor(s.pose.x) + 1, Math.floor(s.pose.z))]) },
        { at: 125, make: () => [18, 19, 20, 21, 22, 23, 24, 25, 26, 27].map((x) => erase(x, 0, 27)) },
        // Then everything built goes.
        { at: 200, make: (w) => [...w.blocks.keys()].map((k) => ({ type: 'eraseBlock', cell: k }) as Edit) },
      ],
      onStep(t, ships, _plan, r) {
        watchHulls(r, problems);
        hullsWatched = Math.max(hullsWatched, r.spawned.filter((x) => x.spec && 'actor' in x.spec && HULLS.has(x.spec.actor) && !x.released).length);
        for (const s of ships) phases.add(`${t < 110 ? 'early' : t < 200 ? 'mid' : 'late'}:${s.phase}`);
      },
    });
    // It really happened under ships: one was alongside, was nudged off the filled water, and later left.
    for (const p of ['early:moored', 'mid:nudging', 'late:leaving']) expect(phases.has(p), p).toBe(true);
    expect([...new Set(problems)].slice(0, 6)).toEqual([]);
    expect(hullsWatched).toBeGreaterThan(0);
    const field = solid(town.shape);
    for (const s of harbour.ships) {
      if (s.phase === 'idle' || !s.body) continue;
      expect(hullClear(field, hullSize(s.kind as 'galleon'), s.pose.x, s.pose.z, s.pose.yaw, -0.05), `${s.kind} ${s.phase}`).toBe(true);
    }
    const low = seaField(lowObstacles(town.shape.facts));
    for (const l of leaversOf(rec.stage)) expect(low.at(l.x, l.z), `${l.type} ${l.mode}`).toBeGreaterThan(0.1);
  });

  test('small boats give way: no sailboat or fishing boat comes within a hull of a ship', () => {
    let closest = Infinity, checked = 0, worstAt = '';
    run({
      bare: true,
      seconds: 400,
      boats: true,
      onStep(t, _ships, plan, rec) {
        const ships = bigShipsOf(rec.stage);
        for (const a of plan.dressing.actors) {
          if (a.type !== 'sailboat' && a.type !== 'fishing-boat') continue;
          const [x, , z] = positionOf(rec.of(a.id).matrix);
          for (const s of ships) {
            if (mapEdge(s.x, s.z) > -3) continue;
            checked++;
            const g = fromHull(s, x, z).gap;
            if (g < closest) worstAt = `${t.toFixed(1)} ${a.type}`;
            closest = Math.min(closest, g);
          }
        }
      },
    });
    expect(checked).toBeGreaterThan(100);
    expect(closest, worstAt).toBeGreaterThan(0.45);
  });

  test('a dock taken away from under its rowboat: someone rows it away out through the edge, the same size all the way', () => {
    const problems: string[] = [];
    let left = 0, seenOut = false;
    run({
      seconds: 160,
      boats: true,
      edits: [{ at: 5, make: () => [27, 28, 29, 30].map((z) => erase(31, 0, z)) }],
      onStep(_t, _s, _p, rec) {
        watchHulls(rec, problems);
        const l = leaversOf(rec.stage);
        left = Math.max(left, l.length);
        for (const b of l) if (mapEdge(b.x, b.z) > 0) seenOut = true;
      },
    });
    expect(left).toBeGreaterThan(0);
    expect(seenOut).toBe(true);
    expect([...new Set(problems)]).toEqual([]);
  });

  test('the same town and clock give the same visits', () => {
    const log = (): string[] => {
      const out: string[] = [];
      run({ bare: true, seconds: 90, onStep: (t, ships) => ships.forEach((s) => out.push(`${t.toFixed(2)} ${s.id} ${s.phase} ${s.pose.x.toFixed(4)} ${s.pose.z.toFixed(4)}`)) });
      return out;
    };
    expect(log()).toEqual(log());
  });

  test('L42: a tall ship crosses far out now and then, in through one side and out through the other, never calling', () => {
    const town = resolveScenario(passScn);
    const rec = recordingStage(town);
    const signals = createSignals(passScn.seed);
    signals.setPhase(partPhases().day.start + 0.02);
    const life = createLife(rec.stage, signals, { behaviours: [], systems: [harbourSystem] });
    life.sync(town);
    const harbour = harbourOf(rec.stage)!;
    const field = solid(town.shape);
    const problems: string[] = [];
    let crossings = 0, crossing = false, hits = 0, worstLand = Infinity;
    for (let t = 0; t < 600; t += 1 / 20) {
      life.update(signals.advance(1 / 20));
      watchHulls(rec, problems);
      const p = harbour.passers[0]!;
      if (p.phase === 'crossing' && !crossing) crossings++;
      crossing = p.phase === 'crossing';
      for (const n of bigShipsOf(rec.stage)) {
        if (mapEdge(n.x, n.z) > -4) continue;
        worstLand = Math.min(worstLand, field.at(n.x, n.z));
        if (!hullClear(field, hullSize('galleon'), n.x, n.z, n.yaw, 0)) hits++;
      }
    }
    expect(harbour.ships.length).toBe(0);
    expect(crossings).toBeGreaterThanOrEqual(2);
    expect(hits).toBe(0);
    expect(worstLand).toBeGreaterThan(5);
    expect([...new Set(problems)]).toEqual([]);
  });

  test('L41: the barge is poled between its river docks and back, never onto a bank or a dock', () => {
    const town = resolveScenario(bargeScn);
    const rec = recordingStage(town);
    const signals = createSignals(bargeScn.seed);
    const life = createLife(rec.stage, signals, { behaviours: [], systems: [harbourSystem] });
    life.sync(town);
    const harbour = harbourOf(rec.stage)!;
    expect(harbour.barges.length).toBe(1);
    const bg = harbour.barges[0]!;
    const field = seaField(lowObstacles(town.shape.facts));
    let minZ = Infinity, maxZ = -Infinity, hits = 0;
    for (let t = 0; t < 160; t += 1 / 20) {
      life.update(signals.advance(1 / 20));
      minZ = Math.min(minZ, bg.z);
      maxZ = Math.max(maxZ, bg.z);
      if (!hullClear(field, hullSize('barge'), bg.x, bg.z, bg.yaw, -0.05)) hits++;
    }
    expect(minZ).toBeLessThan(10.5);
    expect(maxZ).toBeGreaterThan(25.5);
    expect(hits).toBe(0);
    expect(bg.z).toBeLessThan(maxZ - 1);
  });

  test('a dock built in a town already shown: its rowboat is rowed in from beyond the edge, not there at once', () => {
    let firstSeen: [number, number] | null = null, reached = false, id = '';
    run({
      seconds: 200,
      boats: true,
      edits: [{ at: 5, make: () => [dock(14, 28), dock(14, 29), dock(14, 30)] }],
      onStep(t, _ships, plan, rec) {
        if (t < 5) return;
        const boat = plan.dressing.actors.find((a) => a.type === 'rowboat' && a.home === plan.shape.structureAt.get(key(14, 0, 28)));
        if (!boat) return;
        id = boat.id;
        const r = rec.of(boat.id);
        if (r.moves === 0) return;
        const [x, , z] = positionOf(r.matrix);
        firstSeen ??= [x, z];
        if (mapEdge(x, z) < 0 && Math.hypot(x - 14.5, z - 30) < 3) reached = true;
      },
    });
    expect(id).not.toBe('');
    expect(firstSeen).not.toBeNull();
    // It was first drawn out beyond the edge of the map, and later lay at its new dock.
    expect(mapEdge(firstSeen![0], firstSeen![1])).toBeGreaterThan(0);
    expect(reached).toBe(true);
  });
});
