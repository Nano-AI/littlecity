// The crowd (People, Stage 3; catalogue L21, L22, L24, L25, L27, L32).
//
// The whole simulation of the residents, with no drawing in it: who is
// where, where they are going, how they get there. `people.system.ts` runs
// one of these and draws what it says; the tests in crowd.test.ts step one
// with fixed time steps and check that nobody ever leaves the walking graph.
//
// Deterministic: every choice is rand(person seed, a name, a counter), and
// time comes only from the `time` signal handed to `step`. The same town
// stepped the same way gives the same walks.
//
// A PERSON is always in one of these modes:
//   home     inside their house, not drawn. A timer runs down to the next outing.
//   walk     following the pieces of a walk (walk.ts) toward a goal
//   linger   at a haunt, in a pose, for 5–20 seconds
//   visit    inside a shop or another house, not drawn
//   hop      jumping to the nearest walkable cell after being built over (L27)
//   wait     drawn, standing, waiting for a route to be planned
//   gone     walked off or faded; removed at the end of the step
//
// What a town offers comes from the plan: `resident` actors (L21), haunt-*
// sockets (L22, L25, L32), `arrival` and `way-out` sockets (L27),
// `queue-point` sockets (L24).

import { DIR4, keyX, keyY, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { hash, rand } from '@/core/rand';
import type { SocketType } from '@/core/vocab';
import type { TimeSignal } from '@/life/api';
import type { PoseName } from '@/parts/people/pose';
import { usableDoors } from '@/resolve/nav';
import type { DressingPlan, NavDoor, NavGraph, ShapePlan, StructureId } from '@/resolve/plan';
import { PEOPLE, PERSON } from '@/style/people';
import { createRouter, type Router } from './route';
import { buildWalk, nodeCentre, nodeHeight, pieceAt, type DoorPlace, type Piece, type Point } from './walk';

export type Mode = 'home' | 'walk' | 'linger' | 'visit' | 'hop' | 'wait' | 'gone';

export interface Haunt {
  /** The socket's id. */
  id: string;
  type: SocketType;
  node: number;
  cell: CellKey;
  dir?: Dir4;
  structure?: StructureId;
  /** The socket's `name`: a seat socket's id, 'step' or 'pot' (stoop), 'stars' or 'fisher' (night). */
  name?: string;
  user: Person | null;
}

export interface Goal {
  kind: 'home' | 'haunt' | 'leave';
  node: number;
  haunt: Haunt | null;
  /** Go in at this door at the end. */
  door: NavDoor | null;
  /** Where to stand in the node's cell, and which way to face (radians; NaN = as arrived). */
  spot: Point | null;
  face: number;
  pose: PoseName;
  linger: number;
  /** Sitting: height of the seat above the floor; -1 when not sitting. */
  seat: number;
}

export interface Person {
  readonly id: string;
  home: StructureId;
  readonly index: number;
  readonly look: number;
  readonly child: boolean;
  readonly seed: number;
  /** 0–1, fixed per person: orders who goes home first, who is a night owl, who rises early. */
  readonly rank: number;
  readonly speed: number;
  /** Among the few allowed out at night (L25). */
  owl: boolean;
  /** Their house has no door they can use: at home for good (resident/indoors). */
  shutIn: boolean;

  mode: Mode;
  visible: boolean;
  /** 0–1: fading in at the shore or out at the edge of the map. */
  fade: number;
  x: number;
  y: number;
  z: number;
  /** Radians about the vertical; 0 faces +z, π/2 faces +x. */
  heading: number;
  pose: PoseName;
  /** Seconds in the current pose (idle poses), and the stride phase (walk). */
  poseTime: number;
  stride: number;
  /** Seat height when sitting, else -1. */
  seat: number;

  /** The graph node whose cell they are in (the node outside the door when inside), and that cell. */
  node: number;
  cell: CellKey;
  walk: Piece[] | null;
  at: number;
  t: number;
  goal: Goal | null;
  /** A goal waiting for its route. */
  want: Goal | null;
  timer: number;
  /** The single-file run they are in, or -1, and the way they are going through it. */
  held: number;
  /** Outings and choices made so far: the counter behind every seeded choice. */
  trips: number;
  /** Seconds spent held up behind somebody (negative: seconds left of stepping round them), and the speed share that leaves them this step. */
  stuck: number;
  slow: number;
  /** Waiting at the end of a single-file stretch. */
  queued: boolean;
  /** The building they are inside while `visit`. */
  inside: NavDoor | null;
  /** hop: where from, where to, how far along. */
  hop: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; t: number } | null;
  /** Their home is gone: walking off. */
  leaving: boolean;
  /** Stop and look (L26): seconds left, and the heading to turn to. */
  startled: number;
  startledFace: number;
}

export interface CrowdEvents {
  /** A home's count of residents inside changed. */
  home?(home: StructureId, count: number): void;
  /** A walker stepped into a new cell. */
  passed?(cell: CellKey, person: Person): void;
  /** Somebody was added or removed (the drawing must follow). */
  added?(person: Person): void;
  removed?(person: Person): void;
}

export interface CrowdOptions {
  /** How many residents to run (L21: 60 on a desktop, 30 on a phone). Default PEOPLE.cap. */
  cap?: number;
  /** Where a door's threshold is, if known more exactly than the middle of its face. */
  doorAt?: DoorPlace;
  /** The place and facing of a seat socket (world x, y, z and heading), if the stage knows it. */
  seatAt?(socket: string): { x: number; y: number; z: number; face: number } | null;
  events?: CrowdEvents;
}

export interface Crowd {
  readonly people: readonly Person[];
  readonly nav: NavGraph | null;
  readonly router: Router | null;
  readonly haunts: readonly Haunt[];
  /** Residents inside each home right now. */
  readonly atHome: ReadonlyMap<StructureId, number>;
  /** The town changed (or is shown for the first time). Does nothing until the dressing has arrived. */
  sync(shape: ShapePlan, dressing: DressingPlan | null, time: TimeSignal): void;
  step(dt: number, time: TimeSignal): void;
  /** A block landed in this cell: people near it stop and look (L26). */
  blockLanded(cell: CellKey): void;
}

const KIND_WEIGHT: Partial<Record<SocketType, number>> = {
  'haunt-square': 4,
  'haunt-shop': 3,
  'haunt-cafe': 3,
  'haunt-bench': 2.5,
  'haunt-pier': 2,
  'haunt-garden': 2,
  'haunt-fountain': 2,
  'haunt-viewpoint': 1.5,
  'haunt-visit': 1.5,
};
/** Where a walker waiting for a single-file stretch stops in their cell (0 = where they came in, 1 = the far edge). */
const WAIT_AT = 0.42;
const TURN_RATE = 9;
/** A walker more than this far (radians) from the way they are to go turns on the spot before stepping off. */
const FACE_FIRST = 1;
const DIR_HEADING = [Math.PI, Math.PI / 2, 0, -Math.PI / 2] as const; // N E S W as headings (0 faces +z)

const scratch = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };

export function createCrowd(opts: CrowdOptions = {}): Crowd {
  const people: Person[] = [];
  const byId = new Map<string, Person>();
  const atHome = new Map<StructureId, number>();
  const events = opts.events ?? {};
  let nav: NavGraph | null = null;
  let router: Router | null = null;
  let haunts: Haunt[] = [];
  let hauntById = new Map<string, Haunt>();
  let stranded = new Set<StructureId>();
  let seed = 0;
  let runCount = new Int16Array(0);
  let runSense = new Int8Array(0);
  /** Seconds since dusk began (0 by day): everyone has set off for home by PEOPLE.duskSpread. */
  let duskClock = 0;
  let planCursor = 0;

  // ── small helpers ─────────────────────────────────────────────────────
  const r = (p: Person, what: string, n = p.trips): number => rand(p.seed, what, n);
  const setHome = (home: StructureId, delta: number): void => {
    const count = Math.max(0, (atHome.get(home) ?? 0) + delta);
    atHome.set(home, count);
    events.home?.(home, count);
  };
  const homeDoor = (p: Person): NavDoor | null => (nav ? (usableDoors(nav, p.home)[0] ?? null) : null);
  const release = (p: Person): void => {
    if (p.held >= 0 && p.held < runCount.length && runCount[p.held]! > 0) runCount[p.held]!--;
    p.held = -1;
    p.queued = false;
  };
  const leaveHaunt = (p: Person): void => {
    if (p.goal?.haunt && p.goal.haunt.user === p) p.goal.haunt.user = null;
  };
  const clearWalk = (p: Person): void => {
    release(p);
    p.walk = null;
    p.at = 0;
    p.t = 0;
  };
  const place = (p: Person, node: number): void => {
    p.node = node;
    p.cell = nav!.nodes[node]!.cell;
  };
  const standAt = (p: Person, node: number): void => {
    const c = nodeCentre(nav!, node);
    place(p, node);
    p.x = c.x;
    p.z = c.z;
    p.y = nodeHeight(nav!, node);
  };

  // ── choosing where to go (L22, L25, L32) ───────────────────────────────
  const mustBeHome = (p: Person, time: TimeSignal): boolean => {
    if (p.leaving) return false;
    if (time.isDay) return false;
    if (time.isDawn) return p.rank > 0.35; // the early risers are out at dawn
    if (p.owl) return false;
    return duskClock >= p.rank * PEOPLE.duskSpread;
  };
  const homeGoal = (p: Person): Goal | null => {
    const door = homeDoor(p);
    if (!door) return null;
    return { kind: 'home', node: door.node, haunt: null, door, spot: null, face: NaN, pose: 'stand', linger: 0, seat: -1 };
  };
  const hauntGoal = (p: Person, h: Haunt): Goal => {
    const c = nodeCentre(nav!, h.node);
    const linger = PEOPLE.lingerMin + r(p, 'linger') * (PEOPLE.lingerMax - PEOPLE.lingerMin);
    const g: Goal = { kind: 'haunt', node: h.node, haunt: h, door: null, spot: null, face: NaN, pose: 'stand', linger, seat: -1 };
    const facing = (reach: number): void => {
      if (h.dir === undefined) return;
      const [dx, dz] = DIR4[h.dir]!;
      const side = (r(p, 'side') - 0.5) * 0.3;
      g.spot = { x: c.x + dx * reach - dz * side, z: c.z + dz * reach + dx * side };
      g.face = DIR_HEADING[h.dir]!;
    };
    const anywhere = (): void => {
      const a = r(p, 'angle') * Math.PI * 2, d = 0.2 + r(p, 'reach') * 0.13;
      g.spot = { x: c.x + Math.sin(a) * d, z: c.z + Math.cos(a) * d };
      g.face = r(p, 'face') * Math.PI * 2;
    };
    switch (h.type) {
      case 'haunt-square': {
        anywhere();
        const k = r(p, 'pose');
        g.pose = k < 0.5 ? 'stand' : k < 0.75 ? 'chat' : k < 0.88 ? 'look' : 'wave';
        break;
      }
      case 'haunt-garden':
        anywhere();
        g.pose = r(p, 'pose') < 0.7 ? 'tend' : 'stand';
        break;
      case 'haunt-shop': {
        // Half go in (a shop with a door); the rest stand at the window or the counter.
        const door = h.structure !== undefined ? usableDoors(nav!, h.structure).find((d) => d.node === h.node) : undefined;
        if (door && r(p, 'go-in') < 0.5) g.door = door;
        else {
          facing(0.2);
          g.pose = r(p, 'pose') < 0.5 ? 'chat' : 'stand';
        }
        break;
      }
      case 'haunt-visit': {
        const door = h.structure !== undefined ? usableDoors(nav!, h.structure).find((d) => d.node === h.node) : undefined;
        if (door) g.door = door;
        else facing(0.2);
        break;
      }
      case 'haunt-cafe':
      case 'haunt-bench': {
        const seat = h.name !== undefined ? opts.seatAt?.(h.name) : null;
        g.pose = 'sit';
        if (seat && Math.abs(seat.x - c.x) <= 0.5 && Math.abs(seat.z - c.z) <= 0.5) {
          g.spot = { x: seat.x, z: seat.z };
          g.face = seat.face;
          g.seat = Math.max(0, seat.y - keyY(h.cell) * 0.8);
        } else {
          facing(0.05);
          g.seat = 0;
        }
        break;
      }
      case 'haunt-pier':
        facing(0.3);
        g.pose = 'fish';
        g.linger *= 1.5;
        break;
      case 'haunt-fountain':
        facing(0.27);
        g.pose = r(p, 'pose') < 0.6 ? 'stand' : 'look';
        break;
      case 'haunt-viewpoint':
        facing(0.3);
        g.pose = 'look';
        break;
      case 'haunt-night':
        facing(0.3);
        g.pose = h.name === 'fisher' ? 'fish' : 'look';
        g.linger = 30 + r(p, 'linger') * 30;
        break;
      case 'haunt-stoop':
        if (h.name === 'step') {
          facing(-0.3); // back against the house, on the step
          g.pose = 'sit';
          g.seat = 0;
        } else {
          facing(0.25);
          g.pose = 'tend';
        }
        break;
      default:
        anywhere();
    }
    return g;
  };
  const pickHaunt = (p: Person, time: TimeSignal): Haunt | null => {
    if (!nav || p.node < 0) return null;
    const part = nav.part[p.node]!;
    const night = !time.isDay && !time.isDawn;
    const lastId = p.goal?.haunt?.id;
    const open: Haunt[] = [];
    const weights: number[] = [];
    const here = nav.nodes[p.node]!.cell;
    const strandedHome = stranded.has(p.home);
    for (const h of haunts) {
      if (h.user !== null || h.id === lastId || nav.part[h.node] !== part) continue;
      let w: number;
      if (strandedHome) w = h.type === 'haunt-stoop' && h.structure === p.home ? 1 : 0;
      else if (night) w = h.type === 'haunt-night' && p.owl ? 1 : 0;
      else w = h.type === 'haunt-visit' && h.structure === p.home ? 0 : (KIND_WEIGHT[h.type] ?? 0);
      if (w <= 0) continue;
      open.push(h);
      weights.push(w);
    }
    if (open.length === 0) return null;
    // The kind first, by its weight, whatever the number of places of that kind; then a place of that
    // kind, nearer ones more likely.
    const kinds = [...new Set(open.map((h) => h.type))];
    const kind = kinds[Math.min(kinds.length - 1, pickIndex(kinds.map((k) => weights[open.findIndex((h) => h.type === k)]!), r(p, 'kind')))]!;
    const of = open.filter((h) => h.type === kind);
    const near = of.map((h) => 1 / (6 + Math.abs(keyX(h.cell) - keyX(here)) + Math.abs(keyZ(h.cell) - keyZ(here))));
    return of[pickIndex(near, r(p, 'place'))]!;
  };
  /** What a person does next, as a goal waiting for its route. Null: nothing to do, stay. */
  const nextGoal = (p: Person, time: TimeSignal, fromHome: boolean): Goal | null => {
    p.trips++;
    if (p.leaving) return leaveGoal(p);
    if (mustBeHome(p, time)) return fromHome ? null : homeGoal(p);
    // Out and about: mostly on to another place, sometimes home for a while.
    if (!fromHome && r(p, 'home') < 0.28) return homeGoal(p);
    const h = pickHaunt(p, time);
    if (h) return hauntGoal(p, h);
    return fromHome ? null : homeGoal(p);
  };
  const leaveGoal = (p: Person): Goal | null => {
    if (!nav || p.node < 0) return null;
    const part = nav.part[p.node]!;
    const here = nav.nodes[p.node]!.cell;
    let best: Haunt | null = null;
    let bestD = Infinity;
    for (const h of haunts) {
      if (h.type !== 'way-out' || nav.part[h.node] !== part) continue;
      const d = Math.abs(keyX(h.cell) - keyX(here)) + Math.abs(keyZ(h.cell) - keyZ(here));
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (!best) return null;
    return { kind: 'leave', node: best.node, haunt: null, door: null, spot: null, face: NaN, pose: 'stand', linger: 0, seat: -1 };
  };

  // ── routes ────────────────────────────────────────────────────────────
  /** Plans the walk to `goal` and starts it. False if there is no route. */
  const startWalk = (p: Person, goal: Goal): boolean => {
    if (!nav || !router || p.node < 0 || goal.node < 0) return false;
    const free = [p.home];
    if (goal.haunt?.structure !== undefined) free.push(goal.haunt.structure);
    if (goal.door) free.push(goal.door.structure);
    if (p.inside) free.push(p.inside.structure);
    const route = router.find(p.node, goal.node, free);
    if (!route) return false;
    const inside = p.mode === 'home' ? homeDoor(p) : p.mode === 'visit' ? p.inside : null;
    const pieces = buildWalk(nav, route, {
      ...(inside ? { startDoor: inside } : { from: { x: p.x, z: p.z } }),
      ...(goal.door ? { endDoor: goal.door } : goal.spot ? { to: goal.spot } : {}),
      lane: PEOPLE.lane * (0.75 + rand(p.seed, 'lane') * 0.5),
      ...(opts.doorAt ? { doorAt: opts.doorAt } : {}),
    });
    if (p.mode === 'home') setHome(p.home, -1);
    leaveHaunt(p);
    clearWalk(p);
    if (goal.haunt && !goal.door) goal.haunt.user = p;
    p.goal = goal;
    p.want = null;
    p.walk = pieces;
    p.inside = null;
    p.mode = 'walk';
    p.visible = true;
    p.pose = p.child ? 'run' : 'walk';
    p.seat = -1;
    p.stuck = 0;
    enterPiece(p);
    return true;
  };
  const enterPiece = (p: Person): void => {
    const piece = p.walk![p.at]!;
    p.visible = piece.kind !== 'hide';
    if (piece.node !== p.node) {
      place(p, piece.node);
      if (piece.kind === 'move') events.passed?.(p.cell, p);
    }
    pieceAt(piece, p.t, scratch);
    p.x = scratch.x;
    p.y = scratch.y;
    p.z = scratch.z;
  };
  const senseOf = (link: number, from: number): number => {
    const l = nav!.links[link]!;
    const to = l.a === from ? l.b : l.a;
    const dh = nodeHeight(nav!, to) - nodeHeight(nav!, from);
    return dh > 0 ? 1 : dh < 0 ? -1 : nav!.nodes[to]!.cell > nav!.nodes[from]!.cell ? 1 : -1;
  };
  /** May this walker go on into the single-file stretch at the end of their piece? Takes it if so. */
  const mayEnter = (p: Person, piece: Piece): boolean => {
    if (piece.link < 0) return true;
    const run = nav!.runOf[piece.link]!;
    if (run < 0 || p.held === run) return true;
    const sense = senseOf(piece.link, piece.node);
    if (runCount[run]! > 0 && runSense[run] !== sense) return false;
    release(p);
    runCount[run]!++;
    runSense[run] = sense;
    p.held = run;
    return true;
  };
  const arrive = (p: Person): void => {
    const goal = p.goal;
    clearWalk(p);
    if (!goal) {
      p.mode = 'linger';
      p.timer = 2;
      return;
    }
    if (goal.kind === 'home') {
      p.mode = 'home';
      p.visible = false;
      p.timer = PEOPLE.homeMin + r(p, 'home-stay') * (PEOPLE.homeMax - PEOPLE.homeMin);
      setHome(p.home, 1);
    } else if (goal.kind === 'leave') {
      p.mode = 'linger';
      p.pose = 'wave';
      p.poseTime = 0;
      p.timer = PEOPLE.fade;
    } else if (goal.door) {
      p.mode = 'visit';
      p.visible = false;
      p.inside = goal.door;
      p.timer = goal.linger;
    } else {
      p.mode = 'linger';
      p.pose = goal.pose;
      p.poseTime = 0;
      p.seat = goal.seat;
      p.timer = goal.linger;
    }
  };

  // ── moving ────────────────────────────────────────────────────────────
  const turnTo = (p: Person, target: number, dt: number): void => {
    let d = target - p.heading;
    d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
    const max = TURN_RATE * dt;
    p.heading += d > max ? max : d < -max ? -max : d;
  };
  const advance = (p: Person, dt: number): void => {
    const walk = p.walk!;
    let left = dt;
    let moved = 0;
    let turning = false;
    p.queued = false;
    for (let guard = 0; guard < 32 && left > 1e-9; guard++) {
      const piece = walk[p.at]!;
      let rate: number; // share of the piece per second
      let limit = 1;
      if (piece.kind === 'move') {
        // Turn first, then walk: nobody sets off backwards.
        pieceAt(piece, p.t, scratch);
        if (scratch.dx * scratch.dx + scratch.dz * scratch.dz > 1e-8) {
          const want = Math.atan2(scratch.dx, scratch.dz);
          let d = want - p.heading;
          d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
          if (d > FACE_FIRST || d < -FACE_FIRST) {
            turnTo(p, want, left);
            turning = true;
            break;
          }
        }
      }
      if (piece.kind === 'hide') rate = 1 / Math.max(0.05, piece.seconds);
      else {
        const speed = p.speed * piece.pace * (piece.kind === 'door' ? 1 : p.slow);
        rate = speed / piece.length;
        if (piece.kind === 'move' && !mayEnter(p, piece)) {
          limit = WAIT_AT;
          p.queued = true;
        }
      }
      const room = limit - p.t;
      if (room <= 0) break; // waiting
      const need = rate > 0 ? room / rate : Infinity;
      if (need > left) {
        p.t += left * rate;
        if (piece.kind !== 'hide') moved += left * rate * piece.length;
        break;
      }
      left -= need;
      if (piece.kind !== 'hide') moved += room * piece.length;
      p.t = limit;
      if (limit < 1) break;
      // On to the next piece.
      if (p.at + 1 >= walk.length) {
        pieceAt(piece, 1, scratch);
        p.x = scratch.x;
        p.y = scratch.y;
        p.z = scratch.z;
        arrive(p);
        return;
      }
      const crossed = piece.link;
      p.at++;
      p.t = 0;
      const next = walk[p.at]!;
      if (crossed >= 0 && p.held >= 0 && (next.link < 0 || nav!.runOf[next.link] !== p.held)) release(p);
      enterPiece(p);
    }
    const piece = walk[p.at]!;
    pieceAt(piece, p.t, scratch);
    p.x = scratch.x;
    p.y = scratch.y;
    p.z = scratch.z;
    p.visible = piece.kind !== 'hide';
    if (!turning && scratch.dx * scratch.dx + scratch.dz * scratch.dz > 1e-8 && piece.kind !== 'hide') turnTo(p, Math.atan2(scratch.dx, scratch.dz), dt);
    if (moved > 1e-6) {
      p.stride += (moved * PERSON.stepsPerCell * 0.5) / (p.child ? 0.8 : 1);
      p.pose = p.child ? 'run' : 'walk';
      p.stuck = p.stuck < 0 ? Math.min(0, p.stuck + dt) : 0;
    } else {
      // Held up: stand, do not march on the spot.
      p.pose = 'stand';
      p.poseTime += dt;
      p.stride = Math.round(p.stride * 2) / 2;
      if (piece.kind !== 'hide' && !p.queued && !turning) p.stuck = p.stuck < 0 ? Math.min(0, p.stuck + dt) : p.stuck + dt;
    }
  };
  /** How much of their speed each walker keeps, from who is just ahead of them (L24: people queue). */
  const follow = (): void => {
    for (const p of people) {
      p.slow = 1;
      if (p.mode !== 'walk' || !p.visible) continue;
      // Never a standstill: after three seconds behind somebody, step round them (stuck < 0 counts that down).
      if (p.stuck > 3) p.stuck = -1.5;
      if (p.stuck < 0) continue;
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      for (const q of people) {
        if (q === p || !q.visible || q.mode !== 'walk') continue;
        const dx = q.x - p.x, dz = q.z - p.z;
        if (dx > 0.6 || dx < -0.6 || dz > 0.6 || dz < -0.6 || Math.abs(q.y - p.y) > 0.3) continue;
        const ahead = dx * fx + dz * fz;
        if (ahead <= 0.02 || ahead >= PEOPLE.slowAt) continue;
        if (Math.abs(dx * fz - dz * fx) > 0.09) continue;
        // Only somebody going my way holds me up; somebody coming the other way passes on their side.
        if (Math.sin(q.heading) * fx + Math.cos(q.heading) * fz < 0.5) continue;
        const k = (ahead - PEOPLE.gap) / (PEOPLE.slowAt - PEOPLE.gap);
        const keep = k < 0 ? 0 : k;
        if (keep < p.slow) p.slow = keep;
      }
    }
  };

  // ── hopping, leaving, arriving (L27) ───────────────────────────────────
  const nearestNode = (x: number, y: number, z: number): number => {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < nav!.nodes.length; i++) {
      const n = nav!.nodes[i]!;
      if (n.rot !== undefined || n.passage !== undefined) continue;
      const dx = keyX(n.cell) + 0.5 - x, dz = keyZ(n.cell) + 0.5 - z, dy = (keyY(n.cell) * 0.8 - y) * 1.5;
      const d = dx * dx + dz * dz + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };
  const hopTo = (p: Person, node: number): void => {
    const c = nodeCentre(nav!, node);
    clearWalk(p);
    leaveHaunt(p);
    p.hop = { x0: p.x, y0: p.y, z0: p.z, x1: c.x, y1: nodeHeight(nav!, node), z1: c.z, t: 0 };
    p.mode = 'hop';
    p.visible = true;
    p.pose = 'hop';
    p.inside = null;
    p.seat = -1;
    place(p, node);
  };
  const remove = (p: Person): void => {
    if (p.mode === 'home') setHome(p.home, -1);
    leaveHaunt(p);
    clearWalk(p);
    p.mode = 'gone';
    p.visible = false;
  };

  // ── a new town ────────────────────────────────────────────────────────
  const readHaunts = (dressing: DressingPlan): void => {
    const old = hauntById;
    haunts = [];
    hauntById = new Map();
    stranded = new Set();
    for (const s of dressing.sockets) {
      if (!s.type.startsWith('haunt-') && s.type !== 'arrival' && s.type !== 'way-out') continue;
      const node = nav!.nodeAt.get(s.cell);
      if (node === undefined) continue;
      const user = old.get(s.id)?.user ?? null;
      const h: Haunt = {
        id: s.id,
        type: s.type,
        node,
        cell: s.cell,
        ...(s.dir !== undefined ? { dir: s.dir } : {}),
        ...(s.structure !== undefined ? { structure: s.structure } : {}),
        ...(s.name !== undefined ? { name: s.name } : {}),
        user: user && user.mode !== 'gone' ? user : null,
      };
      haunts.push(h);
      hauntById.set(h.id, h);
      if (h.type === 'haunt-stoop' && h.structure !== undefined) stranded.add(h.structure);
    }
  };
  /** Points a goal at the new graph's nodes, doors and haunts. False if what it was for is gone. */
  const refreshGoal = (p: Person, g: Goal): boolean => {
    if (g.kind === 'home') {
      const door = homeDoor(p);
      if (!door) return false;
      g.door = door;
      g.node = door.node;
      return true;
    }
    if (g.kind !== 'haunt' || !g.haunt) return false;
    const h = hauntById.get(g.haunt.id);
    if (!h || (h.user !== null && h.user !== p && !g.door)) return false;
    if (g.door) {
      const door = nav!.doors.find((d) => d.feature === g.door!.feature && d.structure === g.door!.structure && d.node === h.node);
      if (!door) return false;
      g.door = door;
    } else h.user = p;
    g.haunt = h;
    g.node = h.node;
    return true;
  };
  /** Keeps a walk going across a change of graph if every piece of the rest of it is still there. */
  const carryWalk = (p: Person, old: NavGraph): boolean => {
    const walk = p.walk!;
    const moved: Piece[] = [];
    for (let i = p.at; i < walk.length; i++) {
      const piece = walk[i]!;
      const node = nav!.nodeAt.get(old.nodes[piece.node]!.cell);
      if (node === undefined) return false;
      const was = old.nodes[piece.node]!, now = nav!.nodes[node]!;
      if (was.rot !== now.rot || was.passage !== now.passage) return false;
      let link = -1;
      if (piece.link >= 0) {
        const ol = old.links[piece.link]!;
        const other = nav!.nodeAt.get(old.nodes[ol.a === piece.node ? ol.b : ol.a]!.cell);
        if (other === undefined) return false;
        for (let k = nav!.linkStart[node]!; k < nav!.linkStart[node + 1]!; k++) {
          const nl = nav!.links[nav!.linkOf[k]!]!;
          if ((nl.a === other || nl.b === other) && nl.via === ol.via && nl.structure === ol.structure) link = nav!.linkOf[k]!;
        }
        if (link < 0) return false;
      }
      let door: NavDoor | null = null;
      if (piece.door) {
        door = nav!.doors.find((d) => d.feature === piece.door!.feature && d.structure === piece.door!.structure && d.node >= 0) ?? null;
        if (!door || nav!.nodes[door.node]!.cell !== old.nodes[piece.door.node]!.cell) return false;
      }
      moved.push({ ...piece, node, link, door });
    }
    p.walk = moved;
    p.at = 0;
    p.held = -1;
    return true;
  };
  const warmStart = (p: Person, time: TimeSignal): void => {
    // The town is already going about its day when it is first seen.
    const door = homeDoor(p);
    p.mode = 'home';
    p.visible = false;
    setHome(p.home, 1);
    if (!door) return;
    standAt(p, door.node);
    p.timer = PEOPLE.homeMin + rand(p.seed, 'first-stay') * (PEOPLE.homeMax - PEOPLE.homeMin);
    if (mustBeHome(p, time) && !time.isDusk) return;
    const k = rand(p.seed, 'first');
    const share = time.isDusk ? 0.55 : time.isDay ? 0.78 : p.owl ? 1 : 0.3;
    if (k > share) {
      p.timer *= k; // at home, some about to come out
      return;
    }
    const h = pickHaunt(p, time.isDusk ? { ...time, isDay: true, isDusk: false } : time);
    if (!h) return;
    const goal = hauntGoal(p, h);
    if (time.isDusk) {
      // On the way back from wherever they were.
      const back = homeGoal(p);
      if (!back) return;
      standAt(p, h.node);
      p.mode = 'wait';
      if (!startWalk(p, back)) {
        standAt(p, door.node);
        p.mode = 'home';
        p.visible = false;
        return;
      }
      setHome(p.home, -1);
    } else if (!startWalk(p, goal)) return;
    // Somewhere along the way, or already there.
    const walk = p.walk!;
    const along = rand(p.seed, 'first-along');
    if (!time.isDusk && along > 0.55) {
      const last = walk[walk.length - 1]!;
      p.at = walk.length - 1;
      p.t = 1;
      place(p, last.node);
      pieceAt(last, 1, scratch);
      p.x = scratch.x;
      p.y = scratch.y;
      p.z = scratch.z;
      p.heading = Number.isNaN(goal.face) ? rand(p.seed, 'first-face') * 6.28 : goal.face;
      arrive(p);
      p.timer *= rand(p.seed, 'first-linger');
      return;
    }
    // Start on a piece in the open, clear of any single-file stretch.
    const want = Math.floor((along / 0.55) * walk.length * (time.isDusk ? 0.8 : 1));
    let at = -1;
    for (let i = Math.min(walk.length - 1, want); i >= 0; i--) {
      const piece = walk[i]!;
      if (piece.kind !== 'move') continue;
      if (piece.link >= 0 && nav!.runOf[piece.link]! >= 0) continue;
      if (i > 0 && walk[i - 1]!.link >= 0 && nav!.runOf[walk[i - 1]!.link]! >= 0) continue;
      at = i;
      break;
    }
    if (at <= 0) return;
    p.at = at;
    p.t = rand(p.seed, 'first-t') * 0.9;
    place(p, walk[at]!.node);
    pieceAt(walk[at]!, p.t, scratch);
    p.x = scratch.x;
    p.y = scratch.y;
    p.z = scratch.z;
    p.heading = Math.atan2(scratch.dx, scratch.dz);
    p.stride = rand(p.seed, 'first-stride');
  };
  const arriveFromShore = (p: Person, order: number): void => {
    // A newcomer comes ashore at the nearest dock or beach and walks home.
    const landing = haunts.find((h) => h.type === 'arrival' && h.structure === p.home);
    const door = homeDoor(p);
    if (!landing || !door) {
      p.mode = 'home';
      p.visible = false;
      p.timer = PEOPLE.homeMin + rand(p.seed, 'first-stay') * (PEOPLE.homeMax - PEOPLE.homeMin);
      if (door) standAt(p, door.node);
      setHome(p.home, 1);
      return;
    }
    standAt(p, landing.node);
    const c = nodeCentre(nav!, landing.node);
    p.x = c.x + (rand(p.seed, 'land-x') - 0.5) * 0.4;
    p.z = c.z + (rand(p.seed, 'land-z') - 0.5) * 0.4;
    p.mode = 'wait';
    p.visible = false;
    p.fade = 0;
    p.timer = order * 1.4; // one after another down the gangway
    p.want = homeGoal(p);
  };

  const makePerson = (id: string, home: StructureId, index: number, look: number, child: boolean): Person => {
    const s = hash(seed, 'person', id);
    return {
      id, home, index, look, child, seed: s,
      rank: rand(s, 'rank'),
      speed: PEOPLE.speed * (1 + (rand(s, 'speed') * 2 - 1) * PEOPLE.speedVary) * (child ? PEOPLE.childSpeed : 1),
      owl: false,
      shutIn: false,
      mode: 'home', visible: false, fade: 1,
      x: 0, y: 0, z: 0, heading: rand(s, 'heading') * 6.28,
      pose: 'stand', poseTime: rand(s, 'pose') * 10, stride: 0, seat: -1,
      node: -1, cell: -1, walk: null, at: 0, t: 0,
      goal: null, want: null, timer: 0, held: -1, trips: 0, stuck: 0, slow: 1, queued: false,
      inside: null, hop: null, leaving: false, startled: 0, startledFace: 0,
    };
  };

  const crowd: Crowd = {
    people,
    get nav() {
      return nav;
    },
    get router() {
      return router;
    },
    get haunts() {
      return haunts;
    },
    atHome,

    sync(shape, dressing, time) {
      if (!dressing) return;
      const first = nav === null;
      const old = nav;
      seed = shape.world.seed;
      nav = dressing.nav;
      router = createRouter(nav);
      runCount = new Int16Array(nav.runs.length);
      runSense = new Int8Array(nav.runs.length);
      readHaunts(dressing);

      // Who lives here now (L21): the plan's residents in order, up to the cap.
      const cap = opts.cap ?? PEOPLE.cap;
      // Those who can never leave their house (resident/indoors) are kept, at home, and are not counted.
      const wanted = new Map<string, { home: StructureId; index: number; look: number; child: boolean; indoors: boolean }>();
      let walkers = 0;
      for (const a of dressing.actors) {
        if (a.type !== 'resident' || a.home === undefined) continue;
        if (a.variant !== 'indoors' && walkers++ >= cap) continue;
        const params = (a.params ?? {}) as { index?: number; look?: number };
        wanted.set(a.id, { home: a.home, index: params.index ?? 0, look: params.look ?? 0, child: a.variant === 'child', indoors: a.variant === 'indoors' });
      }

      // Those already here: keep them where they are if the ground under them is still ground.
      for (const p of people) {
        if (p.mode === 'gone') continue;
        p.want = null; // it names nodes and doors of the old graph
        const still = wanted.has(p.id);
        if (still && p.leaving) {
          // Their home is back (an undo): they turn round.
          p.leaving = false;
          p.fade = 1;
          p.want = null;
          if (p.goal?.kind === 'leave') p.goal = null;
        }
        if (!still && !p.leaving) {
          if (p.mode === 'home') {
            // The house came down with them in it: they are standing where its door was.
            setHome(p.home, -1);
            p.mode = 'wait';
            p.visible = true;
          }
          p.leaving = true;
          p.want = null;
        }
        if (p.mode === 'home') {
          const door = homeDoor(p);
          if (door) standAt(p, door.node);
          else p.node = -1;
          continue;
        }
        const node = p.cell >= 0 ? nav.nodeAt.get(p.cell) : undefined;
        if (p.mode === 'visit') {
          const door = p.inside && nav.doors.find((d) => d.feature === p.inside!.feature && d.structure === p.inside!.structure && d.node >= 0);
          if (door) {
            p.inside = door;
            place(p, door.node);
            continue;
          }
          p.inside = null;
        } else if (node !== undefined && p.mode === 'walk' && p.walk && old && !p.leaving && p.goal && p.goal.kind !== 'leave' && refreshGoal(p, p.goal) && carryWalk(p, old)) {
          place(p, node);
          continue;
        } else if (node !== undefined && p.mode === 'linger' && !p.leaving && p.goal?.haunt && refreshGoal(p, p.goal)) {
          place(p, node);
          continue;
        }
        // Their walk is broken, their haunt is gone or the ground is: stand, hop clear if need be, plan again.
        const wasGoal = p.goal;
        leaveHaunt(p);
        clearWalk(p);
        p.goal = null;
        if (node === undefined || p.mode === 'visit') hopTo(p, nearestNode(p.x, p.y, p.z));
        else {
          place(p, node);
          p.mode = 'wait';
          p.visible = true;
          p.pose = 'stand';
          p.seat = -1;
          p.timer = 0;
        }
        // Go on to where they were going, if it is still there.
        if (!p.leaving && wasGoal) {
          if (wasGoal.kind === 'home') p.want = homeGoal(p);
          else if (wasGoal.haunt && hauntById.has(wasGoal.haunt.id)) p.want = hauntGoal(p, hauntById.get(wasGoal.haunt.id)!);
        }
      }

      // Newcomers.
      let order = 0;
      const fresh: Person[] = [];
      for (const [id, w] of wanted) {
        const had = byId.get(id);
        if (had && had.mode !== 'gone') {
          had.home = w.home;
          had.shutIn = w.indoors;
          continue;
        }
        const p = makePerson(id, w.home, w.index, w.look, w.child);
        p.shutIn = w.indoors;
        people.push(p);
        byId.set(id, p);
        fresh.push(p);
        events.added?.(p);
      }
      // The night owls (L25): the lowest ranks, never more than a tenth of the town.
      const owls = Math.floor(Math.min(walkers, cap) * PEOPLE.nightOut);
      const ranked = people.filter((p) => p.mode !== 'gone' && !p.leaving && !p.shutIn).sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1));
      for (const p of people) p.owl = false;
      ranked.forEach((p, i) => (p.owl = i < owls));
      for (const p of fresh) {
        if (first) warmStart(p, time);
        else arriveFromShore(p, order++);
      }
    },

    step(dt, time) {
      if (!nav) return;
      duskClock = time.isDusk || time.isNight ? duskClock + dt : 0;
      follow();
      let plans = Math.max(1, Math.round(PEOPLE.plansPerFrame));
      const n = people.length;
      for (let i = 0; i < n; i++) {
        const p = people[i]!;
        switch (p.mode) {
          case 'home':
            p.timer -= dt;
            if (p.timer <= 0 && p.node >= 0 && !p.want) {
              p.want = nextGoal(p, time, true);
              if (!p.want) p.timer = 3 + r(p, 'retry') * 5;
            }
            break;
          case 'visit':
            p.timer -= dt;
            if (p.timer <= 0 && !p.want) {
              p.want = nextGoal(p, time, false);
              if (!p.want) p.timer = 4;
            }
            break;
          case 'linger': {
            p.poseTime += dt;
            p.timer -= dt;
            if (p.goal && !Number.isNaN(p.goal.face)) turnTo(p, p.goal.face, dt);
            if (p.goal?.kind === 'leave') {
              p.fade = Math.max(0, p.timer / PEOPLE.fade);
              if (p.timer <= 0) remove(p);
              break;
            }
            if (p.startled > 0) break;
            // Dusk calls everybody in, whatever they were doing.
            if (p.timer > 0 && mustBeHome(p, time) && p.goal?.haunt?.type !== 'haunt-night') p.timer = 0;
            if (p.timer <= 0 && !p.want) {
              p.want = nextGoal(p, time, false);
              if (!p.want) p.timer = 4 + r(p, 'retry') * 4;
            }
            break;
          }
          case 'walk':
            if (p.startled > 0) {
              p.pose = 'stand';
              p.poseTime += dt;
              break;
            }
            if (p.fade < 1) p.fade = Math.min(1, p.fade + dt / PEOPLE.fade);
            // Dusk turns people round where they are.
            if (!p.want && p.goal?.kind === 'haunt' && p.walk![p.at]!.kind === 'move' && mustBeHome(p, time) && p.goal.haunt?.type !== 'haunt-night') {
              p.want = homeGoal(p);
            }
            advance(p, dt);
            break;
          case 'hop': {
            const h = p.hop!;
            h.t += dt / PEOPLE.hop;
            const t = Math.min(1, h.t);
            p.x = h.x0 + (h.x1 - h.x0) * t;
            p.z = h.z0 + (h.z1 - h.z0) * t;
            p.y = h.y0 + (h.y1 - h.y0) * t + Math.sin(t * Math.PI) * PEOPLE.hopHeight;
            if (t >= 1) {
              p.hop = null;
              p.mode = 'wait';
              p.pose = 'stand';
              p.timer = 0.3;
            }
            break;
          }
          case 'wait':
            p.poseTime += dt;
            p.timer -= dt;
            if (p.timer <= 0 && !p.want) {
              p.want = p.leaving ? leaveGoal(p) : nextGoal(p, time, false);
              if (!p.want) {
                if (p.leaving) {
                  // Nowhere to walk off to: fade where they stand.
                  p.goal = { kind: 'leave', node: p.node, haunt: null, door: null, spot: null, face: NaN, pose: 'wave', linger: 0, seat: -1 };
                  p.mode = 'linger';
                  p.pose = 'wave';
                  p.timer = PEOPLE.fade;
                } else p.timer = 3 + r(p, 'retry') * 4;
              }
            }
            break;
          case 'gone':
            break;
        }
        if (p.startled > 0) {
          p.startled -= dt;
          turnTo(p, p.startledFace, dt);
        }
      }
      // Routes: a few a frame, taking turns, so sixty people asking at once never show in a frame.
      for (let k = 0; k < n && plans > 0; k++) {
        const p = people[(planCursor + k) % n]!;
        if (!p.want || p.mode === 'gone' || p.mode === 'hop') continue;
        if (p.mode === 'wait' && p.timer > 0) continue;
        if (p.mode === 'walk' && p.walk![p.at]!.kind !== 'move') continue; // not half-way through a door
        plans--;
        const goal = p.want;
        p.want = null;
        if (goal.haunt && goal.haunt.user !== null && goal.haunt.user !== p && !goal.door) continue; // somebody got there first
        const wasWaiting = p.mode === 'wait';
        if (startWalk(p, goal)) {
          if (wasWaiting && p.fade < 1) p.visible = true;
          continue;
        }
        // No way there. Home, if that can be reached; else stay a while.
        if (goal.kind !== 'home' && p.mode !== 'home') {
          const back = homeGoal(p);
          if (back && startWalk(p, back)) continue;
        }
        if (p.mode === 'walk') {
          clearWalk(p);
          p.mode = 'wait';
          p.pose = 'stand';
        }
        p.timer = 5 + r(p, 'retry') * 5;
      }
      planCursor = n > 0 ? (planCursor + 1) % n : 0;
      // Clear away those who left.
      for (let i = people.length - 1; i >= 0; i--) {
        const p = people[i]!;
        if (p.mode !== 'gone') continue;
        people.splice(i, 1);
        if (byId.get(p.id) === p) byId.delete(p.id);
        events.removed?.(p);
      }
    },

    blockLanded(cell) {
      const x = keyX(cell) + 0.5, z = keyZ(cell) + 0.5;
      for (const p of people) {
        if (!p.visible || (p.mode !== 'walk' && p.mode !== 'linger')) continue;
        if (p.mode === 'walk' && p.walk![p.at]!.kind !== 'move') continue;
        const dx = x - p.x, dz = z - p.z;
        if (Math.abs(dx) + Math.abs(dz) > PEOPLE.lookReach || (dx === 0 && dz === 0)) continue;
        p.startled = PEOPLE.lookTime * (0.7 + rand(p.seed, 'startle', p.trips) * 0.6);
        p.startledFace = Math.atan2(dx, dz);
      }
    },
  };
  return crowd;
}

/** The index a roll in [0, 1) picks from a list of weights. */
function pickIndex(weights: readonly number[], roll: number): number {
  let total = 0;
  for (const w of weights) total += w;
  let t = roll * total;
  for (let i = 0; i < weights.length; i++) {
    t -= weights[i]!;
    if (t < 0) return i;
  }
  return weights.length - 1;
}
