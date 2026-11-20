// L54 · Builders and onlookers: the town answers what the player builds.
//
// When a piece of a building lands (a house, a tower, marble, a lighthouse,
// a windmill), two grown-ups from near it walk over, one with a ladder on
// the shoulder and one with a hod of bricks; each sets it down beside the
// new building, hammers at it for a few seconds, picks it up again and goes
// home. For something big (a tower, marble, a lighthouse or a windmill, or a
// house of six cells or more) a few neighbours also come and stand looking
// up at it for a while.
//
// Never in the way of fast building: a job per building, at most two going
// at once, a new one at most every BUILD.gap seconds; and when pieces land
// faster than a person could follow (a pasted town, Grow a town's playback)
// only a token one now and then. Erasing the building mid-job ends it: what
// was set down is picked up (or, if its ground went too, the carrier takes
// what they hold home).

import { DIR4, keyX, keyY, keyZ, key, type CellKey, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import type { StructureId } from '@/resolve/plan';
import { BUILD } from '@/style/town-life';
import type { Person } from '../../people/crowd';
import type { Load } from '../../people/errand';
import { DIR_HEADING, type Board, type Chain, type Plan, type Store } from '../board';
import { canWork, reaches } from '../hands';

const BUILT = new Set(['house', 'tower', 'marble', 'lighthouse', 'windmill']);
const BIG = new Set(['tower', 'marble', 'lighthouse', 'windmill']);

interface Job {
  n: number;
  structure: StructureId;
  /** The life time it was asked for; cells around it to stand in, facing it (filled once the town has it). */
  at: number;
  stands: { cell: CellKey; dir: Dir4 }[];
  builders: Person[];
  watchers: Person[];
  wantBuilders: number;
  wantWatchers: number;
  stores: Store[];
  done: boolean;
}

export interface BuildChain extends Chain {
  /** A piece landed in this cell (the signals' blockLanded). */
  landed(cell: CellKey, board: Board): void;
  readonly jobs: readonly Job[];
}

export function buildChain(): BuildChain {
  const jobs: Job[] = [];
  let count = 0;
  let lastJob = -Infinity;
  /** Life times of recent landings, to tell a person building from a paste or a playback. */
  const recent: number[] = [];

  /** Walkable cells next to the structure on its ground storey, facing it. */
  const standsOf = (board: Board, s: StructureId): { cell: CellKey; dir: Dir4 }[] => {
    const st = board.shape?.structures.get(s);
    const nav = board.nav;
    if (!st || !nav) return [];
    const low = Math.min(...st.cells.map((c) => keyY(c)));
    const out: { cell: CellKey; dir: Dir4 }[] = [];
    for (const c of st.cells) {
      if (keyY(c) !== low) continue;
      for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
        const [dx, dz] = DIR4[d]!;
        const at = key(keyX(c) + dx, low, keyZ(c) + dz);
        if (!nav.nodeAt.has(at) || st.cells.includes(at) || out.some((o) => o.cell === at)) continue;
        // Facing back toward the building.
        out.push({ cell: at, dir: ((d + 2) % 4) as Dir4 });
      }
    }
    return out.sort((a, b) => a.cell - b.cell);
  };

  const chain: BuildChain = {
    id: 'build',
    jobs,
    landed(cell, board) {
      const now = board.now;
      recent.push(now);
      while (recent.length > 0 && now - recent[0]! > 5) recent.shift();
      const s = board.shape?.structureAt.get(cell);
      const st = s !== undefined ? board.shape?.structures.get(s) : undefined;
      if (s === undefined || !st || !BUILT.has(st.kind)) return;
      const existing = jobs.find((j) => j.structure === s && !j.done);
      if (existing) return;
      // Fast building: a token job now and then only.
      const flood = recent.length > BUILD.flood;
      if (now - lastJob < (flood ? BUILD.floodGap : BUILD.gap) || jobs.filter((j) => !j.done).length >= BUILD.most) return;
      lastJob = now;
      const big = BIG.has(st.kind) || st.cells.length >= 6;
      jobs.push({ n: ++count, structure: s, at: now, stands: [], builders: [], watchers: [], wantBuilders: 2, wantWatchers: big ? BUILD.watchers : 0, stores: [], done: false });
    },
    sync(board) {
      for (const j of jobs) {
        if (j.done) continue;
        const st = board.shape?.structures.get(j.structure);
        if (!st) {
          j.done = true;
          continue;
        }
        j.stands = standsOf(board, j.structure);
        j.stores = j.stores.map((s) => board.store(s.key, s.spots));
      }
      for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i]!.done && jobs[i]!.builders.every((b) => !board.plans.has(b))) jobs.splice(i, 1);
    },
    step(_dt, _time, board) {
      for (const j of jobs) {
        if (j.done) continue;
        // Nobody came in time (nobody near, or all busy): the job lapses.
        if (board.now - j.at > BUILD.lapse && j.builders.length === 0) j.done = true;
        if (board.now - j.at > BUILD.lapse * 3) j.done = true;
      }
    },
    offer(p, time, board) {
      if (!canWork(p) || board.claimedBy(p) || time.isNight) return null;
      for (const j of jobs) {
        if (j.done || board.now - j.at > BUILD.lapse) continue;
        // The town already has it (a piece added to a building the walking graph knows): where to stand.
        if (j.stands.length === 0) j.stands = standsOf(board, j.structure);
        if (j.stands.length === 0) continue;
        const nearest = j.stands.reduce((a, b) => (board.dist(b.cell, p.cell) < board.dist(a.cell, p.cell) ? b : a));
        if (board.dist(nearest.cell, p.cell) > BUILD.reach || !reaches(board, p, nearest.cell)) continue;
        if (j.builders.length < j.wantBuilders) return builderPlan(board, p, j);
        if (j.watchers.length < j.wantWatchers) return watcherPlan(board, p, j);
      }
      return null;
    },
  };

  const standFor = (board: Board, j: Job, i: number): { cell: CellKey; spot: { x: number; z: number }; face: number; dir: Dir4 } => {
    const s = j.stands[(i * 3 + j.n) % j.stands.length]!;
    const c = board.centre(s.cell);
    const [dx, dz] = DIR4[s.dir]!;
    return { cell: s.cell, dir: s.dir, spot: { x: c.x + dx * 0.2, z: c.z + dz * 0.2 }, face: DIR_HEADING[s.dir] };
  };

  const builderPlan = (board: Board, p: Person, j: Job): Plan | null => {
    const i = j.builders.length;
    const load: Load = i === 0 ? 'ladder' : 'hod';
    const at = standFor(board, j, i);
    const home = board.homeStep(p, { tag: 'build:home', load });
    if (!home) return null;
    j.builders.push(p);
    // Where the load goes down: beside them, along the wall.
    const [dx, dz] = DIR4[at.dir]!;
    const c = board.centre(at.cell);
    // A ladder leans on the wall from just short of it; a hod sits on the ground beside them.
    const toWall = load === 'ladder' ? 0.16 : 0.1;
    const store = board.store(`build:${j.n}:${i}`, [{ x: c.x - dz * 0.28 + dx * toWall, y: c.y, z: c.z + dx * 0.28 + dz * toWall, yaw: at.face }]);
    j.stores.push(store);
    const work = BUILD.hammer * (0.85 + rand(p.seed, 'hammer', j.n) * 0.3);
    return {
      chain,
      at: 0,
      steps: [
        board.stepAt(at.cell, {
          spot: at.spot,
          face: at.face,
          pose: 'tend',
          linger: 0.8,
          load,
          brisk: true,
          tag: 'build:set-down',
          done: (q) => {
            if (j.done || !board.put(store, load)) return false;
            q.load = null;
          },
        }),
        board.stepAt(at.cell, { spot: at.spot, face: at.face, pose: 'hammer', linger: work, tag: 'build:hammer' }),
        board.stepAt(at.cell, {
          spot: at.spot,
          face: at.face,
          pose: 'tend',
          linger: 0.8,
          tag: 'build:pick-up',
          done: (q) => {
            q.load = board.take(store) ?? null;
            if (j.builders.every((b) => b === q || !board.plans.has(b) || (board.plans.get(b)?.at ?? 0) >= 2)) j.done = true;
          },
        }),
        home,
      ],
      fail: (q) => {
        // Set down and then called away: pick it up again if it is there, else (its ground is gone) it went with it.
        if (!q.load && board.count(store) > 0 && q.mode !== 'gone') q.load = board.take(store);
      },
    };
  };

  const watcherPlan = (board: Board, p: Person, j: Job): Plan | null => {
    const i = j.watchers.length + 2;
    const at = standFor(board, j, i);
    j.watchers.push(p);
    // A step back from the building, looking up at it.
    const [dx, dz] = DIR4[at.dir]!;
    const back = { x: at.spot.x - dx * 0.35 + (rand(p.seed, 'gawk', j.n) - 0.5) * 0.3, z: at.spot.z - dz * 0.35 };
    return { chain, at: 0, steps: [board.stepAt(at.cell, { spot: back, face: at.face, pose: 'look', linger: BUILD.look * (0.8 + rand(p.seed, 'gawk-t', j.n) * 0.4), tag: 'build:look' })] };
  };

  return chain;
}
