// The town answers mischief (design section 13b, "The town fights back",
// "The town rebuilds itself"): two chains of the living town's errand
// engine (src/life/town). Owner: Mischief.
//
// FIRE. When a building burns, the town turns out:
//   - a fire brigade, if water is in reach (a well, a fountain, the shore):
//     a pump cart is wheeled from the water to a spot near the fire, one
//     hand works its pump, two play hoses on the flames (the cart, the hoses
//     and the jets of water are drawn by the mischief system);
//   - a bucket chain from the same water: people stand in a line and pass
//     buckets, the last throws them on the fire;
//   - more hands for a bigger fire; where the water lands the fire dies back;
//   - everyone else near runs clear and stands at a safe distance to watch;
//     the residents of the burning house come out and stand outside, glum;
//   - when it is out (or burnt out), everyone goes home.
// Nobody is ever sent to stand in, on or next to a burning building.
//
// BOMB. People near the bomb when it lands duck and run; after the bang
// they creep back to stare at what is left.
//
// REBUILD. When things have been quiet for a while, a crew of three walks
// from their homes with a ladder, a hod and a cart to the first damaged
// building, works round it, and mends it a step at a time (the mending
// look, src/gen/damage) until it is as it was built; then the next. The
// Rebuild switch (director.rebuild) stops it.
//
// Pure of the clock: time comes from `step`, chance from rand(seed, …).

import { CELL_H, columnIndex, DIR4, inColumnBounds, key, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import { hash, rand } from '@/core/rand';
import type { StructureId } from '@/resolve/plan';
import { ruinMending } from '@/world/damage';
import type { Person } from '../people/crowd';
import type { Load } from '../people/errand';
import type { Board, Chain, Plan, PlanStep } from '../town/board';
import { canWork, reaches } from '../town/hands';
import { mischiefOf, type Director, type MischiefEvent } from './director';

/** Numbers of the town's answer. */
export const RESPONSE = {
  /** How far (grid steps) a brigade will carry water. */
  waterReach: 14,
  /** Firefighters stand this far from the nearest burning block (cells, centre to centre), and no nearer. */
  near: 1.9,
  far: 3.4,
  /** Water a hose puts on a fire, and a bucket (intensity per second, per thrower). */
  hose: 0.32,
  bucket: 0.22,
  /** Brigades at work at once, at most. */
  brigades: 2,
  /** Hands: a bucket chain at most this long; onlookers at most. */
  chain: 6,
  onlookers: 8,
  /** People within this many cells of a fire or a bomb get clear. */
  clear: 2.4,
  /** Where they go to watch from. */
  watch: 4.5,
  /** Seconds of quiet before the builders come. */
  quiet: 8,
  /** Seconds between steps of mending while a builder is at work. */
  mendTick: 2.2,
} as const;

export interface Brigade {
  structure: StructureId;
  /** Where the water comes from (a well's or the shore's cell middle) and where the cart stands. */
  water: { x: number; y: number; z: number };
  cart: { x: number; y: number; z: number; face: number } | null;
  pumper: Person | null;
  nozzles: Person[];
  buckets: Person[];
  /** The cell each nozzle and the chain's last hand are aiming at (a burning block), by person. */
  aim: Map<Person, CellKey>;
}

export interface FireChain extends Chain {
  readonly brigades: ReadonlyMap<StructureId, Brigade>;
}

type DirectorOf = (board: Board) => Director | null;
const directorOf =
  (given?: Director): DirectorOf =>
  (board) =>
    given ?? (board.stage ? mischiefOf(board.stage) : null);

/** A walkable cell's middle on the ground plan, and its floor height. */
function middle(board: Board, cell: CellKey): { x: number; y: number; z: number } {
  return board.centre(cell);
}

/** The nav nodes' cells, with no block of a structure in them (people stand there). */
function standable(board: Board): CellKey[] {
  const nav = board.nav;
  if (!nav) return [];
  return nav.nodes.map((n) => n.cell);
}

/** Cells next to water a person can stand in (a quay, a beach), and the posts of wells and fountains. */
function waterCells(board: Board): CellKey[] {
  const out: CellKey[] = [];
  for (const post of [...board.posts('water'), ...board.posts('activity').filter((p) => p.role === 'fetch-water')]) out.push(post.cell);
  const shape = board.shape;
  if (!shape) return out;
  for (const c of standable(board)) {
    const x = keyX(c), z = keyZ(c);
    for (const [dx, dz] of DIR4) {
      const nx = x + dx, nz = z + dz;
      if (!inColumnBounds(nx, nz)) continue;
      if (shape.terrain.height[columnIndex(nx, nz)] === 0 && !shape.kinds.has(key(nx, 0, nz))) {
        out.push(c);
        break;
      }
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Distance on the ground plan from a cell's middle to the nearest of some blocks. */
function nearestTo(cell: CellKey, blocks: readonly CellKey[]): { d: number; block: CellKey } {
  let best = Infinity, block = blocks[0]!;
  const x = keyX(cell) + 0.5, z = keyZ(cell) + 0.5;
  for (const b of blocks) {
    const d = Math.hypot(keyX(b) + 0.5 - x, keyZ(b) + 0.5 - z) + Math.abs(keyY(b) - keyY(cell)) * 0.3;
    if (d < best) {
      best = d;
      block = b;
    }
  }
  return { d: best, block };
}

/** The tag of the errand a person is on (or lingering at the end of), or ''. */
export const tagOf = (p: Person): string => p.goal?.errand?.tag ?? '';

const facing = (from: { x: number; z: number }, to: { x: number; z: number }): number => Math.atan2(to.x - from.x, to.z - from.z);

interface Incident {
  structure: StructureId;
  cells: CellKey[];
  started: number;
  brigade: Brigade | null;
  /** Everyone the incident has sent somewhere, and what for. */
  people: Map<Person, 'nozzle' | 'pump' | 'bucket' | 'clear' | 'watch' | 'glum'>;
  /** Seconds since the last throw of the chain's last hand. */
  throwAt: number;
  /** When a brigade was last tried for it. */
  formedAt: number;
}

export function fireChain(given?: Director): FireChain {
  const dir = directorOf(given);
  const incidents = new Map<StructureId, Incident>();
  const brigades = new Map<StructureId, Brigade>();
  let water: CellKey[] = [];
  let since = 0;
  let off: (() => void) | null = null;
  let offOn: Director | null = null;
  /** Bomb drills: people sent clear of a bomb, and the time to go back and stare. */
  const bombs = new Map<number, { x: number; z: number; people: Person[]; backAt: number | null }>();

  /** Every person in the town who is already somebody's answer to mischief. */
  const engaged = (p: Person): boolean => {
    for (const i of incidents.values()) if (i.people.has(p)) return true;
    for (const b of bombs.values()) if (b.people.includes(p)) return true;
    return false;
  };

  const burningCells = (d: Director): Map<StructureId, CellKey[]> => {
    const by = new Map<StructureId, CellKey[]>();
    for (const b of d.engine.burning()) {
      if (b.structure === undefined) continue;
      let l = by.get(b.structure);
      if (!l) by.set(b.structure, (l = []));
      l.push(b.cell);
    }
    return by;
  };

  /** Cells where nobody may stand: in or next to anything burning. */
  const tooHot = (cell: CellKey, hot: readonly CellKey[]): boolean => nearestTo(cell, hot).d < 1.45;

  /** Standing cells a ring away from the fire, nearest first, none too hot. */
  const ringAround = (board: Board, hot: readonly CellKey[], near: number, far: number): CellKey[] => {
    const out: { c: CellKey; d: number }[] = [];
    for (const c of standable(board)) {
      const { d } = nearestTo(c, hot);
      if (d >= near && d <= far && !tooHot(c, hot)) out.push({ c, d });
    }
    return out.sort((a, b) => a.d - b.d || a.c - b.c).map((o) => o.c);
  };

  const plan = (board: Board, steps: PlanStep[], fail?: () => void): Plan => ({ chain, at: 0, steps, ...(fail ? { fail } : {}) });

  const sendHome = (board: Board, p: Person): void => {
    const home = board.homeStep(p, { tag: 'mischief:home' });
    if (home) board.assign(p, plan(board, [home]));
    else board.drop(p);
  };

  /** Candidates for a job near a cell: grown-ups free to come, nearest first. */
  const hands = (board: Board, near: CellKey, n: number, avoid: (p: Person) => boolean): Person[] => {
    const out: { p: Person; d: number }[] = [];
    for (const p of board.crowd.people) {
      if (!canWork(p) || p.scuffle || engaged(p) || avoid(p) || !p.visible && p.mode !== 'home') continue;
      if (!reaches(board, p, near)) continue;
      const d = board.dist(p.cell, near);
      if (d > RESPONSE.waterReach * 2) continue;
      out.push({ p, d });
    }
    return out.sort((a, b) => a.d - b.d || (a.p.seed >>> 0) - (b.p.seed >>> 0)).slice(0, n).map((o) => o.p);
  };

  /** A brigade for an incident, if there is water within reach and hands to spare. */
  const formBrigade = (board: Board, inc: Incident): void => {
    const sid = inc.structure;
    const hot = inc.cells;
    const fire = hot[0]!;
    const fireAt = middle(board, fire);
    const src = water
      .filter((w) => !tooHot(w, hot))
      .map((w) => ({ w, d: board.dist(w, fire) }))
      .filter((o) => o.d <= RESPONSE.waterReach)
      .sort((a, b) => a.d - b.d || a.w - b.w)[0];
    if (src) {
      const ring = ringAround(board, hot, RESPONSE.near, RESPONSE.far).filter((c) => !tooHot(c, hot));
      const w = middle(board, src.w);
      // The cart parks on the ring cell nearest the water; the hoses go to two other ring cells.
      const byWater = [...ring].sort((a, b) => board.dist(a, src.w) - board.dist(b, src.w) || a - b);
      const cartCell = byWater[0];
      if (cartCell !== undefined) {
        const brigade: Brigade = { structure: sid, water: w, cart: null, pumper: null, nozzles: [], buckets: [], aim: new Map() };
        const cartAt = middle(board, cartCell);
        const crew = hands(board, src.w, 3 + Math.min(3, Math.floor(hot.length / 2)), (p) => p.home === sid);
        const pumper = crew.shift();
        if (pumper && reaches(board, pumper, cartCell)) {
          brigade.pumper = pumper;
          brigade.cart = { ...cartAt, face: facing(cartAt, fireAt) };
          // To the water, take up the cart (drawn as theirs while it is on the move), then wheel it to the fire.
          board.assign(pumper, plan(board, [
            board.stepAt(src.w, { spot: null, face: NaN, pose: 'tend', linger: 0.8, brisk: true, tag: 'fire:fetch-pump' }),
            board.stepAt(cartCell, { spot: { x: cartAt.x, z: cartAt.z }, face: facing(cartAt, fireAt), pose: 'shake', linger: 1e6, brisk: true, load: 'cart', tag: 'fire:pump', done: (q) => void (q.load = null) }),
          ]));
          inc.people.set(pumper, 'pump');
        }
        const spots = ring.filter((c) => c !== cartCell);
        for (const p of crew.splice(0, 2)) {
          const to = spots.shift();
          if (to === undefined || !reaches(board, p, to)) continue;
          const at = middle(board, to);
          board.assign(p, plan(board, [board.stepAt(to, { spot: { x: at.x, z: at.z }, face: facing(at, fireAt), pose: 'fish', linger: 1e6, brisk: true, tag: 'fire:hose' })]));
          brigade.nozzles.push(p);
          inc.people.set(p, 'nozzle');
        }
        // The bucket chain: along the line from the water to the nearest ring cell, a hand every 0.7.
        const end = byWater[0]!;
        const e = middle(board, end);
        const len = Math.hypot(e.x - w.x, e.z - w.z);
        const n = Math.min(RESPONSE.chain, Math.max(2, Math.round(len / 0.75)));
        const line = hands(board, src.w, n, (p) => p.home === sid);
        line.forEach((p, i) => {
          const t = n === 1 ? 1 : i / (n - 1);
          const x = w.x + (e.x - w.x) * (0.12 + 0.82 * t) + (i % 2 ? 0.15 : -0.15) * ((e.z - w.z) / (len || 1));
          const z = w.z + (e.z - w.z) * (0.12 + 0.82 * t) - (i % 2 ? 0.15 : -0.15) * ((e.x - w.x) / (len || 1));
          const cell = key(Math.floor(x), keyY(end), Math.floor(z));
          const nav = board.nav;
          const stand = nav?.nodeAt.has(cell) && !tooHot(cell, hot) ? cell : (i < n / 2 ? src.w : end);
          if (!reaches(board, p, stand)) return;
          const next = i + 1 < n ? { x: w.x + (e.x - w.x) * (0.12 + 0.82 * ((i + 1) / (n - 1))), z: w.z + (e.z - w.z) * (0.12 + 0.82 * ((i + 1) / (n - 1))) } : fireAt;
          board.assign(p, plan(board, [board.stepAt(stand, { spot: { x, z }, face: facing({ x, z }, next), pose: 'carry', linger: 1e6, brisk: true, load: i === 0 ? 'bucket' : null, tag: 'fire:bucket' })]));
          brigade.buckets.push(p);
          inc.people.set(p, 'bucket');
        });
        if (brigade.pumper || brigade.nozzles.length > 0 || brigade.buckets.length > 0) {
          inc.brigade = brigade;
          brigades.set(sid, brigade);
        }
      }
    }
  };

  const start = (board: Board, d: Director, sid: StructureId, hot: CellKey[]): Incident => {
    const inc: Incident = { structure: sid, cells: hot, started: board.now, brigade: null, people: new Map(), throwAt: 0, formedAt: -Infinity };
    const fire = hot[0]!;
    const fireAt = middle(board, fire);
    // 1. Everyone in, on or next to it gets out and clear; the people who live there stand outside, glum.
    const safe = ringAround(board, hot, RESPONSE.watch - 1, RESPONSE.watch + 2);
    let k = 0;
    for (const p of board.crowd.people) {
      if (p.mode === 'gone' || p.leaving) continue;
      const mine = p.home === sid;
      const inside = board.shape?.structureAt.get(p.cell) === sid || p.inside?.structure === sid;
      const near = Math.hypot(p.x - fireAt.x, p.z - fireAt.z) < RESPONSE.clear + 1;
      if (!mine && !inside && !near) continue;
      const to = safe[(k++ * 3 + (p.seed & 1023)) % Math.max(1, safe.length)];
      if (to === undefined) continue;
      const at = middle(board, to);
      const jitter = { x: at.x + (rand(p.seed, 'clear', sid) - 0.5) * 0.5, z: at.z + (rand(p.seed, 'clear-z', sid) - 0.5) * 0.5 };
      board.assign(p, plan(board, [board.stepAt(to, { spot: jitter, face: facing(jitter, fireAt), pose: mine ? 'tend' : 'look', linger: 1e6, brisk: true, tag: mine ? 'fire:glum' : 'fire:clear' })]));
      inc.people.set(p, mine ? 'glum' : 'clear');
    }
    // 3. Onlookers: a few people near come to watch from a safe distance, pointing now and then.
    const watchFrom = ringAround(board, hot, RESPONSE.watch, RESPONSE.watch + 2.5);
    const lookers = hands(board, fire, RESPONSE.onlookers, (p) => Math.hypot(p.x - fireAt.x, p.z - fireAt.z) > 10).filter((p) => !inc.people.has(p));
    lookers.forEach((p, i) => {
      const to = watchFrom[(i * 5 + (p.seed & 1023)) % Math.max(1, watchFrom.length)];
      if (to === undefined || !reaches(board, p, to)) return;
      const at = middle(board, to);
      const spot = { x: at.x + (rand(p.seed, 'look', sid) - 0.5) * 0.5, z: at.z + (rand(p.seed, 'look-z', sid) - 0.5) * 0.5 };
      board.assign(p, plan(board, [board.stepAt(to, { spot, face: facing(spot, fireAt), pose: i % 3 === 0 ? 'wave' : 'look', linger: 1e6, tag: 'fire:watch' })]));
      inc.people.set(p, 'watch');
    });
    void d;
    return inc;
  };

  const finish = (board: Board, inc: Incident): void => {
    for (const [p] of inc.people) if (board.plans.get(p)?.chain === chain || tagOf(p).startsWith('fire:')) sendHome(board, p);
    brigades.delete(inc.structure);
    incidents.delete(inc.structure);
  };

  /** On the spot and working: lingering where the plan put them (the board lets a plan go once its last step is reached). */
  const atWork = (_board: Board, p: Person): boolean => p.mode === 'linger' && tagOf(p).startsWith('fire:') && tagOf(p) !== 'fire:fetch-pump';

  const onEvent = (board: Board, e: MischiefEvent): void => {
    if (e.type === 'drop') {
      const [bx, , bz] = e.bomb.point;
      const cell = key(Math.floor(bx), Math.max(0, Math.floor(e.bomb.point[1] / CELL_H)), Math.floor(bz));
      const safe = ringAround(board, [cell], RESPONSE.watch, RESPONSE.watch + 2.5);
      const people: Person[] = [];
      for (const p of board.crowd.people) {
        if (p.mode === 'gone' || !p.visible || engaged(p)) continue;
        if (Math.hypot(p.x - bx, p.z - bz) > RESPONSE.clear + 1.5) continue;
        const to = safe[(people.length * 3 + (p.seed & 1023)) % Math.max(1, safe.length)];
        if (to === undefined || !reaches(board, p, to)) continue;
        const at = middle(board, to);
        // Duck, then run.
        board.assign(p, plan(board, [
          board.stepAt(p.cell, { spot: { x: p.x, z: p.z }, face: facing(p, { x: bx, z: bz }), pose: 'cover', linger: 0.6, tag: 'bomb:duck' }),
          board.stepAt(to, { spot: { x: at.x, z: at.z }, face: facing(at, { x: bx, z: bz }), pose: 'cover', linger: 1e6, brisk: true, tag: 'bomb:clear' }),
        ]));
        people.push(p);
      }
      bombs.set(e.bomb.id, { x: bx, z: bz, people, backAt: null });
    } else if (e.type === 'blast') {
      const b = bombs.get(e.bomb);
      if (b) b.backAt = board.now + 2.5;
    }
  };

  const chain: FireChain = {
    id: 'mischief.fire',
    brigades,
    sync(board) {
      water = waterCells(board);
      const d = dir(board);
      if (d) d.brigades = brigades;
      if (d && d !== offOn) {
        off?.();
        offOn = d;
        off = d.on((e) => onEvent(board, e));
      }
    },
    offer() {
      return null;
    },
    step(dt, _time, board) {
      const d = dir(board);
      if (!d || !board.nav) return;
      // Bombs: once it has gone off, people creep back to stare at what is left.
      for (const [id, b] of bombs) {
        if (b.backAt === null || board.now < b.backAt) continue;
        const cell = key(Math.floor(b.x), 1, Math.floor(b.z));
        const ring = ringAround(board, [cell], 1.4, 2.6);
        b.people.forEach((p, i) => {
          const to = ring[(i * 2 + (p.seed & 1023)) % Math.max(1, ring.length)];
          if (to === undefined || !reaches(board, p, to)) return sendHome(board, p);
          const at = middle(board, to);
          board.assign(p, plan(board, [
            board.stepAt(to, { spot: { x: at.x, z: at.z }, face: facing(at, b), pose: 'look', linger: 6 + rand(p.seed, 'stare', id) * 5, tag: 'bomb:stare' }),
            ...(board.homeStep(p, { tag: 'bomb:home' }) ? [board.homeStep(p, { tag: 'bomb:home' })!] : []),
          ]));
        });
        bombs.delete(id);
      }
      since += dt;
      if (since < 0.25) {
        // Between looks, the water still goes on the fire.
      } else {
        since = 0;
        const now = burningCells(d);
        for (const [sid, hot] of now) {
          const inc = incidents.get(sid);
          if (inc) inc.cells = hot;
          else incidents.set(sid, start(board, d, sid, hot));
        }
        // Brigades: two at once at most, the oldest fires first; a free brigade's crew goes on to the next.
        for (const inc of [...incidents.values()].sort((a, b) => a.started - b.started || a.structure - b.structure)) {
          if (brigades.size >= RESPONSE.brigades) break;
          if (!inc.brigade && board.now - inc.formedAt > 2) {
            inc.formedAt = board.now;
            formBrigade(board, inc);
          }
        }
        for (const inc of [...incidents.values()]) if (!now.has(inc.structure)) finish(board, inc);
      }
      // Water on the fire: hoses play on the nearest burning block; the chain's last hand throws a bucket now and then.
      for (const inc of incidents.values()) {
        const b = inc.brigade;
        if (!b || inc.cells.length === 0) continue;
        for (const p of b.nozzles) {
          if (!atWork(board, p)) {
            b.aim.delete(p);
            continue;
          }
          const target = nearestTo(p.cell, inc.cells).block;
          b.aim.set(p, target);
          // The hose needs the pump going.
          if (b.pumper && atWork(board, p) && atWork(board, b.pumper)) d.engine.douse(target, RESPONSE.hose * dt);
          else if (!b.pumper) d.engine.douse(target, RESPONSE.hose * 0.5 * dt);
        }
        const last = b.buckets[b.buckets.length - 1];
        const ready = b.buckets.length > 0 && b.buckets.every((p) => atWork(board, p));
        if (last && ready) {
          const target = nearestTo(last.cell, inc.cells).block;
          b.aim.set(last, target);
          inc.throwAt += dt;
          if (inc.throwAt >= 1.4) {
            inc.throwAt = 0;
            d.engine.douse(target, RESPONSE.bucket * 1.4 * Math.min(1, b.buckets.length / 3));
          }
        } else if (last) b.aim.delete(last);
      }
    },
    dispose() {
      off?.();
      off = null;
    },
  };
  return chain;
}

export interface RebuildChain extends Chain {
  /** The building being mended now, and its crew. */
  readonly job: { structure: StructureId; crew: Person[] } | null;
}

/** Walkable cells round a structure's ground storey, facing it (as the builders of L54 stand). */
function standsOf(board: Board, sid: StructureId): { cell: CellKey; face: number }[] {
  const st = board.shape?.structures.get(sid);
  const nav = board.nav;
  if (!st || !nav) return [];
  const low = Math.min(...st.cells.map((c) => keyY(c)));
  const out: { cell: CellKey; face: number }[] = [];
  const heading = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];
  for (const c of st.cells) {
    if (keyY(c) !== low) continue;
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIR4[d]!;
      const at = key(keyX(c) + dx, low, keyZ(c) + dz);
      if (!nav.nodeAt.has(at) || st.cells.includes(at) || out.some((o) => o.cell === at)) continue;
      out.push({ cell: at, face: heading[(d + 2) % 4]! });
    }
  }
  return out.sort((a, b) => a.cell - b.cell);
}

export function rebuildChain(given?: Director): RebuildChain {
  const dir = directorOf(given);
  let job: { structure: StructureId; crew: Person[]; tick: number } | null = null;
  let quiet = 0;

  const damaged = (board: Board): StructureId[] => {
    const shape = board.shape;
    if (!shape) return [];
    const out = new Set<StructureId>();
    for (const [cell, b] of shape.world.blocks) {
      if (!b.ruin) continue;
      const s = shape.structureAt.get(cell);
      if (s !== undefined) out.add(s);
    }
    return [...out].sort((a, b) => a - b);
  };

  const finishJob = (board: Board): void => {
    if (!job) return;
    for (const p of job.crew) {
      if (board.plans.get(p)?.chain !== chain && tagOf(p) !== 'rebuild:work') continue;
      const home = board.homeStep(p, { tag: 'rebuild:home', load: p.load });
      if (home) board.assign(p, { chain, at: 0, steps: [home] });
      else board.drop(p);
    }
    job = null;
  };

  const LOADS: Load[] = ['ladder', 'hod', 'cart'];

  const chain: RebuildChain = {
    id: 'mischief.rebuild',
    get job() {
      return job ? { structure: job.structure, crew: job.crew } : null;
    },
    sync(board) {
      if (job && !board.shape?.structures.has(job.structure)) finishJob(board);
    },
    offer() {
      return null;
    },
    step(dt, time, board) {
      const d = dir(board);
      if (!d || !board.nav || !board.shape) return;
      if (!d.rebuild) {
        finishJob(board);
        return;
      }
      quiet = d.busy || d.active ? 0 : quiet + dt;
      if (job) {
        // Done: no damage left on it.
        const st = board.shape.structures.get(job.structure);
        const left = st?.cells.some((c) => board.shape!.world.blocks.get(c)?.ruin) ?? false;
        if (!left || d.busy) {
          finishJob(board);
          return;
        }
        const working = job.crew.filter((p) => p.mode === 'linger' && tagOf(p) === 'rebuild:work');
        if (working.length > 0) {
          job.tick += dt * (0.6 + 0.4 * Math.min(3, working.length));
          if (job.tick >= RESPONSE.mendTick * 1.6) {
            job.tick = 0;
            d.autoMend(st!.cells[0]!);
          }
        }
        return;
      }
      if (quiet < RESPONSE.quiet || time.isNight) return;
      // The next building, and a crew from the nearest homes.
      for (const sid of damaged(board)) {
        const stands = standsOf(board, sid);
        if (stands.length === 0) continue;
        const crew: Person[] = [];
        const pool = board.crowd.people
          .filter((p) => canWork(p) && !p.scuffle && !board.plans.has(p) && board.claimedBy(p) === null && p.home !== sid)
          .map((p) => ({ p, d: board.dist(p.cell, stands[0]!.cell) }))
          .sort((a, b) => a.d - b.d || (a.p.seed >>> 0) - (b.p.seed >>> 0));
        for (const { p } of pool) {
          if (crew.length >= 3) break;
          const at = stands[(crew.length * 2 + sid) % stands.length]!;
          if (!reaches(board, p, at.cell)) continue;
          crew.push(p);
          const c = board.centre(at.cell);
          const load = LOADS[crew.length - 1]!;
          board.assign(p, {
            chain,
            at: 0,
            steps: [
              // From home, with the tools of the trade.
              ...(board.homeStep(p, { tag: 'rebuild:fetch' }) ? [board.homeStep(p, { tag: 'rebuild:fetch', linger: 1.2 })!] : []),
              board.stepAt(at.cell, {
                spot: { x: c.x + (rand(p.seed, 'mend-x', sid) - 0.5) * 0.3, z: c.z + (rand(p.seed, 'mend-z', sid) - 0.5) * 0.3 },
                face: at.face,
                pose: 'hammer',
                linger: 1e6,
                load,
                tag: 'rebuild:work',
              }),
            ],
          });
        }
        if (crew.length > 0) {
          job = { structure: sid, crew, tick: 0 };
          // A building already in scaffolding is picked up where it was; one that is not gets it now.
          const st = board.shape.structures.get(sid)!;
          if (!st.cells.some((c) => ruinMending(board.shape!.world.blocks.get(c)?.ruin))) d.autoMend(st.cells[0]!);
        }
        void hash;
        return;
      }
    },
  };
  return chain;
}

/** The two mischief chains, for the living town's list (src/life/town/index.ts). */
export function mischiefChains(director?: Director): Chain[] {
  return [fireChain(director), rebuildChain(director)];
}
