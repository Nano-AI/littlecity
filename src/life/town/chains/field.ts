// The playing field (design section 7, "Field"): residents come and play on
// the courts R-G03 found, and others stop and watch. A chain on the board
// (board.ts), so its players are ordinary residents and the cap holds.
//
// A court, over time:
//
//   idle     its ball lies where the last game left it (to begin with, at
//            the side of the court). By day (and into dusk, under the
//            court's lamps) a game is called every so often.
//   gather   residents choosing what to do, free, empty-handed and living
//            within GAME.reach of it, come one by one (half of those
//            asked) and stand at their places; children only on a school
//            playground. The game begins once enough have come, or after
//            GAME.gather seconds with enough; with too few they go home.
//   play     the game (src/life/field) moves them: they are in the crowd's
//            'linger' with a field errand, and the game writes where they
//            are, which way they face and how they are drawn, keeping
//            their walking-graph cell up to date. Passers-by stop at the
//            edge to watch, turning to follow the ball, clapping a basket
//            and groaning at a miss. Routes go round the court meanwhile.
//   after    handshakes at the middle, then home, or to the inn for some.
//
// Play stops at night, in heavy rain or snow (the game winds up at its next
// break), and at once if the court is edited (the players walk off where
// they stand, the ball stays where it is if the court is still there, else
// it goes with a puff). Players taken away by anything else end the game too.

import { CELL_H, key, keyY, type CellKey } from '@/core/grid';
import type { Mat4 } from '@/core/mat4';
import { rand } from '@/core/rand';
import type { InstanceHandle } from '@/life/api';
import type { PoseName } from '@/parts/people/pose';
import { ballMesh, type BallKind } from '@/parts/field/balls';
import type { MeshData } from '@/gen/mesh';
import { courtLocal, courtPoint, fieldCourtOf, type Court } from '@/rules/roles/field.lib';
import { GAME } from '@/style/field';
import { fxOf } from '../../fx/fx';
import { place } from '../../motion/pose';
import type { Person } from '../../people/crowd';
import { makeBall, stepBall, type Ball, type Game } from '../../field/kit';
import { SPORTS, type Sport } from '../../field/sports';
import type { Board, Chain, Plan, PlanStep } from '../board';
import { homeCell, reaches } from '../hands';

interface Seat {
  p: Person;
  /** Their place in the line-up (which start spot, and so which team). */
  i: number;
  /** Where they stand to begin (world), and whether they are there. */
  x: number;
  z: number;
  arrived: boolean;
}

interface Venue {
  id: number;
  /** Role, rectangle and level: a change of any is a different court. */
  key: string;
  court: Court;
  sport: Sport;
  cells: Set<CellKey>;
  level: number;
  state: 'idle' | 'gather' | 'play';
  roster: Seat[];
  game: Game | null;
  games: number;
  /** Life time when the next game may be called, and when gathering began. */
  next: number;
  since: number;
  /** The ball while nobody plays (it settles where it was left). */
  idle: Ball;
  /** Any other balls the last game left lying (a game of bowls leaves its woods). */
  lying: Ball[];
  /** Drawings of the balls, by index. */
  drawn: (InstanceHandle | null)[];
  /** The events already reacted to. */
  seen: number;
  watchers: Map<Person, { cell: CellKey; until: number; react: number; pose: PoseName }>;
  /** Cells round the court where watchers stand (walking-graph cells, off the court). */
  edge: CellKey[];
  crowded: boolean;
}

export interface FieldChain extends Chain {
  readonly venues: readonly {
    id: number;
    state: 'idle' | 'gather' | 'play';
    game: Game | null;
    roster: readonly Person[];
    watchers: readonly Person[];
    balls: readonly Ball[];
  }[];
  /** Calls a game now on every court that can have one (sequences, tests). */
  call(): void;
}

const RADIUS: Record<BallKind, number> = {
  basketball: GAME.basketball,
  tennis: GAME.tennisBall,
  football: GAME.football,
  bowl: GAME.bowl,
  'bowl-b': GAME.bowl,
  jack: GAME.bowl * 0.55,
  boule: GAME.bowl * 0.9,
  'croquet-a': GAME.bowl,
  'croquet-b': GAME.bowl,
  'croquet-c': GAME.bowl,
  'croquet-d': GAME.bowl,
};
const BALL_OF: Partial<Record<Court['role'], BallKind>> = {
  'basketball-court': 'basketball',
  'tennis-court': 'tennis',
  'football-pitch': 'football',
  'kickabout-green': 'football',
  'bowling-green': 'jack',
  'boules-court': 'jack',
  'croquet-lawn': 'croquet-a',
};

/** How much dearer a court cell is to walk through while a game is on (a street tree's clutter is 20). */
const NAV_PLAY = 25;

export function fieldChain(): FieldChain {
  let venues: Venue[] = [];
  const meshes = new Map<BallKind, MeshData>();
  let calling = false;

  const meshOf = (k: BallKind): MeshData => {
    let m = meshes.get(k);
    if (!m) meshes.set(k, (m = ballMesh(k, RADIUS[k])));
    return m;
  };

  const playing = (v: Venue, p: Person): boolean => v.roster.some((s) => s.p === p);
  const anywhere = (p: Person): Venue | undefined => venues.find((v) => playing(v, p) || v.watchers.has(p));
  /** On their way here with one of this chain's plans, or standing on a court (or at its edge) with a field errand. */
  const isMine = (p: Person, board: Board): boolean => board.plans.get(p)?.chain === chain || (p.mode === 'linger' && (p.goal?.errand?.tag ?? '').startsWith('field:') && p.goal?.errand?.tag !== 'field:home' && p.goal?.errand?.tag !== 'field:inn');

  /** Lets everyone on a court go: home, or to the inn for a few; the game is dropped. */
  const release = (v: Venue, board: Board, withPlans: boolean): void => {
    const seats = v.roster;
    v.roster = [];
    v.game = null;
    v.state = 'idle';
    v.next = board.now + GAME.rest * (0.6 + rand(board.seed, 'field-rest', v.id, v.games) * 0.8);
    setCrowded(v, board, false);
    for (const s of seats) {
      const p = s.p;
      if (!withPlans || p.mode === 'gone' || !isMine(p, board)) continue;
      p.pose = 'stand';
      const steps: PlanStep[] = [];
      const inn = innOf(board);
      if (inn !== undefined && rand(p.seed, 'field-inn', p.trips) < 0.3) {
        const s2 = board.stepIn(inn, { linger: 15 + rand(p.seed, 'field-inn-stay', p.trips) * 20, tag: 'field:inn' });
        if (s2) steps.push(s2);
      }
      const home = board.homeStep(p, { tag: 'field:home' });
      if (home) steps.push(home);
      if (steps.length) board.assign(p, { chain, at: 0, steps });
      else board.drop(p);
    }
  };

  const innOf = (board: Board): number | undefined => {
    for (const [id, r] of board.shape?.roles ?? []) if (r.role === 'inn') return id;
    return undefined;
  };

  const setCrowded = (v: Venue, board: Board, on: boolean): void => {
    if (v.crowded === on) return;
    v.crowded = on;
    for (const c of v.cells) board.crowd.setCrowded(c, on ? NAV_PLAY : 0);
  };

  const drawBalls = (v: Venue, board: Board): void => {
    const stage = board.stage;
    if (!stage) return;
    const balls = v.game ? v.game.balls : BALL_OF[v.court.role] ? [v.idle, ...v.lying] : [];
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i]!;
      let h = v.drawn[i] ?? null;
      if (!h) {
        h = stage.spawnMesh(meshOf(b.kind), matrixOf(b));
        v.drawn[i] = h;
      }
      h.setMatrix(matrixOf(b));
    }
    for (let i = balls.length; i < v.drawn.length; i++) {
      v.drawn[i]?.release();
      v.drawn[i] = null;
    }
    v.drawn.length = balls.length;
  };

  /** Free to be asked: out and about or at home, nothing in the hands, nobody else's. */
  const free = (p: Person, board: Board): boolean => !p.shutIn && !p.leaving && p.mode !== 'gone' && !p.load && !p.scuffle && !p.party && board.claimedBy(p) === null && !anywhere(p);

  const total = (): number => venues.reduce((n, v) => n + v.roster.length, 0);

  const startGame = (v: Venue, board: Board): void => {
    const here = v.roster.filter((s) => s.arrived).sort((a, b) => a.i - b.i);
    // Those still on their way are let go.
    for (const s of v.roster) if (!s.arrived && isMine(s.p, board)) board.drop(s.p);
    v.roster = here;
    v.games++;
    v.game = v.sport.make(
      v.court,
      here.map((s) => s.p),
      { seed: (board.seed ^ (v.id * 7919) ^ (v.games * 104729)) >>> 0, length: GAME.length + (rand(board.seed, 'field-len', v.id, v.games) - 0.5) * GAME.lengthVary, ball: { x: v.idle.x, z: v.idle.z }, lying: v.lying.map((b) => ({ x: b.x, z: b.z })) },
    );
    v.state = 'play';
    v.seen = 0;
    setCrowded(v, board, true);
    for (const h of v.drawn) h?.release();
    v.drawn = [];
  };

  const endGame = (v: Venue, board: Board): void => {
    const g = v.game;
    if (g && g.balls.length > 0) {
      // The balls stay where the game left them (one in a hand drops where it is).
      const [first, ...rest] = g.balls.map(settled);
      v.idle = first!;
      v.lying = rest;
    }
    for (const h of v.drawn) h?.release();
    v.drawn = [];
    release(v, board, true);
  };

  /** Watchers: turned to the ball, clapping and groaning with the game. */
  const watch = (v: Venue, board: Board, dt: number): void => {
    const g = v.game;
    const ball = g?.balls[0];
    const fresh = g ? g.events.slice(v.seen) : [];
    if (g) v.seen = g.events.length;
    const cheer = fresh.some((e) => e.kind === 'basket' || e.kind === 'goal' || e.kind === 'point');
    const groan = fresh.some((e) => e.kind === 'rim' || e.kind === 'save' || e.kind === 'net');
    for (const [p, w] of v.watchers) {
      const mine = p.mode === 'linger' && p.goal?.errand?.tag === 'field:watch';
      if (p.mode === 'gone' || (!mine && p.mode !== 'walk' && p.mode !== 'wait')) {
        v.watchers.delete(p);
        continue;
      }
      if (!mine) continue;
      if (!g || board.now > w.until) {
        v.watchers.delete(p);
        p.pose = 'stand';
        board.crowd.rethink(p);
        continue;
      }
      // Heads follow the ball.
      if (ball) {
        const want = Math.atan2(ball.x - p.x, ball.z - p.z);
        let off = want - p.heading;
        off -= Math.round(off / (Math.PI * 2)) * Math.PI * 2;
        p.heading += Math.max(-6 * dt, Math.min(6 * dt, off));
      }
      if (cheer || groan) {
        w.react = 1.4;
        w.pose = cheer ? (rand(p.seed, 'field-cheer', g!.events.length) < 0.5 ? 'clap' : 'cheer') : 'hat';
        p.poseTime = 0;
      }
      if (w.react > 0) {
        w.react -= dt;
        p.pose = w.pose;
        if (w.react <= 0) p.pose = 'stand';
      }
    }
  };

  const chain: FieldChain = {
    id: 'field',
    get venues() {
      return venues.map((v) => ({ id: v.id, state: v.state, game: v.game, roster: v.roster.map((s) => s.p), watchers: [...v.watchers.keys()], balls: v.game ? v.game.balls : BALL_OF[v.court.role] ? [v.idle, ...v.lying] : [] }));
    },
    call() {
      calling = true;
    },
    sync(board) {
      const shape = board.shape;
      if (!shape) return;
      const before = venues;
      const next: Venue[] = [];
      for (const s of shape.structures.values()) {
        if (s.kind !== 'field') continue;
        const court = fieldCourtOf(shape, s, CELL_H);
        if (!court) continue;
        const sport = SPORTS[court.role];
        if (!sport) continue;
        const level = keyY(s.cells[0]!);
        const k = `${court.role}|${court.rect.x0},${court.rect.z0},${court.rect.w},${court.rect.d}|${level}|${court.along}`;
        const had = before.find((v) => v.id === s.id && v.key === k);
        if (had) {
          had.cells = new Set(s.cells);
          had.edge = edgeOf(board, had.cells, court);
          next.push(had);
          continue;
        }
        // Balls lying on the old court stay where they are if this is the same game and they are on it; the rest go with a puff.
        const old = before.find((v) => v.id === s.id);
        const kept = old && old.court.role === court.role ? ballsOf(old).filter((b) => onCourt(court, b)).map(settled) : [];
        const kind = BALL_OF[court.role] ?? 'basketball';
        let idle = kept.shift() ?? null;
        if (!idle) {
          const [x, z] = courtPoint(court, -court.hl * 0.45, -court.hw * 0.62);
          idle = makeBall(kind, RADIUS[kind], x, court.y + RADIUS[kind], z);
        }
        next.push({
          id: s.id,
          key: k,
          court,
          sport,
          cells: new Set(s.cells),
          level,
          state: 'idle',
          roster: [],
          game: null,
          games: 0,
          next: board.now + 2 + rand(board.seed, 'field-first', s.id) * 10,
          since: 0,
          idle,
          lying: kept,
          drawn: [],
          seen: 0,
          watchers: new Map(),
          edge: edgeOf(board, new Set(s.cells), court),
          crowded: false,
        });
      }
      // Courts gone or changed: the game stops at once; the ball goes with a puff unless it lies on the new court.
      for (const v of before) {
        if (next.includes(v)) continue;
        const now = next.find((n) => n.id === v.id);
        const stay = now ? [now.idle, ...now.lying] : [];
        if (board.stage) {
          for (const b of ballsOf(v)) {
            // Kept balls are copies at the same place: those not kept puff away where they were.
            if (stay.some((k) => Math.abs(k.x - b.x) < 1e-6 && Math.abs(k.z - b.z) < 1e-6)) continue;
            fxOf(board.stage).play({ actor: 'puff', variant: 'dust' }, 0.45, (t, m) => place(b.x, b.y + t * 0.1, b.z, 0, 0.3 + t * 0.4, 0.3 + t * 0.4, 0.3 + t * 0.4, m));
          }
        }
        for (const h of v.drawn) h?.release();
        v.drawn = [];
        for (const p of v.watchers.keys()) if (isMine(p, board)) board.crowd.rethink(p);
        release(v, board, true);
      }
      venues = next;
    },
    step(dt, time, board) {
      const open = (time.isDay || time.isDusk) && board.weather.rain < GAME.rain && board.weather.snow < GAME.rain;
      const cap = Math.max(GAME.minPlayers, Math.floor(board.crowd.people.length * GAME.share));
      for (const v of venues) {
        switch (v.state) {
          case 'idle':
            for (const b of [v.idle, ...v.lying]) stepBall(b, v.court, dt);
            if (open && (board.now >= v.next || calling) && total() + v.sport.min <= cap) {
              v.state = 'gather';
              v.since = board.now;
              v.roster = [];
            }
            break;
          case 'gather': {
            for (const b of [v.idle, ...v.lying]) stepBall(b, v.court, dt);
            // Those who stopped coming (called away) leave the list.
            v.roster = v.roster.filter((s) => s.arrived ? isMine(s.p, board) : isMine(s.p, board) || s.p.mode === 'walk');
            const here = v.roster.filter((s) => s.arrived);
            for (const s of here) {
              // Waiting at their place, facing the middle.
              const want = Math.atan2(v.court.cx - s.p.x, v.court.cz - s.p.z);
              s.p.heading = want;
              s.p.pose = 'stand';
            }
            const waited = board.now - v.since;
            if (here.length >= v.sport.max || (here.length >= v.sport.min && (waited > GAME.gather || here.length === v.roster.length && waited > 8))) startGame(v, board);
            else if (!open || waited > GAME.gather * 2) release(v, board, true);
            break;
          }
          case 'play': {
            const g = v.game!;
            // Anyone taken away (or gone) ends it at once; night and rain end it at the next break.
            if (v.roster.some((s) => s.p.mode === 'gone' || !isMine(s.p, board) || s.p.mode !== 'linger')) {
              endGame(v, board);
              break;
            }
            if (!open) g.finish();
            g.step(dt);
            for (const s of v.roster) {
              const p = s.p;
              const c = key(Math.floor(p.x), v.level, Math.floor(p.z));
              const node = board.nav?.nodeAt.get(c);
              if (node !== undefined) {
                p.node = node;
                p.cell = c;
              }
              p.seat = -1;
            }
            watch(v, board, dt);
            if (g.phase === 'over') endGame(v, board);
            break;
          }
        }
        if (v.state !== 'play') watch(v, board, dt);
        drawBalls(v, board);
      }
      calling = false;
    },
    offer(p, time, board) {
      if (!free(p, board)) return null;
      const home = homeCell(board, p);
      if (home === null) return null;
      for (const v of venues) {
        if (v.state !== 'gather' || v.roster.length >= v.sport.max) continue;
        const who = v.sport.who;
        const school = board.shape?.tags.get(v.id)?.has('school-playground') ?? false;
        if (school ? !p.child : (who === 'adults' && p.child) || (who === 'children' && !p.child)) continue;
        const cell0 = key(v.court.rect.x0, v.level, v.court.rect.z0);
        if (board.dist(home, cell0) > GAME.reach || !reaches(board, p, cell0)) continue;
        if (rand(p.seed, 'field-join', p.trips, v.id) >= GAME.join) continue;
        // The first place nobody has.
        let i = 0;
        while (v.roster.some((s) => s.i === i)) i++;
        const [u, vv] = v.sport.spot(v.court, i, v.sport.max);
        const [x, z] = courtPoint(v.court, u, vv);
        const cell = key(Math.floor(x), v.level, Math.floor(z));
        if (board.nav?.nodeAt.get(cell) === undefined) continue;
        const seat: Seat = { p, i, x, z, arrived: false };
        v.roster.push(seat);
        const step = board.stepAt(cell, { spot: { x, z }, face: NaN, pose: 'stand', linger: 1e6, brisk: true, tag: v.sport.tag, done: () => void (seat.arrived = true) });
        return { chain, at: 0, steps: [step], fail: () => void (v.roster = v.roster.filter((s) => s !== seat)) } satisfies Plan;
      }
      // Watchers: passers-by stop at the edge of a game for a while.
      if (!time.isDay && !time.isDusk) return null;
      for (const v of venues) {
        if (v.state !== 'play' || v.watchers.size >= GAME.watchers || v.edge.length === 0) continue;
        if (board.dist(home, key(v.court.rect.x0, v.level, v.court.rect.z0)) > GAME.reach) continue;
        if (rand(p.seed, 'field-watch', p.trips, v.id) >= GAME.watch) continue;
        const taken = new Set([...v.watchers.values()].map((w) => w.cell));
        const cells = v.edge.filter((c) => !taken.has(c) && reaches(board, p, c));
        if (!cells.length) continue;
        const cell = cells[Math.floor(rand(p.seed, 'field-edge', p.trips) * cells.length)]!;
        const c = board.centre(cell);
        const toward = Math.atan2(v.court.cx - c.x, v.court.cz - c.z);
        // Stand at the side of the cell nearest the court.
        const sx = c.x + Math.sin(toward) * 0.25, sz = c.z + Math.cos(toward) * 0.25;
        const w = { cell, until: board.now + 25 + rand(p.seed, 'field-stay', p.trips) * 25, react: 0, pose: 'stand' as PoseName };
        v.watchers.set(p, w);
        return {
          chain,
          at: 0,
          steps: [board.stepAt(cell, { spot: { x: sx, z: sz }, face: NaN, pose: 'stand', linger: 1e6, tag: 'field:watch' })],
          fail: () => void v.watchers.delete(p),
        } satisfies Plan;
      }
      return null;
    },
    dispose(board) {
      for (const v of venues) {
        for (const h of v.drawn) h?.release();
        v.drawn = [];
        setCrowded(v, board, false);
      }
      venues = [];
    },
  };
  return chain;
}

/** The walking-graph cells just off a court (not on the field), where watchers stand. */
function edgeOf(board: Board, cells: ReadonlySet<CellKey>, court: Court): CellKey[] {
  const nav = board.nav;
  if (!nav) return [];
  const out = new Set<CellKey>();
  const level = keyY([...cells][0]!);
  const r = court.rect;
  for (let x = r.x0 - 1; x <= r.x0 + r.w; x++) {
    for (let z = r.z0 - 1; z <= r.z0 + r.d; z++) {
      if (x >= r.x0 && x < r.x0 + r.w && z >= r.z0 && z < r.z0 + r.d) continue;
      if (x < 0 || z < 0 || x > 47 || z > 47) continue;
      const c = key(x, level, z);
      if (cells.has(c) || !nav.nodeAt.has(c)) continue;
      // Not the corners: they see the court end on.
      const corner = (x === r.x0 - 1 || x === r.x0 + r.w) && (z === r.z0 - 1 || z === r.z0 + r.d);
      if (!corner) out.add(c);
    }
  }
  return [...out];
}

/** Every ball on a court now: the game's, or those lying there. */
function ballsOf(v: { game: Game | null; idle: Ball; lying: Ball[]; court: Court }): Ball[] {
  if (v.game) return v.game.balls.slice();
  return BALL_OF[v.court.role] ? [v.idle, ...v.lying] : [];
}
/** A copy of a ball left to itself: out of any hand, falling if it was held. */
function settled(b: Ball): Ball {
  const held = b.state === 'held';
  return { ...b, rot: b.rot.slice(), holder: null, state: held ? 'flight' : b.state, ...(held ? { vx: 0, vy: 0, vz: 0 } : {}) };
}
function onCourt(c: Court, b: Ball): boolean {
  const [u, v] = courtLocal(c, b.x, b.z);
  return Math.abs(u) < c.rl && Math.abs(v) < c.rw && Math.abs(b.y - c.y) < 1;
}

/** A ball's drawing: its turn and where it is. */
function matrixOf(b: Ball): Mat4 {
  const r = b.rot;
  return [r[0]!, r[1]!, r[2]!, 0, r[3]!, r[4]!, r[5]!, 0, r[6]!, r[7]!, r[8]!, 0, b.x, b.y, b.z, 1];
}

