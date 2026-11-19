// A moored ship's crew at work (L38–L40): two or three sailors who take a
// crate, barrel or sack up from the hatch, carry it along the deck, over the
// rail and down the gangplank, and set it down on the quay where the goods
// pile up. Then back aboard for the next, until the pile is made or the ship
// is ready to sail, when they go back aboard and below.
//
// Drawn like the residents (src/parts/people): five rigid pieces each, a
// held walk drawn on twos with the stride by distance, so feet do not slide.
// Where they are on deck is in the ship's own frame, so they ride the swell
// with it.
//
// The goods they land outlast the visit: the harbour lets them lie a while
// and then they are carted off (they shrink away, never pop).

import type { Mat4Like, Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { buildPerson, lookOf, PIECES, type Look } from '@/parts/people/person';
import { poseOf, rigMatrices, type PoseName } from '@/parts/people/pose';
import { PERSON } from '@/style/people';
import { PALETTE, RAMPS } from '@/style/palette';
import type { InstanceHandle, LifeStage } from '../api';
import { easeIn } from '../motion/ease';
import { place } from '../motion/pose';

const HIDDEN = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
/** Walking pace, columns a second (a little slower carrying). */
const PACE = 0.72;

/** The route of one trip, ship end to quay end. Deck points are in the ship's frame; the rest in the world. */
export interface Gangway {
  /** On deck: the hatch, and the foot of the rail where the plank comes aboard (ship frame). */
  hatch: Vec3;
  rail: Vec3;
  /** On the rail where the plank rests (ship frame). */
  top: Vec3;
  /** The plank's foot on the quay (world). */
  foot: Vec3;
}

/** A place on the quay where the landed goods go: world position and turn. */
export interface Spot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

type Leg = 'below' | 'hatch' | 'deck' | 'up' | 'plank' | 'quay' | 'drop' | 'back-quay' | 'back-plank' | 'down' | 'back-deck';

interface Sailor {
  look: Look;
  pieces: InstanceHandle[];
  leg: Leg;
  /** How far along the current leg (0–1), and how long the leg is. */
  t: number;
  len: number;
  /** Stride phase by distance walked. */
  stride: number;
  /** Seconds left before setting off (they start one after another). */
  wait: number;
  item: InstanceHandle | null;
  itemKind: string;
  shown: boolean;
}

/** Kinds of goods each ship brings ashore. */
const CARGO: Record<string, readonly string[]> = {
  galleon: ['crate', 'barrel', 'crate'],
  cog: ['barrel', 'sack', 'barrel'],
  galley: ['sack', 'crate', 'sack'],
};

export class Crew {
  private sailors: Sailor[] = [];
  /** Goods set down on the quay so far, and those still to land. */
  readonly landed: InstanceHandle[] = [];
  private toLand: number;
  private local = new Float32Array(80);
  private world = new Float32Array(16);
  private time = 0;

  constructor(private stage: LifeStage, private seed: number, private kind: string, count: number, goods: number, private spots: readonly Spot[]) {
    this.toLand = Math.min(goods, spots.length);
    for (let i = 0; i < count; i++) {
      const base = lookOf(rand(seed, 'sailor', i) * 1e9 >>> 0);
      // Sailors: striped or plain shirts in the ship's way, dark breeches, a cap or a bare head.
      const look: Look = { ...base, dress: false, top: i % 2 === 0 ? PALETTE.white : RAMPS.roof[1]!, bottom: PALETTE.metal, hat: i === 0 ? 'cap' : base.hat === 'straw' ? 'none' : base.hat, hatColor: PALETTE.redDark, child: false };
      const meshes = buildPerson(look, `sailor-${seed}-${i}`);
      const pieces = PIECES.map((p) => stage.spawnMesh(meshes[p], HIDDEN));
      for (const h of pieces) h.setVisible(false);
      this.sailors.push({ look, pieces, leg: 'below', t: 0, len: 1, stride: rand(seed, 'stride', i), wait: 1.5 + i * 2.2, item: null, itemKind: '', shown: false });
    }
  }

  /** True once everyone is back aboard and below. */
  get aboard(): boolean {
    return this.sailors.every((s) => s.leg === 'below');
  }

  /**
   * Moves the crew `dt` seconds on. `hull` is the ship's matrix now; `working` false sends them all back
   * aboard (the ship is about to sail).
   */
  update(dt: number, hull: Mat4Like, way: Gangway, working: boolean): void {
    this.time += dt;
    const w = (p: Vec3): Vec3 => [hull[0]! * p[0] + hull[4]! * p[1] + hull[8]! * p[2] + hull[12]!, hull[1]! * p[0] + hull[5]! * p[1] + hull[9]! * p[2] + hull[13]!, hull[2]! * p[0] + hull[6]! * p[1] + hull[10]! * p[2] + hull[14]!];
    const hatch = w(way.hatch), rail = w(way.rail), top = w(way.top), foot = way.foot;
    const dist = (a: Vec3, b: Vec3): number => Math.hypot(b[0] - a[0], b[2] - a[2]) + Math.abs(b[1] - a[1]) * 0.5;
    this.sailors.forEach((s, i) => {
      const spot = this.spots[Math.min(this.landed.length, this.spots.length - 1)];
      const pile: Vec3 = spot ? [spot.x - Math.sin(spot.yaw) * 0.22, spot.y, spot.z - Math.cos(spot.yaw) * 0.22] : foot;
      // Where this leg runs from and to.
      const ends: Record<Leg, [Vec3, Vec3]> = {
        below: [hatch, hatch],
        hatch: [hatch, hatch],
        deck: [hatch, rail],
        up: [rail, top],
        plank: [top, foot],
        quay: [foot, pile],
        drop: [pile, pile],
        'back-quay': [pile, foot],
        'back-plank': [foot, top],
        down: [top, rail],
        'back-deck': [rail, hatch],
      };
      // Decide the next leg when this one is done.
      if (s.t >= 1) {
        const next = ((): Leg => {
          switch (s.leg) {
            case 'below':
              return working && this.toLand > 0 ? 'hatch' : 'below';
            case 'hatch':
              return 'deck';
            case 'deck':
              return 'up';
            case 'up':
              return 'plank';
            case 'plank':
              return 'quay';
            case 'quay':
              return 'drop';
            case 'drop':
              return 'back-quay';
            case 'back-quay':
              return 'back-plank';
            case 'back-plank':
              return 'down';
            case 'down':
              return 'back-deck';
            default:
              return 'below';
          }
        })();
        if (next === 'hatch') {
          if (s.wait > 0) {
            s.wait -= dt;
            return this.hide(s);
          }
          this.toLand--;
          s.itemKind = (CARGO[this.kind] ?? CARGO.galleon!)[(this.landed.length + i) % 3]!;
          s.item = this.stage.spawn({ actor: 'ship-goods', variant: s.itemKind, params: { look: (rand(this.seed, 'goods', this.landed.length, i) * 1000) | 0 } }, HIDDEN);
        }
        if (s.leg === 'drop' && s.item) {
          // Set down on the pile.
          const at = this.spots[Math.min(this.landed.length, this.spots.length - 1)]!;
          s.item.setMatrix(place(at.x, at.y, at.z, at.yaw));
          this.landed.push(s.item);
          s.item = null;
        }
        s.leg = next;
        s.t = 0;
        const [a, b] = ends[next];
        s.len = next === 'hatch' ? 0.6 * PACE : next === 'drop' ? 0.5 * PACE : next === 'below' ? 1 : Math.max(0.05, dist(a, b));
      }
      // If they must go aboard, anyone on the quay turns back now (keeping their load if they have not set it down).
      if (!working && (s.leg === 'quay' || s.leg === 'plank')) {
        s.leg = s.leg === 'quay' ? 'back-quay' : 'back-plank';
        s.t = 1 - s.t;
      }
      if (s.leg === 'below') {
        s.t = 1;
        if (s.item) {
          s.item.release();
          s.item = null;
        }
        return this.hide(s);
      }
      const [a, b] = ends[s.leg];
      const still = s.leg === 'hatch' || s.leg === 'drop';
      const step = (dt * PACE * (s.item ? 0.85 : 1)) / s.len;
      s.t = Math.min(1, s.t + (still ? dt / s.len : step));
      const x = a[0] + (b[0] - a[0]) * s.t, y = a[1] + (b[1] - a[1]) * s.t, z = a[2] + (b[2] - a[2]) * s.t;
      if (!still) s.stride += (dt * PACE) / (PERSON.height * 2.4);
      const heading = still ? Math.atan2(rail[0] - hatch[0], rail[2] - hatch[2]) : Math.atan2(b[0] - a[0], b[2] - a[2]);
      const pose: PoseName = still ? (s.leg === 'drop' ? 'tend' : 'stand') : s.item ? 'carry' : 'walk';
      this.draw(s, x, y, z, heading, pose);
    });
  }

  private hide(s: Sailor): void {
    if (!s.shown) return;
    s.shown = false;
    for (const h of s.pieces) h.setVisible(false);
  }

  private draw(s: Sailor, x: number, y: number, z: number, heading: number, pose: PoseName): void {
    if (!s.shown) {
      s.shown = true;
      for (const h of s.pieces) h.setVisible(true);
    }
    const phase = pose === 'walk' || pose === 'carry' ? s.stride : this.time;
    // Carrying walks too: the legs keep their stride, the arms hold the load.
    const p = poseOf(pose === 'carry' ? 'walk' : pose, phase);
    if (pose === 'carry') {
      const c = poseOf('carry', this.time);
      p.armL = c.armL;
      p.armR = c.armR;
      p.outL = c.outL;
      p.outR = c.outR;
    }
    rigMatrices(s.look, p, this.local);
    const c = Math.cos(heading) * s.look.scale, sn = Math.sin(heading) * s.look.scale;
    for (let i = 0; i < 5; i++) {
      const k = i * 16, m = this.world;
      for (let col = 0; col < 4; col++) {
        const o = k + col * 4;
        const lx = this.local[o]!, ly = this.local[o + 1]!, lz = this.local[o + 2]!;
        m[col * 4] = c * lx + sn * lz + (col === 3 ? x : 0);
        m[col * 4 + 1] = s.look.scale * ly + (col === 3 ? y : 0);
        m[col * 4 + 2] = -sn * lx + c * lz + (col === 3 ? z : 0);
        m[col * 4 + 3] = col === 3 ? 1 : 0;
      }
      s.pieces[i]!.setMatrix(m);
    }
    if (s.item) s.item.setMatrix(place(x + Math.sin(heading) * 0.1, y + 0.17, z + Math.cos(heading) * 0.1, heading, 0.85));
  }

  /** Releases the sailors (and anything still in their arms); the landed goods are the caller's. */
  release(): void {
    for (const s of this.sailors) {
      for (const h of s.pieces) h.release();
      s.item?.release();
      s.item = null;
    }
    this.sailors = [];
  }
}

/** Goods lying on the quay after a ship has gone: after `linger` seconds they shrink away, one by one. */
export class LeftGoods {
  private t = 0;
  constructor(private goods: InstanceHandle[], private spots: readonly Spot[], private linger: number) {}

  /** False once everything is gone (and released). */
  update(dt: number): boolean {
    this.t += dt;
    const gone = this.t - this.linger;
    if (gone < 0) return true;
    let left = 0;
    this.goods.forEach((g, i) => {
      const k = 1 - easeIn(Math.min(1, Math.max(0, (gone - i * 0.35) / 0.6)));
      const at = this.spots[i]!;
      if (k > 0) {
        g.setMatrix(place(at.x, at.y, at.z, at.yaw, Math.max(0.001, k)));
        left++;
      } else g.setVisible(false);
    });
    if (left === 0) {
      for (const g of this.goods) g.release();
      this.goods = [];
      return false;
    }
    return true;
  }

  release(): void {
    for (const g of this.goods) g.release();
    this.goods = [];
  }
}
