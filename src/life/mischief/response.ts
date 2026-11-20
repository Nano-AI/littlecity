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
import { rand } from '@/core/rand';
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
  /** How far (grid steps) the cart's suction hose reaches from where it is set down to the water. */
  suction: 6,
  /** Brigades at work at once, at most. */
  brigades: 2,
  /** Hands: a bucket chain at most this long; onlookers at most. */
  chain: 6,
  onlookers: 8,
  /** People within this many cells of a fire or a bomb get clear. */
  clear: 2.4,
  /** Everyone within this many cells of a nuke runs. */
  nukeClear: 12,
  /** Where they go to watch from. */
  watch: 4.5,
  /** Buildings with a crew at once, and hands to a crew. */
  sites: 4,
  crew: 2,
} as const;

export interface Brigade {
  structure: StructureId;
  /** Where the water comes from (a well's or the shore's cell middle). */
  water: { x: number; y: number; z: number };
  buckets: Person[];
  /** The cell the chain's last hand is aiming at (a burning block), by person. */
  aim: Map<Person, CellKey>;
}

type At = { x: number; y: number; z: number };

/**
 * The town's pump cart (one per town, kept by its main well or fountain, in plain sight). At a fire two
 * hands run to it, wheel it through the streets to near the fire and set it down; the suction hose is
 * dropped into the water; one takes the nozzle and walks to the fire, the hose paying out behind him on
 * the ground along the way he walked; the other works the pump; only then does water come. When the fire
 * is out the hose is walked back in and the cart is wheeled home. Nothing appears or goes from nowhere.
 */
export interface PumpCart {
  /** Where it is kept, and the walking cell there. */
  home: At & { face: number; cell: CellKey };
  /** Where it is now, and which way its shafts point. */
  at: At & { face: number };
  state: 'home' | 'muster' | 'wheel' | 'lay' | 'work' | 'reel' | 'return';
  structure: StructureId | null;
  pumper: Person | null;
  nozzle: Person | null;
  /** The cell it is set down in near the fire. */
  dest: CellKey | null;
  /** The water the suction hose goes to, and how far it has been let out (0 on the reel, 1 in the water). */
  water: At | null;
  suction: number;
  /** The delivery hose as laid: from the cart, along the ground the nozzle man walked. */
  hose: At[];
  /** The pump is being worked and the nozzle is in place: water flows. */
  flowing: boolean;
  /** The burning block the jet is aimed at. */
  aim: CellKey | null;
}

export interface FireChain extends Chain {
  readonly brigades: ReadonlyMap<StructureId, Brigade>;
  /** The town's pump cart, or null if the town has nowhere to keep one (only buckets, then). */
  readonly pump: PumpCart | null;
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
  const bombs = new Map<number, { x: number; z: number; people: Person[]; backAt: number | null; big: boolean }>();

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
    // The cart is on its way (or free to come): a bucket chain at the same water would only crowd it.
    if (pump && (pump.state === 'home' || pump.structure === sid)) return;
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
      const byWater = [...ring].sort((a, b) => board.dist(a, src.w) - board.dist(b, src.w) || a - b);
      const end = byWater[0];
      if (end === undefined) return;
      const brigade: Brigade = { structure: sid, water: w, buckets: [], aim: new Map() };
      // The bucket chain: along the line from the water to the nearest ring cell, a hand every 0.75.
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
        const stand = nav?.nodeAt.has(cell) && !tooHot(cell, hot) ? cell : i < n / 2 ? src.w : end;
        if (!reaches(board, p, stand)) return;
        const next = i + 1 < n ? { x: w.x + (e.x - w.x) * (0.12 + 0.82 * ((i + 1) / (n - 1))), z: w.z + (e.z - w.z) * (0.12 + 0.82 * ((i + 1) / (n - 1))) } : fireAt;
        board.assign(p, plan(board, [board.stepAt(stand, { spot: { x, z }, face: facing({ x, z }, next), pose: 'carry', linger: 1e6, brisk: true, load: i === 0 ? 'bucket' : null, tag: 'fire:bucket' })]));
        brigade.buckets.push(p);
        inc.people.set(p, 'bucket');
      });
      if (brigade.buckets.length > 0) {
        inc.brigade = brigade;
        brigades.set(sid, brigade);
      }
    }
  };

  // ── the pump cart ─────────────────────────────────────────────────────────
  let pump: PumpCart | null = null;

  /** Where the town keeps its cart: beside the well or fountain with the most of the town round it. */
  const cartHome = (board: Board): PumpCart['home'] | null => {
    const shape = board.shape;
    if (!shape || !board.nav) return null;
    const posts = [...board.posts('water'), ...board.posts('activity').filter((p) => p.role === 'fetch-water')].filter((p) => board.nav!.nodeAt.has(p.cell));
    if (posts.length === 0) return null;
    const houses: CellKey[] = [];
    for (const [cell, k] of shape.kinds) if (k === 'house' && keyY(cell) <= 3) houses.push(cell);
    const score = (c: CellKey): number => houses.filter((h) => Math.abs(keyX(h) - keyX(c)) + Math.abs(keyZ(h) - keyZ(c)) <= 8).length;
    const best = [...posts].sort((a, b) => score(b.cell) - score(a.cell) || a.cell - b.cell)[0]!;
    const c = middle(board, best.cell);
    const [dx, dz] = best.dir !== undefined ? DIR4[best.dir]! : [0, 1];
    // Beside the well, a little to one side, shafts out.
    const x = c.x - dz * 0.32 - dx * 0.12, z = c.z + dx * 0.32 - dz * 0.12;
    return { x, y: c.y, z, face: Math.atan2(-dx, -dz), cell: best.cell };
  };

  /** Two hands for the cart: free grown-ups nearest it. */
  const cartHands = (board: Board, near: CellKey): Person[] => hands(board, near, 2, () => false);

  /** To the cart: the first hand to its shafts, the second to its side. */
  const toCart = (board: Board, p: Person, cart: PumpCart, tag: string, side = 0, linger = 1e6): void => {
    const cell = key(Math.floor(cart.at.x), keyY(cart.home.cell), Math.floor(cart.at.z));
    const at = board.nav?.nodeAt.has(cell) ? cell : cart.dest ?? cart.home.cell;
    const f = cart.at.face;
    const spot = side === 0
      ? { x: cart.at.x - Math.sin(f) * 0.32, z: cart.at.z - Math.cos(f) * 0.32 }
      : { x: cart.at.x + Math.cos(f) * 0.3, z: cart.at.z - Math.sin(f) * 0.3 };
    board.assign(p, plan(board, [board.stepAt(at, { spot, face: f, pose: 'tend', linger, brisk: true, tag })]));
  };

  const lingering = (p: Person | null, tag: string): boolean => !!p && p.mode === 'linger' && tagOf(p) === tag;
  /** Someone the cart is waiting on has gone off (called away, gone home): the plan fell through. */
  const lost = (board: Board, p: Person | null): boolean => !p || p.mode === 'gone' || (!board.plans.has(p) && !tagOf(p).startsWith('fire:'));

  const stepPump = (board: Board, d: Director, dt: number): void => {
    const cart = pump;
    if (!cart) return;
    const burning = (sid: StructureId | null): CellKey[] => (sid === null ? [] : incidents.get(sid)?.cells ?? []);
    // The cart follows whoever wheels it: just ahead of them, shafts toward them.
    const follow = (p: Person): void => {
      cart.at = { x: p.x + Math.sin(p.heading) * 0.34, y: p.y, z: p.z + Math.cos(p.heading) * 0.34, face: p.heading + Math.PI };
    };
    switch (cart.state) {
      case 'home': {
        // A fire with no cart yet (the oldest first).
        const inc = [...incidents.values()].sort((a, b) => a.started - b.started || a.structure - b.structure)[0];
        if (!inc) return;
        const crew = cartHands(board, cart.home.cell);
        if (crew.length < 2) return;
        cart.structure = inc.structure;
        cart.pumper = crew[0]!;
        cart.nozzle = crew[1]!;
        toCart(board, cart.pumper, cart, 'fire:muster', 0);
        toCart(board, cart.nozzle, cart, 'fire:muster', 1);
        cart.state = 'muster';
        return;
      }
      case 'muster': {
        const hot = burning(cart.structure);
        if (hot.length === 0 || lost(board, cart.pumper) || lost(board, cart.nozzle)) return backHome(board);
        if (!lingering(cart.pumper, 'fire:muster') || !lingering(cart.nozzle, 'fire:muster')) return;
        // Where to set it down: near the fire, on the side nearest water.
        const src = water.filter((w) => !tooHot(w, hot)).sort((a, b) => board.dist(a, hot[0]!) - board.dist(b, hot[0]!) || a - b)[0];
        const ring = ringAround(board, hot, RESPONSE.near + 0.6, RESPONSE.far + 1).filter((c) => reaches(board, cart.pumper!, c));
        // As close to the fire as is safe, so long as the suction hose reaches the water from there.
        const dest = src === undefined
          ? undefined
          : [...ring].filter((c) => board.dist(c, src) <= RESPONSE.suction).sort((a, b) => nearestTo(a, hot).d - nearestTo(b, hot).d || board.dist(a, src) - board.dist(b, src) || a - b)[0];
        if (dest === undefined || src === undefined) return backHome(board);
        cart.dest = dest;
        cart.water = middle(board, src);
        const at = middle(board, dest);
        const fireAt = middle(board, hot[0]!);
        board.assign(cart.pumper!, plan(board, [board.stepAt(dest, { spot: { x: at.x, z: at.z }, face: facing(at, fireAt), pose: 'shake', linger: 1e6, tag: 'fire:pump' })]));
        // The other walks along beside the cart.
        board.assign(cart.nozzle!, plan(board, [board.stepAt(dest, { spot: { x: at.x + 0.25, z: at.z - 0.2 }, face: facing(at, fireAt), pose: 'stand', linger: 1e6, tag: 'fire:beside' })]));
        cart.state = 'wheel';
        return;
      }
      case 'wheel': {
        if (lost(board, cart.pumper)) return backHome(board);
        follow(cart.pumper!);
        if (!lingering(cart.pumper, 'fire:pump')) return;
        // Set down; the suction hose goes into the water; the nozzle man takes the hose to the fire.
        cart.hose = [{ x: cart.at.x, y: cart.at.y + 0.02, z: cart.at.z }];
        const hot = burning(cart.structure);
        if (hot.length === 0 || lost(board, cart.nozzle)) return reel(board);
        const ring = ringAround(board, hot, RESPONSE.near, RESPONSE.far).filter((c) => c !== cart.dest && reaches(board, cart.nozzle!, c));
        // As near the fire as is safe, and a walk from the cart (so the hose is seen paying out).
        const to = [...ring].filter((c) => board.dist(c, cart.dest!) >= 2).sort((a, b) => nearestTo(a, hot).d - nearestTo(b, hot).d || board.dist(a, cart.dest!) - board.dist(b, cart.dest!) || a - b)[0] ?? ring[0];
        if (to === undefined) return reel(board);
        const at = middle(board, to);
        const fireAt = middle(board, hot[0]!);
        // He takes the hose off the reel at the cart, then walks it out to the fire.
        const c = middle(board, cart.dest!);
        board.assign(cart.nozzle!, plan(board, [
          board.stepAt(cart.dest!, { spot: { x: cart.at.x + Math.cos(cart.at.face) * 0.28, z: cart.at.z - Math.sin(cart.at.face) * 0.28 }, face: facing(c, fireAt), pose: 'tend', linger: 0.7, brisk: true, tag: 'fire:take-hose' }),
          board.stepAt(to, { spot: { x: at.x, z: at.z }, face: facing(at, fireAt), pose: 'fish', linger: 1e6, tag: 'fire:hose' }),
        ]));
        cart.state = 'lay';
        return;
      }
      case 'lay':
      case 'work': {
        cart.suction = Math.min(1, cart.suction + dt / 1.5);
        const n = cart.nozzle;
        if (lost(board, n) || lost(board, cart.pumper)) return reel(board);
        // The hose pays out behind him along the ground, from when he has taken it up at the cart.
        const last = cart.hose[cart.hose.length - 1]!;
        if (tagOf(n!) === 'fire:hose' && Math.hypot(n!.x - last.x, n!.z - last.z) > 0.18) cart.hose.push({ x: n!.x, y: n!.y + 0.02, z: n!.z });
        const hot = burning(cart.structure);
        if (hot.length === 0) return reel(board);
        if (cart.state === 'lay' && lingering(n, 'fire:hose')) cart.state = 'work';
        cart.aim = nearestTo(n!.cell, hot).block;
        cart.flowing = cart.state === 'work' && cart.suction >= 1 && lingering(cart.pumper, 'fire:pump');
        if (cart.flowing) d.engine.douse(cart.aim, RESPONSE.hose * 1.6 * dt);
        return;
      }
      case 'reel': {
        cart.flowing = false;
        cart.aim = null;
        const n = cart.nozzle;
        // The hose is walked back in: it ends where he is now, along the way it was laid.
        if (n && !lost(board, n) && cart.hose.length > 1) {
          while (cart.hose.length > 1) {
            const end = cart.hose[cart.hose.length - 1]!;
            const before = cart.hose[cart.hose.length - 2]!;
            if (Math.hypot(n.x - before.x, n.z - before.z) < Math.hypot(end.x - before.x, end.z - before.z) - 0.02 || Math.hypot(n.x - end.x, n.z - end.z) < 0.12) cart.hose.pop();
            else break;
          }
        }
        if (n && !lost(board, n) && !lingering(n, 'fire:reeled')) return;
        cart.hose = [];
        cart.suction = Math.max(0, cart.suction - dt / 1.5);
        if (cart.suction > 0) return;
        // Wheeled home.
        const p = lost(board, cart.pumper) ? cartHands(board, cart.dest ?? cart.home.cell)[0] : cart.pumper;
        if (!p) return;
        cart.pumper = p;
        const h = cart.home;
        if (tagOf(p) !== 'fire:park') {
          const cell = key(Math.floor(cart.at.x), keyY(h.cell), Math.floor(cart.at.z));
          const pick = board.nav?.nodeAt.has(cell) ? cell : (cart.dest ?? h.cell);
          board.assign(p, plan(board, [
            board.stepAt(pick, { spot: { x: cart.at.x - Math.sin(cart.at.face) * 0.3, z: cart.at.z - Math.cos(cart.at.face) * 0.3 }, face: cart.at.face, pose: 'tend', linger: 0.5, brisk: true, tag: 'fire:take' }),
            board.stepAt(h.cell, { spot: { x: h.x - Math.sin(h.face) * 0.34, z: h.z - Math.cos(h.face) * 0.34 }, face: h.face, pose: 'tend', linger: 1.2, tag: 'fire:park' }),
          ]));
        }
        if (n && !lost(board, n) && board.plans.get(n)?.chain === chain) sendHome(board, n);
        cart.nozzle = null;
        cart.state = 'return';
        return;
      }
      case 'return': {
        const p = cart.pumper;
        if (!p || lost(board, p)) {
          cart.pumper = null;
          cart.state = 'reel';
          return;
        }
        if (tagOf(p) === 'fire:park') {
          if (p.mode === 'linger') {
            cart.at = { x: cart.home.x, y: cart.home.y, z: cart.home.z, face: cart.home.face };
            sendHome(board, p);
            cart.pumper = null;
            cart.structure = null;
            cart.dest = null;
            cart.water = null;
            cart.state = 'home';
          } else follow(p);
        }
        return;
      }
    }
  };

  /** The fire is out (or they cannot get there): the nozzle man walks the hose back to the cart. */
  const reel = (board: Board): void => {
    const cart = pump!;
    cart.flowing = false;
    cart.state = 'reel';
    const n = cart.nozzle;
    if (n && !lost(board, n) && cart.dest !== null) {
      const c = middle(board, cart.dest);
      board.assign(n, plan(board, [board.stepAt(cart.dest, { spot: { x: c.x + 0.25, z: c.z - 0.2 }, face: cart.at.face, pose: 'tend', linger: 1e6, tag: 'fire:reeled' })]));
    }
  };

  /** Nothing to do with the cart after all: everyone goes home and it stays (or is wheeled back) home. */
  const backHome = (board: Board): void => {
    const cart = pump!;
    for (const p of [cart.pumper, cart.nozzle]) if (p && !lost(board, p)) sendHome(board, p);
    cart.pumper = cart.nozzle = null;
    cart.structure = null;
    if (Math.hypot(cart.at.x - cart.home.x, cart.at.z - cart.home.z) < 0.05) cart.state = 'home';
    else {
      cart.nozzle = null;
      cart.hose = [];
      cart.state = 'reel';
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
      // A nuke clears the whole neighbourhood (everyone looks up at the whistle and runs).
      const big = e.bomb.nuke === true;
      const safe = big ? ringAround(board, [cell], RESPONSE.nukeClear + 1, RESPONSE.nukeClear + 5) : ringAround(board, [cell], RESPONSE.watch, RESPONSE.watch + 2.5);
      const people: Person[] = [];
      for (const p of board.crowd.people) {
        if (p.mode === 'gone' || !p.visible || engaged(p)) continue;
        if (Math.hypot(p.x - bx, p.z - bz) > (big ? RESPONSE.nukeClear : RESPONSE.clear + 1.5)) continue;
        const to = safe[(people.length * 3 + (p.seed & 1023)) % Math.max(1, safe.length)];
        if (to === undefined || !reaches(board, p, to)) continue;
        const at = middle(board, to);
        // Duck, then run.
        board.assign(p, plan(board, [
          board.stepAt(p.cell, { spot: { x: p.x, z: p.z }, face: facing(p, { x: bx, z: bz }), pose: 'cover', linger: 0.25, tag: 'bomb:duck' }),
          board.stepAt(to, { spot: { x: at.x, z: at.z }, face: facing(at, { x: bx, z: bz }), pose: 'cover', linger: 1e6, brisk: true, tag: 'bomb:clear' }),
        ]));
        people.push(p);
      }
      bombs.set(e.bomb.id, { x: bx, z: bz, people, backAt: null, big });
    } else if (e.type === 'blast') {
      const b = bombs.get(e.bomb);
      if (b) b.backAt = board.now + 2.5;
    }
  };

  const chain: FireChain = {
    id: 'mischief.fire',
    brigades,
    get pump() {
      return pump;
    },
    sync(board) {
      water = waterCells(board);
      const home = cartHome(board);
      if (!home) pump = null;
      else if (!pump) pump = { home, at: { x: home.x, y: home.y, z: home.z, face: home.face }, state: 'home', structure: null, pumper: null, nozzle: null, dest: null, water: null, suction: 0, hose: [], flowing: false, aim: null };
      else if (pump.state === 'home') {
        pump.home = home;
        pump.at = { x: home.x, y: home.y, z: home.z, face: home.face };
      }
      const d = dir(board);
      if (d) {
        d.brigades = brigades;
        d.pump = pump;
      }
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
        // Back to stare: at the crater's rim for the big one.
        const ring = b.big ? ringAround(board, [cell], 3.5, 6) : ringAround(board, [cell], 1.4, 2.6);
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
      // The pump cart goes about its work.
      d.pump = pump;
      stepPump(board, d, dt);
      // Water on the fire: the chain's last hand throws a bucket now and then.
      for (const inc of incidents.values()) {
        const b = inc.brigade;
        if (!b || inc.cells.length === 0) continue;
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
  /** The buildings with a crew sent to them, and who. */
  readonly sites: ReadonlyMap<StructureId, Person[]>;
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

/**
 * The town's builders (design section 13b, "The town rebuilds itself"). The mending itself belongs to the
 * damage (the director moves every damaged building through its stages over time, ./director.ts); this
 * chain is the life on top: by day, residents walk from their homes with a ladder, a hod and a cart to
 * buildings that are being mended and work there, and a building with a crew on it goes faster. A few
 * sites at once, two hands each; when a building is whole again, its crew goes home.
 */
export function rebuildChain(given?: Director): RebuildChain {
  const dir = directorOf(given);
  const sites = new Map<StructureId, Person[]>();
  let look = 0;
  const LOADS: Load[] = ['ladder', 'hod', 'cart'];

  const goHome = (board: Board, p: Person): void => {
    if (board.plans.get(p)?.chain !== chain && tagOf(p) !== 'rebuild:work') return;
    const home = board.homeStep(p, { tag: 'rebuild:home', load: p.load });
    if (home) board.assign(p, { chain, at: 0, steps: [home] });
    else board.drop(p);
  };

  const chain: RebuildChain = {
    id: 'mischief.rebuild',
    sites,
    sync(board) {
      for (const [sid, crew] of sites) {
        if (board.shape?.structures.has(sid)) continue;
        for (const p of crew) goHome(board, p);
        sites.delete(sid);
      }
    },
    offer() {
      return null;
    },
    step(dt, time, board) {
      const d = dir(board);
      if (!d || !board.nav || !board.shape) return;
      const shape = board.shape;
      // Which buildings are being mended now.
      const mending = new Set<StructureId>();
      if (d.rebuild) {
        for (const [cell, b] of shape.world.blocks) {
          if (!b.ruin || !ruinMending(b.ruin)) continue;
          const sid = shape.structureAt.get(cell);
          if (sid !== undefined) mending.add(sid);
        }
      }
      // Crews of buildings that are whole again (or the switch is off) go home.
      for (const [sid, crew] of sites) {
        if (mending.has(sid)) continue;
        for (const p of crew) goHome(board, p);
        sites.delete(sid);
      }
      // Who is at work where: the director mends those faster.
      const crewed = new Set<StructureId>();
      for (const [sid, crew] of sites) if (crew.some((p) => p.mode === 'linger' && tagOf(p) === 'rebuild:work')) crewed.add(sid);
      d.crewed = crewed;
      look += dt;
      if (look < 1 || time.isNight) return;
      look = 0;
      // New crews for mending buildings that have none, nearest homes first; a few sites at once.
      for (const sid of [...mending].sort((a, b) => a - b)) {
        if (sites.size >= RESPONSE.sites) break;
        if (sites.has(sid)) continue;
        const stands = standsOf(board, sid);
        if (stands.length === 0) continue;
        const crew: Person[] = [];
        const pool = board.crowd.people
          .filter((p) => canWork(p) && !p.scuffle && !board.plans.has(p) && board.claimedBy(p) === null && p.home !== sid && !tagOf(p).startsWith('fire:') && !tagOf(p).startsWith('rebuild:'))
          .map((p) => ({ p, d: board.dist(p.cell, stands[0]!.cell) }))
          .sort((a, b) => a.d - b.d || (a.p.seed >>> 0) - (b.p.seed >>> 0));
        for (const { p } of pool) {
          if (crew.length >= RESPONSE.crew) break;
          const at = stands[(crew.length * 2 + sid) % stands.length]!;
          if (!reaches(board, p, at.cell)) continue;
          crew.push(p);
          const c = board.centre(at.cell);
          const fetch = board.homeStep(p, { tag: 'rebuild:fetch', linger: 1.2 });
          board.assign(p, {
            chain,
            at: 0,
            steps: [
              // From home, with the tools of the trade.
              ...(fetch ? [fetch] : []),
              board.stepAt(at.cell, {
                spot: { x: c.x + (rand(p.seed, 'mend-x', sid) - 0.5) * 0.3, z: c.z + (rand(p.seed, 'mend-z', sid) - 0.5) * 0.3 },
                face: at.face,
                pose: 'hammer',
                linger: 1e6,
                load: LOADS[(crew.length - 1 + sid) % LOADS.length]!,
                tag: 'rebuild:work',
              }),
            ],
          });
        }
        if (crew.length > 0) sites.set(sid, crew);
      }
    },
  };
  return chain;
}

/** The two mischief chains, for the living town's list (src/life/town/index.ts). */
export function mischiefChains(director?: Director): Chain[] {
  return [fireChain(director), rebuildChain(director)];
}
