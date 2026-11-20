// L61 · Dogs (posts from L61.dogs.rule.ts). A dog keeps to its people: it
// trots at the heels of whoever of its house is out (a step behind and to
// the side), sits when they stop, and waits on the doorstep while they are
// all indoors. Now and then it trots up to somebody passing to say hello (a
// little bark and a wag), dashes at a cat it comes near (the cat leaps up,
// small/cat.behaviour.ts reads dogsOf), and runs to bark at a scuffle (L50).
// It goes wherever its person goes and never far from them, so it stays on
// the streets; it is never in anybody's way (the crowd does not wait for it).
// Its house wrecked, it runs off to the door of the nearest house that
// stands and in (or off along its street), never out of existence on the spot.
//
// Drawn here, through the stage: a few held drawings (parts/people/dog.ts),
// shown in turn on twos.

import { wrecked } from '../../birds/town';
import { DIR4 } from '@/core/grid';
import { rand } from '@/core/rand';
import type { InstanceHandle, LifeStage } from '@/life/api';
import { DOG_POSES, dogMesh, type DogPose } from '@/parts/people/dog';
import { place } from '../../motion/pose';
import type { Person } from '../../people/crowd';
import type { Board, Chain, Post } from '../board';

export interface Dog {
  post: Post;
  coat: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pose: DogPose;
  /** What it is doing: at heel, waiting at the door, greeting somebody, chasing, barking at a scuffle. */
  doing: 'heel' | 'door' | 'greet' | 'chase' | 'bark';
  /** Seconds left of what it is doing (greet, chase, bark), and before it may greet or chase again. */
  t: number;
  rest: number;
  /** Who it is greeting, or where it is dashing. */
  aim: { x: number; z: number } | null;
  stride: number;
  handles: Map<DogPose, InstanceHandle> | null;
  shown: DogPose | null;
}

const registry = new WeakMap<object, Dog[]>();
/** The dogs running on a stage (cats read where they are). */
export function dogsOf(stage: LifeStage): readonly Dog[] {
  return registry.get(stage) ?? [];
}

export interface DogChain extends Chain {
  readonly dogs: readonly Dog[];
}

const SIZE = 1.35;

/** How fast a dog whose house is wrecked runs off (units a second), and how far it will run for a door. */
const BOLT = 2.6;
const BOLT_REACH = 10;

/** Where a dog whose house is wrecked runs to: the door of the nearest house that stands, else out along its street. */
function refuge(board: Board, d: Dog): { x: number; y: number; z: number; door: boolean } {
  const shape = board.shape;
  if (shape) {
    const broken = wrecked(shape);
    let best: { x: number; y: number; z: number; door: boolean } | null = null;
    let bestD = BOLT_REACH;
    for (const sk of shape.sockets) {
      if (sk.type !== 'door' || sk.structure === undefined || sk.structure === d.post.structure || broken.has(sk.structure)) continue;
      if (shape.structures.get(sk.structure)?.kind !== 'house') continue;
      const c = board.centre(sk.cell);
      const dd = Math.hypot(c.x - d.x, c.z - d.z);
      if (dd < bestD) {
        bestD = dd;
        best = { x: c.x, y: c.y, z: c.z, door: true };
      }
    }
    if (best) return best;
  }
  const [dx, dz] = DIR4[d.post.dir ?? 0]!;
  return { x: d.x + dx * 6, y: d.y, z: d.z + dz * 6, door: false };
}

export function dogsChain(): DogChain {
  let dogs: Dog[] = [];
  /** Dogs whose house was wrecked, running for another door (drawn until they reach it). */
  let leaving: { d: Dog; to: { x: number; y: number; z: number } }[] = [];
  let seed = 0;

  const release = (d: Dog): void => {
    if (d.handles) for (const h of d.handles.values()) h.release();
    d.handles = null;
    d.shown = null;
  };

  /** The dog's person out of doors now, if any: whoever of its house is out and nearest. */
  const personOf = (board: Board, d: Dog): Person | null => {
    let best: Person | null = null, bestD = Infinity;
    for (const p of board.crowd.people) {
      if (p.home !== d.post.structure || !p.visible || p.mode === 'gone' || p.mode === 'home' || p.mode === 'visit' || p.inCloud) continue;
      const dd = Math.hypot(p.x - d.x, p.z - d.z);
      if (dd < bestD) {
        bestD = dd;
        best = p;
      }
    }
    return best;
  };

  const chain: DogChain = {
    id: 'dogs',
    get dogs() {
      return dogs;
    },
    sync(board) {
      seed = board.seed;
      const before = new Map(dogs.map((d) => [d.post.structure, d]));
      dogs = board
        .posts('dog')
        .filter((p) => p.role === 'home')
        .map((post) => {
          const had = before.get(post.structure);
          before.delete(post.structure);
          if (had) return { ...had, post };
          // Its house stands again while it is still running off: it turns round and goes home.
          const back = leaving.findIndex((l) => l.d.post.structure === post.structure);
          if (back >= 0) {
            const d = leaving.splice(back, 1)[0]!.d;
            return { ...d, post, doing: 'door' as const, aim: null };
          }
          const c = board.centre(post.cell);
          return { post, coat: Number(post.ref) || 0, x: c.x, y: c.y, z: c.z, heading: 0, pose: 'sit' as DogPose, doing: 'door' as const, t: 0, rest: 5, aim: null, stride: 0, handles: null, shown: null };
        });
      // Its house wrecked (or gone): it runs off to another door, not out of existence.
      for (const gone of before.values()) {
        if (!gone.handles) continue;
        gone.doing = 'chase';
        gone.aim = null;
        leaving.push({ d: gone, to: refuge(board, gone) });
      }
      if (board.stage) registry.set(board.stage, leaving.length > 0 ? [...dogs, ...leaving.map((l) => l.d)] : dogs);
    },
    offer() {
      return null;
    },
    step(dt, time, board) {
      for (let i = leaving.length - 1; i >= 0; i--) {
        const { d, to } = leaving[i]!;
        const dx = to.x - d.x, dz = to.z - d.z, dist = Math.hypot(dx, dz);
        const step = Math.min(dist, BOLT * dt);
        if (dist < 0.05) {
          // In at the door (or round the corner).
          release(d);
          leaving.splice(i, 1);
          if (board.stage) registry.set(board.stage, leaving.length > 0 ? [...dogs, ...leaving.map((l) => l.d)] : dogs);
          continue;
        }
        d.x += (dx / dist) * step;
        d.z += (dz / dist) * step;
        d.y += (to.y - d.y) * Math.min(1, dt * 8);
        d.heading = Math.atan2(dx, dz);
        d.stride += step / 0.11;
        d.pose = Math.floor(d.stride) % 2 === 0 ? 'trot-a' : 'trot-b';
        draw(board, d);
      }
      for (const d of dogs) {
        d.t -= dt;
        d.rest = Math.max(0, d.rest - dt);
        const owner = personOf(board, d);
        const r = (what: string): number => rand(seed, 'dog', d.post.structure ?? d.post.cell, what, Math.floor(board.now / 3));
        // What to do now.
        const s = board.crowd.scuffles.now;
        if (s && s.phase === 'fight' && Math.hypot(s.x - d.x, s.z - d.z) < 5) {
          d.doing = 'bark';
          const dx = d.x - s.x, dz = d.z - s.z, dd = Math.hypot(dx, dz) || 1;
          d.aim = { x: s.x + (dx / dd) * 0.75, z: s.z + (dz / dd) * 0.75 };
        } else if (d.doing === 'bark') d.doing = owner ? 'heel' : 'door';
        if ((d.doing === 'greet' || d.doing === 'chase') && d.t <= 0) {
          d.doing = owner ? 'heel' : 'door';
          d.rest = 6 + r('rest') * 8;
        }
        if (d.doing === 'heel' || d.doing === 'door') {
          d.doing = owner ? 'heel' : 'door';
          if (owner && d.rest <= 0 && !time.isNight) {
            // A cat near: after it. Else somebody passing: say hello.
            const cat = board.stage ? catNear(board, d) : null;
            if (cat && r('chase') < 0.5) {
              d.doing = 'chase';
              d.t = 1.8;
              d.aim = cat;
            } else {
              const other = board.crowd.people.find((p) => p !== owner && p.home !== d.post.structure && p.visible && p.mode === 'walk' && Math.hypot(p.x - d.x, p.z - d.z) < 0.9);
              if (other && r('greet') < 0.35) {
                d.doing = 'greet';
                d.t = 1.6;
                d.aim = { x: other.x, z: other.z };
              } else d.rest = 1.5;
            }
          }
        }
        // Where it wants to be, and how fast it goes.
        let tx = d.x, tz = d.z, ty = d.y, speed = 1.3, face = d.heading;
        if (d.doing === 'heel' && owner) {
          const fx = Math.sin(owner.heading), fz = Math.cos(owner.heading);
          const side = r('side') < 0.5 ? 1 : -1;
          tx = owner.x - fx * 0.3 - fz * 0.14 * side;
          tz = owner.z - fz * 0.3 + fx * 0.14 * side;
          ty = owner.y;
          speed = Math.max(1.1, owner.speed * 1.6);
          face = owner.heading;
        } else if (d.doing === 'door') {
          const c = board.centre(d.post.cell);
          const [dx, dz] = DIR4[d.post.dir ?? 0]!;
          // On the doorstep beside the door, looking out at the street.
          tx = c.x + dx * 0.28 + dz * 0.22;
          tz = c.z + dz * 0.28 - dx * 0.22;
          ty = c.y;
          face = Math.atan2(-dx, -dz);
        } else if (d.aim) {
          tx = d.aim.x;
          tz = d.aim.z;
          speed = d.doing === 'chase' ? 2.6 : 1.6;
        }
        const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz);
        const step = Math.min(dist, speed * dt);
        if (dist > 0.04) {
          d.x += (dx / dist) * step;
          d.z += (dz / dist) * step;
          d.heading = Math.atan2(dx, dz);
          d.stride += step / 0.11;
        } else d.heading += Math.max(-dt * 4, Math.min(dt * 4, ((face - d.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI));
        d.y += (ty - d.y) * Math.min(1, dt * 8);
        const moving = dist > 0.04 && step > 1e-4;
        const barking = (d.doing === 'bark' || d.doing === 'greet') && dist < 0.3;
        d.pose = barking ? (Math.floor(board.now * 4) % 2 === 0 ? 'bark' : 'stand') : moving ? (Math.floor(d.stride) % 2 === 0 ? 'trot-a' : 'trot-b') : d.doing === 'door' || (owner && owner.mode === 'linger') ? 'sit' : 'stand';
        draw(board, d);
      }
    },
    dispose() {
      for (const d of dogs) release(d);
      for (const l of leaving) release(l.d);
      leaving = [];
    },
  };

  const draw = (board: Board, d: Dog): void => {
    const stage = board.stage;
    if (!stage) return;
    if (!d.handles) {
      d.handles = new Map();
      for (const p of DOG_POSES) {
        const h = stage.spawnMesh(dogMesh(p, d.coat), place(d.x, d.y, d.z, d.heading, SIZE));
        h.setVisible(false);
        d.handles.set(p, h);
      }
    }
    if (d.shown !== d.pose) {
      if (d.shown) d.handles.get(d.shown)?.setVisible(false);
      d.handles.get(d.pose)?.setVisible(true);
      d.shown = d.pose;
    }
    d.handles.get(d.pose)?.setMatrix(place(d.x, d.y, d.z, d.heading, SIZE));
  };

  return chain;
}

/** A cat (L33) within reach of a dog, if any: where it sits. */
function catNear(board: Board, d: Dog): { x: number; z: number } | null {
  for (const a of board.dressing?.actors ?? []) {
    if (a.type !== 'cat') continue;
    const m = board.stage?.instance(a.id)?.base;
    if (!m) continue;
    const x = m[12]!, z = m[14]!;
    if (Math.hypot(x - d.x, z - d.z) < 2.5 && Math.abs(m[13]! - d.y) < 0.6) return { x, z };
  }
  return null;
}
