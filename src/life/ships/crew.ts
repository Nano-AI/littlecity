// A moored ship's crew at work (L38–L40): two or three sailors who work the
// cargo between the hatch and the quay. If goods lie on the quay from an
// earlier visit, they carry those aboard first; then they bring new goods up
// from the hatch, along the deck, over the rail, down the gangplank, and set
// them down on the quay where they pile up. When the ship is ready to sail
// they go back aboard and below.
//
// The goods on the quay are the harbour's (a Pile per berth), and they stay
// there between visits as dock goods: nothing on the quay ever shrinks or
// fades; goods only go when sailors carry them aboard (or, if the quay under
// them is taken away, with the removal puff: visit.ts).
//
// Drawn like the residents (src/parts/people): five rigid pieces each, a held
// walk drawn on twos with the stride by distance, so feet do not slide. Where
// they are on deck is in the ship's own frame, so they ride the swell with it.

import type { Mat4Like, Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { buildPerson, lookOf, PIECES, type Look } from '@/parts/people/person';
import { poseOf, rigMatrices, type PoseName } from '@/parts/people/pose';
import { PERSON } from '@/style/people';
import { PALETTE, RAMPS } from '@/style/palette';
import type { InstanceHandle, LifeStage } from '../api';
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

/** A place on the quay where goods lie: world position and turn. */
export interface Spot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** Goods lying on a quay: what lies in each of its spots (null: free). */
export interface Pile {
  spots: Spot[];
  items: (InstanceHandle | null)[];
}

type Leg = 'below' | 'hatch' | 'deck' | 'up' | 'plank' | 'quay' | 'drop' | 'back-quay' | 'back-plank' | 'down' | 'back-deck';

interface Sailor {
  look: Look;
  pieces: InstanceHandle[];
  leg: Leg;
  t: number;
  len: number;
  stride: number;
  wait: number;
  /** What this trip is: taking goods aboard, or landing them; and which spot of the pile it is for. */
  loading: boolean;
  spot: number;
  item: InstanceHandle | null;
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
  private toLand: number;
  private local = new Float32Array(80);
  private world = new Float32Array(16);
  private time = 0;
  /** Spots someone is on the way to (so two sailors never go for one). */
  private claimed = new Set<number>();
  private landed = 0;

  constructor(private stage: LifeStage, private seed: number, private kind: string, count: number, goods: number, private pile: Pile) {
    this.toLand = Math.min(goods, pile.spots.length);
    for (let i = 0; i < count; i++) {
      const base = lookOf(rand(seed, 'sailor', i) * 1e9 >>> 0);
      // Sailors: white or blue shirts, dark breeches, a red cap or a bare head.
      const look: Look = { ...base, dress: false, top: i % 2 === 0 ? PALETTE.white : RAMPS.roof[1]!, bottom: PALETTE.metal, hat: i === 0 ? 'cap' : base.hat === 'straw' ? 'none' : base.hat, hatColor: PALETTE.redDark, child: false };
      const meshes = buildPerson(look, `sailor-${seed}-${i}`);
      const pieces = PIECES.map((p) => stage.spawnMesh(meshes[p], HIDDEN));
      for (const h of pieces) h.setVisible(false);
      this.sailors.push({ look, pieces, leg: 'below', t: 1, len: 1, stride: rand(seed, 'stride', i), wait: 1.5 + i * 2.2, loading: false, spot: -1, item: null, shown: false });
    }
  }

  /** True once everyone is back aboard and below. */
  get aboard(): boolean {
    return this.sailors.every((s) => s.leg === 'below');
  }

  /** The next job: a load waiting on the quay to bring aboard, else a free spot to land goods in. */
  private nextJob(): { loading: boolean; spot: number } | null {
    for (let i = this.pile.items.length - 1; i >= 0; i--) if (this.pile.items[i] && !this.claimed.has(i)) return { loading: true, spot: i };
    if (this.toLand <= 0) return null;
    for (let i = 0; i < this.pile.spots.length; i++) if (!this.pile.items[i] && !this.claimed.has(i)) return { loading: false, spot: i };
    return null;
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
      const spot = s.spot >= 0 ? this.pile.spots[s.spot] : undefined;
      // They stand just short of the spot, facing it.
      const at: Vec3 = spot ? [spot.x - Math.sin(spot.yaw) * 0.22, spot.y, spot.z - Math.cos(spot.yaw) * 0.22] : foot;
      const ends: Record<Leg, [Vec3, Vec3]> = {
        below: [hatch, hatch],
        hatch: [hatch, hatch],
        deck: [hatch, rail],
        up: [rail, top],
        plank: [top, foot],
        quay: [foot, at],
        drop: [at, at],
        'back-quay': [at, foot],
        'back-plank': [foot, top],
        down: [top, rail],
        'back-deck': [rail, hatch],
      };
      if (s.t >= 1) {
        let next: Leg;
        switch (s.leg) {
          case 'below': {
            const job = working ? this.nextJob() : null;
            if (!job) return this.hide(s);
            if (s.wait > 0) {
              s.wait -= dt;
              return this.hide(s);
            }
            s.loading = job.loading;
            s.spot = job.spot;
            this.claimed.add(job.spot);
            if (!job.loading) {
              this.toLand--;
              const kinds = CARGO[this.kind] ?? CARGO.galleon!;
              s.item = this.stage.spawn({ actor: 'ship-goods', variant: kinds[(this.landed + i) % 3]!, params: { look: (rand(this.seed, 'goods', this.landed, i) * 1000) | 0 } }, HIDDEN);
              this.landed++;
            }
            next = 'hatch';
            break;
          }
          case 'hatch': next = 'deck'; break;
          case 'deck': next = 'up'; break;
          case 'up': next = 'plank'; break;
          case 'plank': next = 'quay'; break;
          case 'quay': next = 'drop'; break;
          case 'drop': {
            // Set the load down, or pick one up.
            const sp = this.pile.spots[s.spot]!;
            if (s.loading) {
              s.item = this.pile.items[s.spot] ?? null;
              this.pile.items[s.spot] = null;
            } else if (s.item) {
              s.item.setMatrix(place(sp.x, sp.y, sp.z, sp.yaw));
              this.pile.items[s.spot] = s.item;
              s.item = null;
            }
            this.claimed.delete(s.spot);
            next = 'back-quay';
            break;
          }
          case 'back-quay': next = 'back-plank'; break;
          case 'back-plank': next = 'down'; break;
          case 'down': next = 'back-deck'; break;
          default: {
            // Down the hatch: a load taken aboard goes below with them.
            if (s.item) {
              s.item.release();
              s.item = null;
            }
            next = 'below';
          }
        }
        s.leg = next;
        s.t = 0;
        const [a, b] = ends[next];
        s.len = next === 'hatch' ? 0.6 * PACE : next === 'drop' ? 0.5 * PACE : next === 'below' ? 1 : Math.max(0.05, dist(a, b));
      }
      // Called aboard: anyone on the way out turns back now, keeping what they carry.
      if (!working && (s.leg === 'quay' || s.leg === 'plank' || s.leg === 'deck' || s.leg === 'up')) {
        if (s.spot >= 0) this.claimed.delete(s.spot);
        const back: Record<string, Leg> = { quay: 'back-quay', plank: 'back-plank', up: 'down', deck: 'back-deck' };
        s.leg = back[s.leg]!;
        s.t = 1 - s.t;
      }
      if (s.leg === 'below') return this.hide(s);
      const [a, b] = ends[s.leg];
      const still = s.leg === 'hatch' || s.leg === 'drop';
      const step = (dt * PACE * (s.item ? 0.85 : 1)) / s.len;
      s.t = Math.min(1, s.t + (still ? dt / s.len : step));
      const x = a[0] + (b[0] - a[0]) * s.t, y = a[1] + (b[1] - a[1]) * s.t, z = a[2] + (b[2] - a[2]) * s.t;
      if (!still) s.stride += (dt * PACE) / (PERSON.height * 2.4);
      const heading = still ? Math.atan2(b[0] - foot[0], b[2] - foot[2]) : Math.atan2(b[0] - a[0], b[2] - a[2]);
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
    // Carried in front at the chest; the same size it is on the quay (nothing changes size in view).
    if (s.item) s.item.setMatrix(place(x + Math.sin(heading) * 0.12, y + 0.16, z + Math.cos(heading) * 0.12, heading));
  }

  /** Releases the sailors. Anything still in their arms is put down on the pile (or taken aboard if there is no room). */
  release(): void {
    for (const s of this.sailors) {
      for (const h of s.pieces) h.release();
      if (s.item) {
        const free = this.pile.items.findIndex((it) => !it);
        if (!s.loading && free >= 0 && s.leg !== 'below' && s.leg !== 'hatch' && s.leg !== 'deck' && s.leg !== 'back-deck') {
          const sp = this.pile.spots[free]!;
          s.item.setMatrix(place(sp.x, sp.y, sp.z, sp.yaw));
          this.pile.items[free] = s.item;
        } else s.item.release();
        s.item = null;
      }
    }
    this.sailors = [];
  }
}
