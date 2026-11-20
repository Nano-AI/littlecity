// For tests of the crowd: a town from a builder, a clock, and a watcher that
// checks at every step what must never happen. Not used by the game.
//
// What the watcher holds every drawn person to:
//   - they are inside the cell of the graph node they are at (or just
//     through the doorway of the building they are entering);
//   - they only ever go from one node to another along a link of the graph,
//     so never through a fence, a wall or a building, never up a bank
//     without steps;
//   - their feet are at the height of that cell's floor (on a flight: within
//     the storey it climbs);
//   - when they move, they face the way they move (no moonwalking, no
//     sliding sideways);
//   - nobody stays held up for long.

import { CELL_H, keyX, keyY, keyZ } from '@/core/grid';
import type { TimeSignal } from '@/life/api';
import { createSignals } from '@/life/signals';
import { resolveTown } from '@/resolve/index';
import type { DressingPlan, NavGraph, ShapePlan } from '@/resolve/plan';
import { flatTerrain, resolveScenario, TownBuilder, type Scenario } from '@/scenario';
import type { Terrain, World } from '@/core/world';
import { emptyWorld } from '@/world/world';
import { createCrowd, type Crowd, type CrowdOptions, type Person } from './crowd';


export interface TestTown {
  world: World;
  terrain: Terrain;
  shape: ShapePlan;
  dressing: DressingPlan;
  nav: NavGraph;
}

export function resolved(world: World, terrain: Terrain): TestTown {
  const { shape, dressing } = resolveTown(world, terrain);
  return { world, terrain, shape, dressing, nav: dressing.nav };
}
export function townOf(build: (b: TownBuilder) => void, terrain: Terrain = flatTerrain(7), seed = 7): TestTown {
  const b = new TownBuilder(emptyWorld(seed), terrain);
  build(b);
  return resolved(b.world, terrain);
}
/** A scenario's town, resolved with the discovered rules and the scenario's own. */
export function scenarioTown(s: Scenario): TestTown {
  const r = resolveScenario(s);
  return { world: r.world, terrain: r.terrain, shape: r.shape, dressing: r.dressing, nav: r.dressing.nav };
}

export interface Clock {
  readonly time: TimeSignal;
  hold(part: 'day' | 'dusk' | 'night' | 'dawn' | 'run'): void;
  tick(dt: number): number;
}
export function clock(seed = 7, part: 'day' | 'dusk' | 'night' | 'dawn' | 'run' = 'day'): Clock {
  const s = createSignals(seed);
  s.hold(part);
  return {
    get time() {
      return s.time;
    },
    hold: (p) => s.hold(p),
    tick: (dt) => s.advance(dt),
  };
}

export interface Watch {
  /** What went wrong, in words; empty when all is well. */
  problems: string[];
  /** Completed walks, and visits to each haunt type. */
  arrivals: number;
  byHaunt: Map<string, number>;
  /** Longest anybody stood held up, seconds. */
  longestStuck: number;
  /** Most people seen outdoors at one moment. */
  mostOut: number;
  /** Steps a walker spent moving, and the share of them spent facing within 60° of their motion. */
  moving: number;
  facing: number;
  check(): void;
}

/** Steps a crowd and checks it. Call `check()` after every crowd.step(). */
export function watch(crowd: Crowd, opts: { maxStuck?: number } = {}): Watch {
  const last = new Map<Person, { x: number; z: number; node: number; mode: string; visible: boolean; nav: NavGraph | null; goal: unknown }>();
  const w: Watch = {
    problems: [],
    arrivals: 0,
    byHaunt: new Map(),
    longestStuck: 0,
    mostOut: 0,
    moving: 0,
    facing: 0,
    check() {
      const nav = crowd.nav;
      if (!nav) return;
      let out = 0;
      const say = (p: Person, what: string): void => {
        if (w.problems.length < 20) w.problems.push(`${p.id} (${p.mode}, ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}): ${what}`);
      };
      for (const p of crowd.people) {
        const before = last.get(p);
        if (p.visible) out++;
        if (p.stuck > w.longestStuck) w.longestStuck = p.stuck;
        if (p.stuck > (opts.maxStuck ?? 6)) say(p, `held up for ${p.stuck.toFixed(1)} s`);
        if (before && before.mode === 'walk' && p.mode !== 'walk' && p.mode !== 'wait' && p.mode !== 'hop') {
          w.arrivals++;
          const type = p.goal?.kind === 'home' ? 'home' : (p.goal?.haunt?.type ?? p.goal?.kind ?? '?');
          w.byHaunt.set(type, (w.byHaunt.get(type) ?? 0) + 1);
        }
        if (p.visible && p.mode !== 'hop' && p.node >= 0) {
          const node = nav.nodes[p.node]!;
          const cx = keyX(node.cell), cz = keyZ(node.cell), cy = keyY(node.cell);
          const piece = p.mode === 'walk' && p.walk ? p.walk[p.at]! : null;
          // Through a doorway they are up to a quarter of a cell inside the building; otherwise in their cell.
          const slack = piece?.kind === 'door' ? 0.3 : 1e-6;
          if (p.x < cx - slack || p.x > cx + 1 + slack || p.z < cz - slack || p.z > cz + 1 + slack) say(p, `outside the cell of its node (${cx}, ${cy}, ${cz})`);
          const lo = cy * CELL_H - 0.52, hi = (cy + 1) * CELL_H + 0.05;
          if (p.y < lo || p.y > hi) say(p, `at height ${p.y.toFixed(2)}, not on the floor of level ${cy}`);
          if (before && before.nav === nav && before.node !== p.node && before.node >= 0 && before.mode !== 'hop' && before.mode !== 'home' && before.mode !== 'visit') {
            // A change of node is a link of the graph.
            let linked = false;
            for (let k = nav.linkStart[p.node]!; k < nav.linkStart[p.node + 1]!; k++) {
              const l = nav.links[nav.linkOf[k]!]!;
              if (l.a === before.node || l.b === before.node) linked = true;
            }
            if (!linked) say(p, `went from node ${before.node} to node ${p.node}, which no link joins`);
          }
          if (before && before.visible && before.nav === nav && p.mode === 'walk' && before.mode === 'walk' && piece?.kind === 'move') {
            const dx = p.x - before.x, dz = p.z - before.z;
            const d = Math.hypot(dx, dz);
            if (d > 1e-4) {
              if (d > 0.2) say(p, `jumped ${d.toFixed(2)} in one step`);
              const dot = (Math.sin(p.heading) * dx + Math.cos(p.heading) * dz) / d;
              // (Facing is judged on steps, not on a shuffle of a few millimetres while held up.)
              if (d > 0.004) w.moving++;
              if (d > 0.004 && dot > 0.5) w.facing++;
              // A step aside while held up is sideways (and turned into); only going back is wrong. (A shuffle
              // of a few millimetres while held up is not a step.)
              if (dot < -0.35 && d > 0.004) say(p, `is walking backwards (${dot.toFixed(2)})`);
            }
          }
        }
        last.set(p, { x: p.x, z: p.z, node: p.node, mode: p.mode, visible: p.visible, nav, goal: p.goal });
      }
      if (out > w.mostOut) w.mostOut = out;
    },
  };
  return w;
}

/** A crowd on a town, stepped `seconds` at 30 steps a second, watched all the way. */
export function run(town: TestTown, seconds: number, opts: CrowdOptions & { part?: 'day' | 'dusk' | 'night' | 'dawn'; maxStuck?: number } = {}): { crowd: Crowd; watch: Watch; clock: Clock } {
  const c = clock(town.world.seed, opts.part ?? 'day');
  const crowd = createCrowd(opts);
  crowd.sync(town.shape, town.dressing, c.time);
  const w = watch(crowd, opts);
  w.check();
  const steps = Math.round(seconds * 30);
  for (let i = 0; i < steps; i++) {
    crowd.step(c.tick(1 / 30), c.time);
    w.check();
  }
  return { crowd, watch: w, clock: c };
}
