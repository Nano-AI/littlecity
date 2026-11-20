// L50 · The street scuffle (owner's request): a run-time reaction, like L26.
//
// Two grown-ups bump into each other head on (or one has to squeeze past the
// other) and, now and then, it turns into a cartoon scuffle:
//
//   fight   the two vanish into a rolling dust cloud (drawn by people.system:
//           fists, a shoe, a hat and stars popping out of it on twos, and a
//           bubble of comic swearing over it); passers-by near it stop in a
//           loose ring and watch, some cheering, a grown-up covering a
//           child's eyes; the pigeons scatter
//   dazed   the cloud puffs away and the two sit on the ground facing each
//           other, stars circling their heads
//   up      they get up and dust themselves off
//   shake   sometimes they shake hands and walk to the inn together;
//           otherwise they stomp off on their own ways (they met head on, so
//           their ways are opposite)
//
// One at a time in the whole town, and then a rest (SCUFFLE.restMin–Max), so
// a watcher sees one every couple of minutes. Never children, anybody at
// work or on duty, anybody carrying work (a sack, a tray: what is their own,
// a loaf, a fish, a basket, a pail, they set down first and pick up after), leaving, in a doorway or a
// single-file stretch, and never on stairs, docks, bridges, roofs or any
// cell standing on a structure. Building on the spot ends it at once.
//
// The two stay where they were on their walks (mode 'walk', still solid to
// the avoidance, so others go round them); only their drawing is swapped for
// the cloud while `inCloud`. Deterministic: chance is rand(seeds, counters).

import { key, keyX, keyY, keyZ } from '@/core/grid';
import { rand } from '@/core/rand';
import type { TimeSignal } from '@/life/api';
import type { NavGraph, ShapePlan } from '@/resolve/plan';
import { SCUFFLE } from '@/style/town-life';
import type { Goal, Person } from './crowd';
import type { Load } from './errand';

/** What somebody may set down to fight: their own things, not work they are carrying for somebody. */
const OWN: ReadonlySet<Load> = new Set<Load>(['loaf', 'fishes', 'basket', 'bucket']);

export type ScufflePhase = 'fight' | 'dazed' | 'up' | 'shake';

export interface Scuffle {
  /** Counts up from 1 over the life of the crowd. */
  readonly n: number;
  readonly a: Person;
  readonly b: Person;
  /** Where it happens (the middle of the two), and the cell. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly cell: number;
  /** The way along the street (unit), which the cloud rolls along. */
  readonly ax: number;
  readonly az: number;
  phase: ScufflePhase;
  /** Seconds into the phase, and seconds since it began. */
  t: number;
  age: number;
  /** Seconds the cloud lasts (lengthened while somebody comes to break it up, cut short when they arrive). */
  fight: number;
  /** What each of the two set down before it started (picked up again after). */
  readonly setDown: Map<Person, Load>;
  /** Somebody coming to break it up (the night watchman, a guard), once one is on the way. */
  responder: Person | null;
  readonly makeUp: boolean;
  /** The cloud's middle now (it rolls along the street a little). */
  cx: number;
  cz: number;
  readonly watchers: { p: Person; act: 'watch' | 'cheer' | 'cover' }[];
  /** Seeded per scuffle: what pops out of the cloud when. */
  readonly seed: number;
}

export interface ScuffleHost {
  readonly people: readonly Person[];
  nav(): NavGraph | null;
  shape(): ShapePlan | null;
  /** On a round or a job that will not wait (lamplighter, called home, …). */
  busy(p: Person): boolean;
  /** Where the two go together when they make it up: the inn, if there is one they can walk to. */
  innGoal(p: Person, other: Person): Goal | null;
  /** Sends somebody to break it up, if anybody keeps the peace near (returns them), else null. */
  respond?(s: Scuffle): Person | null;
  seed(): number;
  /** A fixture's own dials, over SCUFFLE's. */
  dials?: { chance?: number; squeeze?: number; rest?: number };
  events?: { scuffle?(s: Scuffle, what: 'start' | 'end'): void };
}

export interface Scuffles {
  readonly now: Scuffle | null;
  /** Seconds before another may start. */
  readonly rest: number;
  /** Two walkers met head on (`lat`: how far off each other's line), or one squeezes past. Maybe a scuffle. */
  bump(p: Person, q: Person, lat: number, squeeze: boolean): boolean;
  /** Starts one now between the two nearest walkers who may fight (fixtures, sequences). Null if nobody may. */
  provoke(): Scuffle | null;
  step(dt: number, time: TimeSignal): void;
  /** The town changed: ends it at once if its ground is gone or built on. */
  sync(): void;
  /** Ends it now, cleanly. */
  end(): void;
  /** Somebody has come to break it up: the cloud goes now. */
  breakUp(): void;
}

const GROUND = new Set(['path', 'plaza', 'grass', 'trail', 'sand', 'garden']);

export function createScuffles(host: ScuffleHost): Scuffles {
  let now: Scuffle | null = null;
  let rest = 0;
  let count = 0;

  /** May this walker be drawn into a scuffle, here and now? */
  const free = (p: Person): boolean =>
    !p.child &&
    p.mode === 'walk' &&
    p.visible &&
    p.scuffle === null &&
    p.fade >= 1 &&
    !p.leaving &&
    (!p.carrying || (p.load !== null && OWN.has(p.load))) &&
    !p.brisk &&
    !p.party &&
    p.chat <= 0 &&
    p.startled <= 0 &&
    p.held < 0 &&
    !p.queued &&
    p.walk !== null &&
    p.walk[p.at]!.kind === 'move' &&
    p.goal?.haunt?.type !== 'workplace' &&
    !host.busy(p);
  /** Open ground: not stairs, a gate, a dock, a roof or a bridge, nor a single-file stretch, nor cluttered. */
  const groundOk = (node: number): boolean => {
    const nav = host.nav(), shape = host.shape();
    if (!nav || !shape || node < 0) return false;
    const n = nav.nodes[node]!;
    if (!GROUND.has(n.surface) || n.rot !== undefined || n.passage !== undefined || n.clutter) return false;
    const c = n.cell;
    if (keyY(c) > 0 && shape.structureAt.has(key(keyX(c), keyY(c) - 1, keyZ(c)))) return false;
    for (let k = nav.linkStart[node]!; k < nav.linkStart[node + 1]!; k++) {
      const link = nav.linkOf[k]!;
      if (nav.runOf[link]! >= 0) return false;
      const l = nav.links[link]!;
      if (l.via === 'stairs' || l.via === 'gate') return false;
    }
    return true;
  };

  const start = (p: Person, q: Person): Scuffle => {
    const r = (what: string): number => rand(host.seed(), 'scuffle', what, count + 1);
    const x = (p.x + q.x) / 2, z = (p.z + q.z) / 2;
    let ax = q.x - p.x, az = q.z - p.z;
    const len = Math.hypot(ax, az);
    if (len < 1e-3) {
      ax = Math.sin(p.heading);
      az = Math.cos(p.heading);
    } else {
      ax /= len;
      az /= len;
    }
    const s: Scuffle = {
      n: ++count,
      a: p,
      b: q,
      x,
      y: Math.max(p.y, q.y),
      z,
      cell: p.cell,
      ax,
      az,
      phase: 'fight',
      t: 0,
      age: 0,
      fight: SCUFFLE.fightMin + r('fight') * (SCUFFLE.fightMax - SCUFFLE.fightMin),
      setDown: new Map(),
      responder: null,
      makeUp: r('make-up') < SCUFFLE.makeUp,
      cx: x,
      cz: z,
      watchers: [],
      seed: (r('seed') * 1e9) >>> 0,
    };
    for (const w of [p, q]) {
      w.scuffle = s;
      w.inCloud = true;
      // What is their own goes down on the ground first.
      if (w.load) {
        s.setDown.set(w, w.load);
        w.load = null;
        w.carrying = false;
      }
      w.chat = 0;
      w.chatWith = null;
      w.dodgeTo = 0;
    }
    // The ring: whoever is near and out, nearest first.
    const near: { p: Person; d: number }[] = [];
    for (const o of host.people) {
      if (o === p || o === q || !o.visible || o.scuffle || o.leaving || o.fade < 1 || o.inCloud) continue;
      if (o.mode !== 'walk' && o.mode !== 'linger') continue;
      if (o.mode === 'walk' && o.walk![o.at]!.kind !== 'move') continue;
      if (o.brisk || host.busy(o) || o.party) continue;
      const d = Math.hypot(o.x - x, o.z - z);
      if (d > SCUFFLE.watchReach || Math.abs(o.y - s.y) > 0.6) continue;
      near.push({ p: o, d });
    }
    near.sort((a, b) => a.d - b.d || (a.p.id < b.p.id ? -1 : 1));
    for (const { p: o } of near.slice(0, Math.max(0, Math.round(SCUFFLE.watchers)))) {
      const cheer = !o.child && o.seat < 0 && rand(o.seed, 'cheer', s.n) < SCUFFLE.cheer;
      s.watchers.push({ p: o, act: cheer ? 'cheer' : 'watch' });
      o.scuffle = s;
    }
    // A grown-up beside a watching child covers its eyes.
    for (const c of s.watchers) {
      if (!c.p.child) continue;
      const adult = s.watchers.filter((w) => !w.p.child && w.act !== 'cover' && w.p.seat < 0).sort((a, b) => Math.hypot(a.p.x - c.p.x, a.p.z - c.p.z) - Math.hypot(b.p.x - c.p.x, b.p.z - c.p.z))[0];
      if (adult && Math.hypot(adult.p.x - c.p.x, adult.p.z - c.p.z) < 1.2) adult.act = 'cover';
    }
    now = s;
    host.events?.scuffle?.(s, 'start');
    return s;
  };

  const release = (s: Scuffle, done: boolean): void => {
    for (const w of [s.a, s.b]) {
      const had = s.setDown.get(w);
      if (had && w.mode !== 'gone') {
        w.load = had;
        w.carrying = true;
      }
      if (w.costume === 'askew') w.costume = null;
      w.scuffle = null;
      w.inCloud = false;
      w.react = null;
      if (w.seat === 0 && w.mode === 'walk') w.seat = -1;
      w.stuck = 0;
    }
    for (const { p } of s.watchers) {
      if (p.scuffle === s) p.scuffle = null;
      // A moment more to turn back to what they were doing.
      p.startled = Math.min(p.startled, 0.4 + rand(p.seed, 'after', s.n) * 0.6);
    }
    if (done && s.makeUp && s.a.mode === 'walk' && s.b.mode === 'walk') {
      const ga = host.innGoal(s.a, s.b), gb = host.innGoal(s.b, s.a);
      if (ga && gb) {
        s.a.want = ga;
        s.b.want = gb;
      }
    }
    now = null;
    rest = host.dials?.rest ?? SCUFFLE.restMin + rand(host.seed(), 'scuffle-rest', s.n) * Math.max(0, SCUFFLE.restMax - SCUFFLE.restMin);
    host.events?.scuffle?.(s, 'end');
  };

  const faceTo = (p: Person, x: number, z: number): void => {
    if (Math.hypot(x - p.x, z - p.z) > 1e-4) p.heading = Math.atan2(x - p.x, z - p.z);
  };

  return {
    get now() {
      return now;
    },
    get rest() {
      return rest;
    },
    bump(p, q, lat, squeeze) {
      if (now || rest > 0) return false;
      if (!squeeze && lat > SCUFFLE.bumpLat) return false;
      if (!free(p) || !free(q) || !groundOk(p.node) || !groundOk(q.node)) return false;
      const k = rand(p.seed, 'scuffle', q.seed, p.trips, q.trips);
      if (k >= (squeeze ? (host.dials?.squeeze ?? SCUFFLE.squeeze) : (host.dials?.chance ?? SCUFFLE.chance))) return false;
      start(p, q);
      return true;
    },
    provoke() {
      if (now) return now;
      let best: [Person, Person] | null = null;
      let bestD = 1.2;
      const people = host.people;
      for (let i = 0; i < people.length; i++) {
        const p = people[i]!;
        if (!free(p) || !groundOk(p.node)) continue;
        for (let j = i + 1; j < people.length; j++) {
          const q = people[j]!;
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          if (d >= bestD || Math.abs(q.y - p.y) > 0.3 || !free(q) || !groundOk(q.node)) continue;
          bestD = d;
          best = [p, q];
        }
      }
      if (!best) return null;
      rest = 0;
      return start(best[0], best[1]);
    },
    step(dt) {
      if (rest > 0) rest = Math.max(0, rest - dt);
      const s = now;
      if (!s) return;
      // Anybody gone, walked off, built over or taken indoors: it is over.
      for (const w of [s.a, s.b]) {
        if (w.mode !== 'walk' || w.leaving || !w.visible) {
          release(s, false);
          return;
        }
      }
      s.t += dt;
      s.age += dt;
      const a = s.a, b = s.b;
      switch (s.phase) {
        case 'fight': {
          // Rolling along the street a little, one way then the other.
          const roll = Math.sin(s.age * 1.6 + (s.seed % 7)) * SCUFFLE.roll;
          s.cx = s.x + s.ax * roll;
          s.cz = s.z + s.az * roll;
          // Somebody comes to break it up (once, a moment in): it goes on until they get there, at most a while.
          if (s.responder === null && s.age > 0.8 && host.respond) {
            s.responder = host.respond(s);
            if (s.responder) s.fight = Math.max(s.fight, SCUFFLE.waitBreak);
          }
          if (s.t >= s.fight) {
            s.phase = 'dazed';
            s.t = 0;
            a.inCloud = b.inCloud = false;
            // Sat on the ground where they were, facing each other.
            faceTo(a, b.x, b.z);
            faceTo(b, a.x, a.z);
            a.seat = b.seat = 0;
            // Hats knocked askew (people.system draws it).
            for (const w of [a, b]) if (w.costume === null) w.costume = 'askew';
            a.poseTime = b.poseTime = 0;
          }
          break;
        }
        case 'dazed':
          if (s.t >= SCUFFLE.dazed) {
            s.phase = 'up';
            s.t = 0;
            a.seat = b.seat = -1;
          }
          break;
        case 'up':
          if (s.t >= SCUFFLE.up) {
            if (s.makeUp) {
              s.phase = 'shake';
              s.t = 0;
            } else {
              release(s, true);
              return;
            }
          }
          break;
        case 'shake':
          if (s.t >= SCUFFLE.shake) {
            release(s, true);
            return;
          }
          break;
      }
      // Poses (after the crowd's own reactions, which this overrides).
      for (const w of [a, b]) {
        w.poseTime += dt;
        w.pose = 'stand';
        w.react = s.phase === 'fight' ? 'stand' : s.phase === 'dazed' ? 'sit' : s.phase === 'up' ? 'dust' : 'shake';
      }
      // The ring keeps watching until they are up.
      const watching = s.phase === 'fight' || s.phase === 'dazed';
      for (const w of s.watchers) {
        const o = w.p;
        if (o.scuffle !== s || o.mode === 'gone' || o.mode === 'home' || o.mode === 'visit' || !o.visible) continue;
        if (!watching) continue;
        o.startled = Math.max(o.startled, 0.3);
        o.startledFace = Math.atan2(s.cx - o.x, s.cz - o.z);
        let off = o.startledFace - o.heading;
        off -= Math.round(off / (Math.PI * 2)) * Math.PI * 2;
        if (Math.abs(off) < 0.3 && o.seat < 0) o.react = s.phase === 'fight' && w.act === 'cheer' ? 'cheer' : w.act === 'cover' ? 'cover' : 'stand';
      }
    },
    sync() {
      const s = now;
      if (!s) return;
      const nav = host.nav();
      const node = nav?.nodeAt.get(s.cell);
      if (node === undefined || !groundOk(node)) release(s, false);
    },
    end() {
      if (now) release(now, false);
    },
    breakUp() {
      // The peace-keeper has arrived: the cloud puffs away now.
      if (now && now.phase === 'fight') now.fight = Math.min(now.fight, now.t);
    },
  };
}
