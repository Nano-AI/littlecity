// A raid (design section 13b, the owner's barbarians): a longship of raiders
// comes out of the sea, the band storms ashore, sets fires, loots, and sails
// off with the town half alight, unless the player stops them.
//
// THE BEATS
//   sighted    the sail comes in over the edge of the map; a horn from the
//              ship; the bell rings in the town; somebody on the shore points
//   landing    a landing raid: the longship spins about off the beach under
//              oars and rows straight in, bow up onto the sand, and the band
//              jumps over the sides and wades ashore; a boats raid: the big
//              ship heaves to offshore and its boats row to their landings
//   ashore     a charge up the beach with a war cry; then the brands go to the
//              thatch and the timber, the axes and clubs kick in doors and come
//              out with sacks, chests, a ham, a pig; the loot piles up by the
//              boats. The town runs: indoors, away down the streets
//   recall     the chief blows his horn; they run back, take up the pile and
//              wade out to the ships
//   away       the ships back off, spin about and sail away, cut off at the
//              map's edge, the town alight behind them
//
// STOPPING THEM. The player's bombs, the nuke and lightning hit the ships as
// they hit any ship: scorched (the sail torn: it sails on), burning or broken
// (it goes down). A ship that goes down cannot carry the band: raiders still
// aboard swim off out to sea; raiders ashore are stranded, lose heart, are
// chased into the sea by the townspeople and swim away over the edge of the
// map, horns bobbing. A raid whose ship goes down before it lands never
// happens. The boats can be sunk one by one.
//
// WHO DRAWS WHAT. At sea the raid draws its raiders itself (figure.ts);
// ashore they are people of the crowd (ordinary walkers with the `raider`
// mark and a barbarian costume), sent about by the raid's chain on the
// board (chain.ts), so everything that moves people (a blast, the Hand)
// moves them as it does anybody. Everything the raid draws goes through an
// owned stage (mischief/owned.ts).
//
// UNDO AND SAFETY. A raid holds the mischief director's act open from the
// first sight of the sail to the last of it: one undo puts back every
// building it burnt, and undo while it is on ends it at once. A new town, a
// town opened, or growing one ends it with nothing left drawn or pending.
// Nothing of it is saved: its fires are ordinary saved damage that mends.

import { DIR4, key, keyX, keyY, keyZ, SEA_Y, type CellKey } from '@/core/grid';
import { rand } from '@/core/rand';
import type { Barbarian } from '@/parts/people/barbarian';
import type { Load } from '@/parts/people/loads';
import type { StructureId } from '@/resolve/plan';
import { pathAt } from '@/rules/life/ship-routes';
import { RAID } from '@/style/raid';
import { PEOPLE } from '@/style/people';
import type { LifeStage, TimeSignal } from '../api';
import type { Person } from '../people/crowd';
import type { Board, Chain, Plan, PlanStep, Spot } from '../town/board';
import { DIR_HEADING } from '../town/board';
import { reaches } from '../town/hands';
import { scenesOf, type Scene } from '../town/scenes';
import type { Director } from '../mischief/director';
import { standsOf } from '../mischief/response';
import { angleDelta, clamp01, easeInOut } from '../motion/ease';
import { Figure, rowing } from './figure';
import type { Landing, RaidKind, RaidSite } from './site';
import { Vessel } from './vessel';
import type { Owned } from '../mischief/owned';

export type Beat = 'sighted' | 'landing' | 'ashore' | 'recall' | 'away' | 'done';

export type RaidSound =
  | { type: 'horn'; x: number; z: number; long: boolean }
  | { type: 'cry'; x: number; z: number }
  | { type: 'bell'; x: number; z: number }
  | { type: 'splash'; x: number; z: number }
  | { type: 'crash'; x: number; z: number };

/** What a raider is for. */
export type Role = 'chief' | 'brand' | 'axe' | 'club';

/** Where a raider is. */
export type Where = 'aboard' | 'jump' | 'wade-in' | 'ashore' | 'wade-out' | 'climb' | 'swim' | 'home' | 'lost';

export interface Raider {
  readonly i: number;
  readonly costume: Barbarian;
  readonly look: number;
  readonly role: Role;
  /** The vessel they came in and go back in (0 the ship, 1… the boats), and their seat in it. */
  vessel: number;
  seat: number;
  /** Their landing (an index into the site's landings). */
  landing: number;
  where: Where;
  /** At sea: their drawing. Ashore: their person in the crowd. */
  fig: Figure | null;
  person: Person | null;
  /** The sea leg under way: from, to, seconds in, how long. */
  t: number;
  dur: number;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  /** What they carry back aboard. */
  carry: Load | null;
  /** Loot trips made, fires set. */
  trips: number;
  fires: number;
  /** The building they are seeing to now. */
  target: StructureId | null;
  /** Seconds until their next war cry is shown, and how long one shows. */
  cryIn: number;
  cry: number;
  /** Stranded and chased: running for the sea. */
  routed: boolean;
  /** The step they were last seen on, and for how long (a walk that gets nowhere is given up). */
  step: unknown;
  stepFor: number;
}

/** A building a raider sets alight or loots. */
interface Target {
  structure: StructureId;
  cell: CellKey;
  role: string;
  /** Taken by a raider now / done. */
  by: Raider | null;
  done: boolean;
}

const LOOT_BY_ROLE: Record<string, readonly Load[]> = {
  warehouse: ['barrel', 'sack', 'chest', 'crate', 'cloth'],
  shop: ['cloth', 'cheese', 'candlestick', 'ham', 'sack'],
  'bridge-shop': ['cloth', 'cheese', 'candlestick'],
  inn: ['barrel', 'ham', 'cheese'],
  chapel: ['candlestick', 'chest'],
  'town-hall': ['chest', 'candlestick'],
  manor: ['chest', 'candlestick', 'cloth'],
  barn: ['pig', 'hen', 'sack'],
  'mill-house': ['sack', 'sack', 'hen'],
  smithy: ['chest', 'crate'],
  'market-stall': ['cheese', 'ham', 'cloth', 'basket'],
  'fish-stall': ['fish', 'fishes'],
  'flower-stall': ['basket', 'bouquet'],
};
const LOOT_HOME: readonly Load[] = ['sack', 'ham', 'hen', 'cheese', 'pig', 'chest', 'barrel', 'candlestick', 'cloth'];

const facing = (from: { x: number; z: number }, to: { x: number; z: number }): number => Math.atan2(to.x - from.x, to.z - from.z);

export interface RaidHost {
  /** Draws through this (owned: everything goes back at once). */
  own: Owned;
  stage: LifeStage;
  director: Director;
  sound(s: RaidSound): void;
}

let raidCount = 0;

export class Raid {
  readonly n: number;
  readonly kind: RaidKind;
  beat: Beat = 'sighted';
  /** Seconds in this beat, and since the raid began. */
  t = 0;
  age = 0;
  readonly ship: Vessel;
  readonly boats: Vessel[] = [];
  readonly raiders: Raider[] = [];
  /** The ship's place on its way: 'arrive' along the way in, 'spin' about, 'in' to the beach, 'beached', 'out' astern, 'spin-out', 'leave', 'gone'; a boats raid's ship 'hove' to. */
  shipState: 'arrive' | 'spin' | 'in' | 'beached' | 'hove' | 'out' | 'spin-out' | 'leave' | 'gone' | 'sunk' = 'arrive';
  private s = 0;
  /** Each boat: 'tow', 'row-in', 'wait' (on the shore), 'row-out', 'towed' (back on its line), 'sunk'. */
  readonly boatState: ('tow' | 'row-in' | 'wait' | 'row-out' | 'towed' | 'sunk')[] = [];
  private boatS: number[] = [];
  /** The ship can no longer carry the band (gone down, or burning). */
  stranded = false;
  /** Raiders ashore lose heart once stranded (after RAID.strandedWait). */
  private heartless = false;
  /** Seconds the town has known (for the bell, the watcher). */
  private rung = false;
  private crewFigs: Figure[] = [];
  /** The loot pile at each landing (a board store), by key. */
  readonly piles: { key: string; spots: Spot[] }[] = [];
  private burnTargets: Target[] = [];
  private lootTargets: Target[] = [];
  readonly burnWant: number;
  burnt = 0;
  /** Villagers the raid has sent running, and when they may be sent again. */
  private fled = new Map<Person, number>();
  private fleeLook = 0;
  /** People we took off the crowd ourselves (boarding): not "lost". */
  private boarded = new WeakSet<Person>();
  /** The note and the register. */
  scene: Scene | null = null;
  /** Something the system draws over a raider: a war cry. */
  ended = false;
  private exitAt = 0;
  private pointed = false;

  constructor(private host: RaidHost, readonly site: RaidSite, readonly seed: number, buildings: number) {
    this.n = ++raidCount;
    this.kind = site.kind;
    const stage = host.own.stage;
    this.ship = new Vessel(stage, 'ship', site.size, seed % 5, rand(seed, 'raid-phase'));
    const start = pathAt(site.voyage.arrive, 0);
    this.ship.x = start.x;
    this.ship.z = start.z;
    this.ship.yaw = start.yaw;
    this.ship.sail = 1;
    this.ship.rowing = 0.6;
    // The band, scaled to the town.
    const want = Math.round(Math.max(RAID.bandMin, Math.min(RAID.bandMax, RAID.bandMin + buildings / RAID.perBuildings)));
    if (this.kind === 'boats') {
      const nb = site.landings.length;
      for (let b = 0; b < nb; b++) {
        const v = new Vessel(stage, 'boat', 1, (seed + b) % 5, rand(seed, 'boat-phase', b));
        this.boats.push(v);
        this.boatState.push('tow');
        this.boatS.push(0);
      }
      this.towBoats(true);
    }
    const seatsPer = this.kind === 'boats' ? Math.min(7, this.boats[0]!.seats.length) : this.ship.seats.length;
    const band = Math.min(want, this.kind === 'boats' ? seatsPer * this.boats.length : this.ship.seats.length);
    for (let i = 0; i < band; i++) {
      const chief = i === 0;
      const v = chief ? 'chief' : (`raider-${(i - 1 + (seed % 8)) % 8}` as Barbarian);
      const role: Role = chief ? 'chief' : (i - 1 + (seed % 8)) % 3 === 0 ? 'brand' : (i - 1 + (seed % 8)) % 3 === 1 ? 'axe' : 'club';
      const vessel = this.kind === 'boats' ? 1 + (i % this.boats.length) : 0;
      const seat = this.kind === 'boats' ? Math.floor(i / this.boats.length) : i;
      const landing = this.kind === 'boats' ? vessel - 1 : 0;
      this.raiders.push({
        i, costume: v, look: Math.floor(rand(seed, 'raider-look', i) * 1e6), role, vessel, seat, landing,
        where: 'aboard', fig: null, person: null, t: 0, dur: 0, from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 },
        carry: null, trips: 0, fires: 0, target: null, cryIn: 1 + rand(seed, 'cry-in', i) * 4, cry: 0, routed: false, step: null, stepFor: 0,
      });
    }
    for (const r of this.raiders) r.fig = new Figure(stage, r.look, r.costume, `raid${this.n}-r${r.i}`);
    // A boats raid's ship keeps two hands aboard: a steersman and a lookout.
    if (this.kind === 'boats') for (let k = 0; k < 2; k++) this.crewFigs.push(new Figure(stage, Math.floor(rand(seed, 'crew', k) * 1e6), `raider-${(k * 3 + 1) % 8}` as Barbarian, `raid${this.n}-crew${k}`));
    // Piles of loot at each landing, a step up the shore.
    site.landings.forEach((l, i) => this.piles.push({ key: `raid${this.n}:pile${i}`, spots: pileSpots(l) }));
    this.burnWant = Math.round(Math.max(RAID.burnMin, Math.min(RAID.burnMax, buildings * RAID.burnShare)));
  }

  // ───────────────────────────────────────────────────────── the sea ──

  /** The vessel a raider belongs to. */
  vesselOf(r: Raider): Vessel {
    return r.vessel === 0 ? this.ship : this.boats[r.vessel - 1]!;
  }

  /** Every frame: the ships, and the raiders at sea. */
  stepSea(dt: number, seconds: number, wind: number): void {
    if (this.ended || this.beat === 'done') return;
    this.t += dt;
    this.age += dt;
    this.moveShip(dt);
    this.moveBoats(dt);
    this.stepFigures(dt, seconds);
    this.ship.stroke = (this.ship.stroke + dt * 0.55 * (this.ship.rowing > 0.05 ? 1 : 0)) % 1;
    for (const b of this.boats) b.stroke = (b.stroke + dt * 0.75 * (b.rowing > 0.05 ? 1 : 0)) % 1;
    this.ship.draw(seconds, wind);
    for (const b of this.boats) b.draw(seconds, wind);
    this.stepDamage(dt);
    // The beats that turn at sea.
    if (this.beat === 'sighted' && !this.rung && this.age > 6) {
      this.rung = true;
      const h = this.site.landings[0]!;
      this.host.sound({ type: 'bell', x: h.x, z: h.z });
    }
    if (this.beat === 'away' && this.shipState === 'gone' && this.boats.every((b, i) => this.boatState[i] === 'sunk' || this.boatState[i] === 'towed')) this.finishSoon();
    // Everybody back aboard or gone: a sunk ship's raid is over; a ship still afloat (its boats sunk, its band swum off) sails away.
    if (this.raiders.every((r) => r.where === 'lost' || r.where === 'home') && this.beat !== 'sighted') {
      if (this.shipState === 'sunk') this.finishSoon();
      else if (this.shipState === 'hove' || this.shipState === 'beached') this.shipLeaves();
    }
    if (this.exitAt > 0 && this.age >= this.exitAt) this.beat = 'done';
  }

  private finishSoon(): void {
    if (this.exitAt === 0) this.exitAt = this.age + 0.5;
  }

  private moveShip(dt: number): void {
    const v = this.ship, site = this.site;
    const turn = site.voyage.turn;
    switch (this.shipState) {
      case 'arrive': {
        const p = site.voyage.arrive;
        const left = p.length - this.s;
        // Slowing over the last few cells, the sail coming in, the oars taking over.
        const speed = RAID.sail * (0.35 + 0.65 * clamp01(left / 6));
        this.s = Math.min(p.length, this.s + speed * dt);
        const q = pathAt(p, this.s);
        v.x = q.x;
        v.z = q.z;
        v.yaw = q.yaw;
        v.sail = this.kind === 'boats' ? Math.max(0.6, clamp01((left - 0.8) / 2.5)) : clamp01((left - 0.8) / 2.5);
        v.rowing = 0.5 + 0.5 * clamp01(1 - left / 6);
        if (this.s >= p.length) {
          if (this.kind === 'landing') this.shipState = 'spin';
          else {
            this.shipState = 'hove';
            this.setBeat('landing');
            for (let i = 0; i < this.boats.length; i++) if (this.boatState[i] === 'tow') this.castOff(i);
          }
        }
        break;
      }
      case 'spin': {
        const want = site.beached!.yaw;
        const d = angleDelta(v.yaw, want);
        const step = RAID.spin * dt;
        v.yaw += Math.abs(d) <= step ? d : Math.sign(d) * step;
        v.sail = 0;
        v.rowing = 1;
        if (Math.abs(d) <= step) {
          this.shipState = 'in';
          this.s = 0;
          this.setBeat('landing');
        }
        break;
      }
      case 'in': {
        const b = site.beached!;
        const len = Math.hypot(b.x - turn.x, b.z - turn.z);
        const left = len - this.s;
        this.s = Math.min(len, this.s + RAID.row * (0.45 + 0.55 * clamp01(left / 1.5)) * dt);
        const u = len > 0 ? this.s / len : 1;
        v.x = turn.x + (b.x - turn.x) * u;
        v.z = turn.z + (b.z - turn.z) * u;
        v.yaw = b.yaw;
        v.rowing = 1;
        // The last of the way the bow runs up the sand.
        v.beach = clamp01(1 - left / 0.9);
        if (this.s >= len) {
          this.shipState = 'beached';
          v.rowing = 0;
          v.beach = 1;
          this.host.sound({ type: 'crash', x: b.x, z: b.z });
          this.disembark(0);
        }
        break;
      }
      case 'beached':
        v.rowing = 0;
        break;
      case 'hove':
        // Hove to, its striped sail half-brailed: still the first thing anybody sees out there.
        v.rowing = 0.15;
        v.sail += (0.6 - v.sail) * Math.min(1, dt);
        break;
      case 'out': {
        const b = site.beached!;
        const len = Math.hypot(b.x - turn.x, b.z - turn.z);
        this.s = Math.min(len, this.s + RAID.row * 0.85 * dt);
        const u = len > 0 ? this.s / len : 1;
        v.x = b.x + (turn.x - b.x) * u;
        v.z = b.z + (turn.z - b.z) * u;
        v.astern = true;
        v.rowing = 1;
        v.beach = clamp01(1 - this.s / 0.9);
        if (this.s >= len) {
          v.astern = false;
          this.shipState = 'spin-out';
        }
        break;
      }
      case 'spin-out': {
        const want = pathAt(site.voyage.leave, 0.6).yaw;
        const d = angleDelta(v.yaw, want);
        const step = RAID.spin * dt;
        v.yaw += Math.abs(d) <= step ? d : Math.sign(d) * step;
        v.rowing = 1;
        v.sail = 0;
        if (Math.abs(d) <= step) {
          this.shipState = 'leave';
          this.s = 0;
        }
        break;
      }
      case 'leave': {
        const p = site.voyage.leave;
        this.s = Math.min(p.length, this.s + RAID.sail * clamp01(0.4 + this.s / 4) * (v.hurt >= 1 ? 0.6 : 1) * dt);
        const q = pathAt(p, this.s);
        v.x = q.x;
        v.z = q.z;
        v.yaw = q.yaw;
        v.sail = clamp01(this.s / 3);
        v.rowing = 1 - 0.5 * clamp01(this.s / 5);
        if (this.s >= p.length) this.shipState = 'gone';
        break;
      }
      case 'gone':
      case 'sunk':
        break;
    }
  }

  /** The boats' lines: each follows the one ahead on a rope (the first the ship's stern). */
  private towBoats(init = false): void {
    const v = this.ship;
    const sx = Math.sin(v.yaw), cz = Math.cos(v.yaw);
    let lx = v.x + sx * v.hull.stern, lz = v.z + cz * v.hull.stern;
    let ldx = -sx, ldz = -cz;
    this.boats.forEach((b, i) => {
      const st = this.boatState[i];
      if (st !== 'tow' && st !== 'towed') return;
      const rope = 0.7 - b.hull.stern;
      if (init) {
        b.x = lx + ldx * (rope + b.hull.bow);
        b.z = lz + ldz * (rope + b.hull.bow);
      }
      // The bow follows on its rope.
      let dx = b.x + Math.sin(b.yaw) * b.hull.bow - lx, dz = b.z + Math.cos(b.yaw) * b.hull.bow - lz;
      let d = Math.hypot(dx, dz);
      if (d < 1e-6) {
        dx = ldx;
        dz = ldz;
        d = 1;
      }
      const bx = lx + (dx / d) * Math.min(d, rope), bz = lz + (dz / d) * Math.min(d, rope);
      const yaw = Math.atan2(lx - bx, lz - bz);
      b.yaw = init ? Math.atan2(-ldx, -ldz) : yaw;
      b.x = bx - Math.sin(b.yaw) * b.hull.bow;
      b.z = bz - Math.cos(b.yaw) * b.hull.bow;
      b.rowing = 0;
      lx = b.x + Math.sin(b.yaw) * b.hull.stern;
      lz = b.z + Math.cos(b.yaw) * b.hull.stern;
      ldx = -Math.sin(b.yaw);
      ldz = -Math.cos(b.yaw);
    });
  }

  private castOff(i: number): void {
    this.boatState[i] = 'row-in';
    this.boatS[i] = 0;
  }

  private moveBoats(dt: number): void {
    this.towBoats();
    this.boats.forEach((b, i) => {
      const st = this.boatState[i];
      const path = this.site.boatPaths[i]!;
      if (st === 'row-in') {
        // From where it lies to the start of its way, then along it.
        const left = path.length - this.boatS[i]!;
        this.boatS[i] = Math.min(path.length, this.boatS[i]! + RAID.boatRow * (0.4 + 0.6 * clamp01(left / 1.5)) * dt);
        const q = pathAt(path, this.boatS[i]!);
        // Ease from the tow onto the way over its first stretch.
        const k = clamp01(this.boatS[i]! / 2);
        b.x += (q.x - b.x) * Math.min(1, dt * 3 + k);
        b.z += (q.z - b.z) * Math.min(1, dt * 3 + k);
        b.yaw += angleDelta(b.yaw, q.yaw) * Math.min(1, dt * 4);
        b.rowing = 1;
        b.beach = clamp01(1 - left / 0.5) * 0.5;
        if (this.boatS[i]! >= path.length) {
          this.boatState[i] = 'wait';
          b.rowing = 0;
          this.disembark(i + 1);
        }
      } else if (st === 'row-out') {
        this.boatS[i] = Math.max(0, this.boatS[i]! - RAID.boatRow * dt);
        const q = pathAt(path, this.boatS[i]!);
        b.x = q.x;
        b.z = q.z;
        // Going back out bow first: turned about over the first stretch.
        b.yaw += angleDelta(b.yaw, q.yaw + Math.PI) * Math.min(1, dt * 2.5);
        b.rowing = 1;
        b.beach = 0;
        if (this.boatS[i]! <= 0) {
          this.boatState[i] = 'towed';
          if (this.boatState.every((s) => s === 'towed' || s === 'sunk')) this.shipLeaves();
        }
      }
    });
  }

  /** All aboard (or as many as there are): the ship backs off, spins and goes. */
  private shipLeaves(): void {
    if (this.shipState === 'beached') {
      this.shipState = 'out';
      this.s = 0;
    } else if (this.shipState === 'hove') this.shipState = 'spin-out';
    this.setBeat('away');
  }

  // ───────────────────────────────────────────────── raiders at sea ──

  /** The band (or one boat's crew) goes over the side, one or two at a time. */
  private disembark(vessel: number): void {
    const list = this.raiders.filter((r) => r.vessel === vessel && r.where === 'aboard');
    // The chief first, from the prow.
    list.sort((a, b) => (a.role === 'chief' ? -1 : b.role === 'chief' ? 1 : a.seat - b.seat));
    list.forEach((r, k) => {
      r.where = 'jump';
      r.t = -k * 0.32;
    });
    if (this.beat === 'landing' || this.beat === 'sighted') this.setBeat('ashore');
  }

  /** Where on the shore a raider stands up out of the water: their landing's edge, spread along it. */
  private shorePoint(r: Raider): { x: number; y: number; z: number } {
    const l = this.shoreOf(r);
    const spread = ((r.i * 0.37) % 1) - 0.5;
    return { x: l.x + l.ox * 0.25 - l.oz * spread * 0.6, y: l.y, z: l.z + l.oz * 0.25 + l.ox * spread * 0.6 };
  }

  /** The shore cell a raider comes ashore at and goes back from: their landing, or one beside it (the band spreads out). */
  shoreOf(r: Raider): Landing {
    const l = this.site.landings[r.landing]!;
    const near = l.near.length > 0 ? l.near : [l];
    return near[(r.i * 5) % near.length]!;
  }

  private stepFigures(dt: number, seconds: number): void {
    for (const r of this.raiders) {
      const fig = r.fig;
      if (!fig) continue;
      const v = this.vesselOf(r);
      switch (r.where) {
        case 'aboard':
        case 'home': {
          if (v.hurt >= 3 && v.sink > 0.15) {
            // Going down: over the side and swim for it.
            this.goSwim(r);
            break;
          }
          const s = v.seatAt(r.seat);
          const seat = v.seats[r.seat % v.seats.length]!;
          const rower = seat.sit && v.rowing > 0.05;
          fig.pose(s.x, s.y, s.z, s.heading, seat.sit ? 'sit' : r.role === 'chief' && this.beat === 'sighted' ? 'cheer' : 'stand', seconds, {
            seat: seat.sit ? 0.12 : -1,
            gear: !rower,
            ...(rower ? { tweak: rowing(v.astern ? 1 - v.stroke : v.stroke) } : {}),
          });
          fig.setCut(v.edgeCut);
          break;
        }
        case 'jump': {
          r.t += dt;
          if (r.t < 0) {
            const s = v.seatAt(r.seat);
            fig.pose(s.x, s.y, s.z, s.heading, 'stand', seconds);
            break;
          }
          if (r.dur === 0) {
            // From the seat, over the side near the bow, into the shallows.
            const s = v.seatAt(r.seat);
            const side = r.i % 2 ? 1 : -1;
            const along = this.kind === 'landing' ? v.hull.bow * 0.45 - (r.i % 4) * 0.25 : 0;
            const w = v.beside(along, side, 0.25);
            r.from = { x: s.x, y: s.y, z: s.z };
            r.to = { x: w.x, y: SEA_Y - 0.14, z: w.z };
            r.dur = 0.55;
          }
          const u = clamp01(r.t / r.dur);
          const x = r.from.x + (r.to.x - r.from.x) * u, z = r.from.z + (r.to.z - r.from.z) * u;
          const y = r.from.y + (r.to.y - r.from.y) * u + Math.sin(u * Math.PI) * 0.35;
          fig.pose(x, y, z, facing(r.from, r.to), 'hop', r.t);
          if (u >= 1) {
            this.host.sound({ type: 'splash', x, z });
            r.where = 'wade-in';
            r.t = 0;
            r.from = { ...r.to };
            r.to = this.shorePoint(r);
            r.dur = Math.max(0.6, Math.hypot(r.to.x - r.from.x, r.to.z - r.from.z) / 1.1);
          }
          break;
        }
        case 'wade-in': {
          r.t += dt;
          const u = clamp01(r.t / r.dur);
          const x = r.from.x + (r.to.x - r.from.x) * u, z = r.from.z + (r.to.z - r.from.z) * u;
          // Waist-deep, then up out of the water onto the shore.
          const y = r.from.y + (r.to.y - r.from.y) * easeInOut(clamp01((u - 0.55) / 0.45));
          fig.pose(x, y, z, facing(r.from, r.to), 'run', r.t * 1.4);
          if (u >= 1) r.where = 'ashore'; // the chain hands them to the crowd (it holds the board)
          break;
        }
        case 'wade-out': {
          r.t += dt;
          // Back to where the vessel is now (it may have moved a little).
          const w = this.boardingPoint(r);
          r.to = { x: w.x, y: SEA_Y - 0.14, z: w.z };
          const u = clamp01(r.t / r.dur);
          const x = r.from.x + (r.to.x - r.from.x) * u, z = r.from.z + (r.to.z - r.from.z) * u;
          const y = r.from.y + (r.to.y - r.from.y) * easeInOut(clamp01(u / 0.45));
          fig.pose(x, y, z, facing(r.from, r.to), 'walk', r.t * 1.2, { load: r.carry });
          if (u >= 1) {
            r.where = 'climb';
            r.t = 0;
            r.from = { x, y, z };
            r.dur = 0.5;
          }
          break;
        }
        case 'climb': {
          r.t += dt;
          const s = v.seatAt(r.seat);
          const u = clamp01(r.t / r.dur);
          const x = r.from.x + (s.x - r.from.x) * u, z = r.from.z + (s.z - r.from.z) * u;
          const y = r.from.y + (s.y - r.from.y) * u + Math.sin(u * Math.PI) * 0.25;
          fig.pose(x, y, z, facing(r.from, s), 'hop', r.t, { load: r.carry });
          if (u >= 1) {
            r.where = 'home';
            if (r.carry) v.heap++;
            r.carry = null;
            this.checkAllAboard(r.vessel);
          }
          break;
        }
        case 'swim': {
          r.t += dt;
          const u = r.dur > 0 ? clamp01(r.t / r.dur) : 1;
          const x = r.from.x + (r.to.x - r.from.x) * u, z = r.from.z + (r.to.z - r.from.z) * u;
          // Horns bobbing over the waves, arms going.
          const bob = Math.sin(seconds * 3 + r.i) * 0.02;
          fig.pose(x, SEA_Y - 0.3 + bob, z, facing(r.from, r.to), 'splash', r.t, { tilt: 1.05, gear: false, tweak: (p) => {
            const k = Math.sin(r.t * 5 + r.i);
            p.armL = 2.4 + 0.9 * k;
            p.armR = 2.4 - 0.9 * k;
            p.outL = p.outR = 0.25;
          } });
          fig.setCut(x < 0.5 || z < 0.5 || x > 47.5 || z > 47.5 || u > 0.97);
          if (u >= 1) {
            r.where = 'lost';
            fig.setVisible(false);
          }
          break;
        }
        case 'ashore':
        case 'lost':
          break;
      }
    }
    // A boats raid's ship keeps its two hands aboard.
    this.crewFigs.forEach((f, k) => {
      const v = this.ship;
      if (v.hurt >= 3 && v.sink > 0.5) {
        f.setVisible(false);
        return;
      }
      const s = v.seatAt(k === 0 ? v.seats.length - 1 : 0);
      f.pose(s.x, s.y, s.z, s.heading, k === 1 && this.beat !== 'away' ? 'wave' : 'stand', seconds, { gear: k === 1 });
      f.setCut(v.edgeCut);
    });
  }

  /** Where a raider wading out climbs aboard: beside their vessel, its nearest point. */
  private boardingPoint(r: Raider): { x: number; z: number } {
    const v = this.vesselOf(r);
    const l = this.site.landings[r.landing]!;
    const along = v.kind === 'ship' ? v.hull.bow * 0.45 - (r.i % 4) * 0.25 : 0.2;
    // The side nearer the shore point's lateral spread.
    const side = r.i % 2 ? 1 : -1;
    const w = v.beside(along, side, v.kind === 'ship' ? 0.2 : 0.15);
    void l;
    return w;
  }

  private goSwim(r: Raider): void {
    if (!r.fig) return;
    const v = this.vesselOf(r);
    const s = v.seatAt(r.seat);
    r.where = 'swim';
    r.t = 0;
    r.from = { x: s.x, y: SEA_Y, z: s.z };
    const out = this.wayOut(s.x, s.z);
    r.to = { x: out.x, y: SEA_Y, z: out.z };
    r.dur = Math.hypot(out.x - s.x, out.z - s.z) / 0.55;
    this.host.sound({ type: 'splash', x: s.x, z: s.z });
  }

  /** Off the edge of the map the shortest way over open water from (x, z): a point just beyond it. */
  private wayOut(x: number, z: number): { x: number; z: number } {
    const field = this.field;
    const dirs: [number, number][] = [];
    for (let k = 0; k < 16; k++) dirs.push([Math.cos((k / 16) * Math.PI * 2), Math.sin((k / 16) * Math.PI * 2)]);
    let best: { x: number; z: number; d: number } | null = null;
    for (const [dx, dz] of dirs) {
      for (let t = 0.5; t < 70; t += 0.5) {
        const px = x + dx * t, pz = z + dz * t;
        if (px < -1 || pz < -1 || px > 49 || pz > 49) {
          if (!best || t < best.d) best = { x: px, z: pz, d: t };
          break;
        }
        if (field && field(px, pz) < 0.15) break;
      }
    }
    return best ?? { x: x < 24 ? -1.5 : 49.5, z };
  }

  /** The clear water (distance to anything solid) at a point: set by the system from the site's field. */
  field: ((x: number, z: number) => number) | null = null;

  /** A raider has come back aboard: when the vessel's raiders are all in, it goes. */
  private checkAllAboard(vessel: number): void {
    const mine = this.raiders.filter((r) => r.vessel === vessel);
    if (mine.some((r) => r.where !== 'home' && r.where !== 'lost' && r.where !== 'swim' && !(r.routed && r.where === 'ashore'))) return;
    if (vessel === 0) {
      if (this.kind === 'landing') this.shipLeaves();
      return;
    }
    const i = vessel - 1;
    if (this.boatState[i] === 'wait') {
      this.boatState[i] = 'row-out';
      this.boatS[i] = this.site.boatPaths[i]!.length;
    }
  }

  // ─────────────────────────────────────────────────── stopping them ──

  /** Hits from the player's mischief (the system tells us): a blast at (x, z) of power `power`, or lightning. */
  hit(x: number, z: number, r3: number, r2: number, r1: number): void {
    const hitOne = (v: Vessel): 0 | 1 | 2 | 3 => {
      const sx = Math.sin(v.yaw), cz = Math.cos(v.yaw);
      const along = Math.max(v.hull.stern, Math.min(v.hull.bow, (x - v.x) * sx + (z - v.z) * cz));
      const d = Math.hypot(x - (v.x + sx * along), z - (v.z + cz * along)) - v.hull.halfBeam;
      return d < r3 ? 3 : d < r2 ? 2 : d < r1 ? 1 : 0;
    };
    const vs = [this.ship, ...this.boats];
    vs.forEach((v, k) => {
      if (k === 0 && (this.shipState === 'gone' || this.shipState === 'arrive' && v.edgeCut && this.s < 1)) return;
      if (k > 0 && this.boatState[k - 1] === 'sunk') return;
      const stage = hitOne(v);
      if (stage !== 0 && stage > v.hurt) this.hurt(v, stage);
    });
  }

  /** Lightning on a vessel: its sail catches, it burns and goes down. */
  strike(x: number, z: number): boolean {
    const vs = [this.ship, ...this.boats];
    for (const v of vs) {
      if (v.hurt >= 2) continue;
      const sx = Math.sin(v.yaw), cz = Math.cos(v.yaw);
      const along = Math.max(v.hull.stern, Math.min(v.hull.bow, (x - v.x) * sx + (z - v.z) * cz));
      if (Math.hypot(x - (v.x + sx * along), z - (v.z + cz * along)) - v.hull.halfBeam < 0.9) {
        this.hurt(v, 2);
        return true;
      }
    }
    return false;
  }

  /** The vessel the point is on, if any (the Lightning tool asks). */
  vesselAt(x: number, z: number): [number, number] | null {
    for (const v of [this.ship, ...this.boats]) {
      if (v.sink > 0.5) continue;
      const sx = Math.sin(v.yaw), cz = Math.cos(v.yaw);
      const along = Math.max(v.hull.stern, Math.min(v.hull.bow, (x - v.x) * sx + (z - v.z) * cz));
      const cx = v.x + sx * along, cz2 = v.z + cz * along;
      if (Math.hypot(x - cx, z - cz2) - v.hull.halfBeam < 0.6) return [cx, cz2];
    }
    return null;
  }

  /** Flames on a vessel now: where, and how fierce (the system draws them). */
  readonly fires: { v: Vessel; along: number; side: number }[] = [];

  private hurt(v: Vessel, stage: 1 | 2 | 3): void {
    v.hurt = stage;
    v.loseSail();
    v.list = rand(this.seed, 'list', v.x) < 0.5 ? -1 : 1;
    if (stage >= 2) for (let k = 0; k < 3; k++) this.fires.push({ v, along: v.hull.stern + (v.hull.bow - v.hull.stern) * (0.25 + 0.25 * k), side: (k % 2) * 2 - 1 });
    if (stage === 1) return;
    const i = this.boats.indexOf(v);
    if (i >= 0) {
      this.boatState[i] = 'sunk';
      return;
    }
    // The ship: it cannot carry the band now.
    this.stranded = true;
    if (this.shipState === 'arrive' || this.shipState === 'spin' || this.shipState === 'in') {
      // Before it lands: the raid never happens. Everybody aboard swims off.
      this.setBeat('away');
    }
    this.shipState = v.hurt >= 3 ? 'sunk' : this.shipState;
  }

  private stepDamage(dt: number): void {
    for (const v of [this.ship, ...this.boats]) {
      if (v.hurt === 2) {
        v.burnt += dt;
        if (v.burnt > 7) v.hurt = 3;
      }
      if (v.hurt === 3) {
        v.sink = Math.min(1.2, v.sink + dt / 7);
        v.rowing = 0;
        v.sail = 0;
        if (v === this.ship) this.shipState = 'sunk';
      }
    }
    // A boat gone down: its crew swim off; those ashore who came in it go back by another boat if there is one.
    this.boats.forEach((b, i) => {
      if (this.boatState[i] !== 'sunk') return;
      for (const r of this.raiders) {
        if (r.vessel !== i + 1) continue;
        if ((r.where === 'aboard' || r.where === 'home') && b.sink > 0.15) this.goSwim(r);
        if (r.where === 'ashore' || r.where === 'wade-in' || r.where === 'jump') {
          const other = this.boatState.findIndex((s) => s !== 'sunk');
          if (other >= 0) {
            r.vessel = other + 1;
            r.landing = other;
            r.seat = this.freeSeat(other + 1);
          }
        }
      }
    });
    if (this.boats.length > 0 && this.boatState.every((s) => s === 'sunk')) this.stranded = true;
  }

  /** A free seat in a vessel (somebody moved over from a boat that went down). */
  private freeSeat(vessel: number): number {
    const v = vessel === 0 ? this.ship : this.boats[vessel - 1]!;
    const taken = new Set(this.raiders.filter((r) => r.vessel === vessel).map((r) => r.seat));
    for (let s = 0; s < v.seats.length * 2; s++) if (!taken.has(s)) return s;
    return 0;
  }

  // ───────────────────────────────────────────────────────── ashore ──

  private setBeat(b: Beat): void {
    if (this.beat === b) return;
    this.beat = b;
    this.t = 0;
  }

  /** The middle of the band ashore, or of the landings. */
  focus(): { x: number; y: number; z: number } {
    const ashore = this.raiders.filter((r) => r.person && r.person.visible);
    if (ashore.length > 0 && (this.beat === 'ashore' || this.beat === 'recall')) {
      let x = 0, z = 0, y = 0;
      for (const r of ashore) {
        x += r.person!.x;
        y += r.person!.y;
        z += r.person!.z;
      }
      return { x: x / ashore.length, y: y / ashore.length, z: z / ashore.length };
    }
    if (this.beat === 'sighted') return { x: this.ship.x, y: SEA_Y, z: this.ship.z };
    const l = this.site.landings[0]!;
    return { x: l.x, y: l.y, z: l.z };
  }

  /** Raiders ashore now, where they are (for the town's scenes to keep clear, and for the people to run from). */
  threats(): { x: number; z: number }[] {
    const out: { x: number; z: number }[] = [];
    for (const r of this.raiders) {
      if (r.where === 'ashore' && r.person && r.person.mode !== 'gone' && !r.routed) out.push({ x: r.person.x, z: r.person.z });
      else if (r.where === 'wade-in' || r.where === 'jump') out.push({ x: r.to.x, z: r.to.z });
    }
    return out;
  }

  /** The chain, every frame: raiders handed to the crowd, plans for them, the town running. */
  stepLand(dt: number, board: Board, time: TimeSignal, chainId: string, chain: Chain): void {
    if (this.ended) return;
    const crowd = board.crowd;
    // The register and its note.
    if (!this.scene) {
      this.scene = scenesOf(board).begin({
        kind: 'raid',
        title: this.kind === 'boats' ? 'Raiders off the coast! Boats are coming in.' : 'Raiders off the coast!',
        big: true,
        focus: () => this.focus(),
        noteworthy: () => true,
        gathering: () => this.beat !== 'done',
        urgent: true,
      });
    }
    // Sighted: the townspeople nearest the shore stop and point out to sea (one waving the alarm).
    if (this.beat === 'sighted' && !this.pointed && this.age > 4 && !this.ship.edgeCut) {
      this.pointed = true;
      const l = this.site.landings[0]!;
      const near = crowd.people
        .filter((p) => !p.raider && p.visible && (p.mode === 'walk' || p.mode === 'linger') && !p.scuffle && Math.hypot(p.x - l.x, p.z - l.z) < 16)
        .sort((a, b) => Math.hypot(a.x - l.x, a.z - l.z) - Math.hypot(b.x - l.x, b.z - l.z) || (a.id < b.id ? -1 : 1))
        .slice(0, 4);
      near.forEach((p, k) => {
        p.startled = 5 + k * 0.5;
        p.startledFace = Math.atan2(this.ship.x - p.x, this.ship.z - p.z);
        p.admire = k === 0 ? 'wave' : 'look';
      });
    }
    // Piles of loot at the landings: claimed again (a store not claimed at a sync is cleared away).
    for (const p of this.piles) board.store(p.key, p.spots);
    // Ashore: into the crowd.
    for (const r of this.raiders) {
      if (r.where === 'ashore' && !r.person && r.fig?.visible) {
        const s = this.shorePoint(r);
        const l = this.shoreOf(r);
        const p = crowd.ashore(s.x, s.y, s.z, Math.atan2(-l.ox, -l.oz), r.look) ?? crowd.ashore(l.x, l.y, l.z, Math.atan2(-l.ox, -l.oz), r.look);
        if (!p) continue;
        p.leaving = false;
        p.ashore = false;
        p.raider = true;
        p.costume = r.costume;
        p.timer = 0.15;
        (p as { speed: number }).speed = PEOPLE.speed * (r.role === 'chief' ? 1.35 : 1.55);
        board.claim(p, chain);
        r.person = p;
        r.fig!.setVisible(false);
        if (r.cry <= 0) r.cry = 1.6;
      }
      // Someone took their person off the crowd without us (a fresh crowd after an undo, a blast's swim): adopt or lose them.
      if (r.where === 'ashore' && r.person && r.person.mode === 'gone' && !this.boarded.has(r.person)) {
        const again = crowd.people.find((q) => q.raider && q.costume === r.costume && !this.raiders.some((o) => o.person === q));
        if (again) {
          r.person = again;
          board.claim(again, chain);
        } else {
          r.person = null;
          r.where = 'lost';
        }
      }
    }
    // A walk that gets nowhere (a knot in a lane, a way cut by the fire) is given up for another plan.
    for (const r of this.raiders) {
      const p = r.person;
      if (r.where !== 'ashore' || !p || p.mode !== 'walk') {
        r.stepFor = 0;
        continue;
      }
      const step = p.goal?.errand ?? null;
      if (step !== r.step) {
        r.step = step;
        r.stepFor = 0;
      }
      r.stepFor += dt;
      if (r.stepFor > 14 && step && step.tag !== 'raid:board' && step.tag !== 'raid:to-sea') {
        r.stepFor = 0;
        board.drop(p);
        board.crowd.rethink(p);
      }
    }
    // War cries over the raiders ashore, now and then (the system draws them; here the timing).
    for (const r of this.raiders) {
      if (r.cry > 0) r.cry -= dt;
      if (r.where !== 'ashore' || !r.person) continue;
      r.cryIn -= dt;
      if (r.cryIn <= 0 && !r.routed && (this.beat === 'ashore' || this.beat === 'recall')) {
        r.cry = 1.4;
        r.cryIn = 5 + rand(this.seed, 'cry', r.i, Math.floor(this.age)) * 9;
        this.host.sound({ type: 'cry', x: r.person.x, z: r.person.z });
      }
    }
    if (this.beat === 'ashore' || this.beat === 'recall' || this.beat === 'away') this.runTown(dt, board, time);
    if (this.beat === 'ashore') {
      if (this.lootTargets.length === 0 && this.burnTargets.length === 0) this.chooseTargets(board);
      const busy = this.raiders.some((r) => r.where === 'jump' || r.where === 'wade-in' || r.where === 'aboard' && this.boatState.includes('row-in'));
      const work = this.burnTargets.some((t) => !t.done) || this.lootTargets.some((t) => !t.done && this.raiders.some((r) => (r.role === 'axe' || r.role === 'club') && r.trips < RAID.trips));
      if (!busy && (this.t >= RAID.ashore || (this.t >= 35 && !work))) this.recall(board);
      if (this.stranded && !this.heartless && this.t > 0) this.loseHeart(board);
    }
    if (this.beat === 'recall' && this.stranded && !this.heartless) this.loseHeart(board);
    if (this.beat === 'recall' || this.beat === 'away') this.boardThose(board);
    // Never a stall: whoever is not back by the time the rest have waited long enough is left behind, and runs for the sea.
    if (this.beat === 'recall' && this.t > 40 && !this.heartless) this.leaveBehind(board);
    // Routed raiders at the water's edge go into the sea and swim off.
    for (const r of this.raiders) {
      if (!r.routed || r.where !== 'ashore' || !r.person) continue;
      const p = r.person;
      if (p.mode === 'linger' && p.goal?.errand?.tag === 'raid:to-sea') this.intoSea(r, board);
    }
    void chainId;
  }

  /** The town's people within reach of the band run: indoors, or away down the streets. */
  private runTown(dt: number, board: Board, time: TimeSignal): void {
    this.fleeLook -= dt;
    if (this.fleeLook > 0) return;
    this.fleeLook = 0.5;
    const nav = board.nav;
    if (!nav) return;
    const threats = this.threats();
    if (threats.length === 0) return;
    const near = (x: number, z: number): number => Math.min(...threats.map((t) => Math.hypot(t.x - x, t.z - z)));
    for (const p of board.crowd.people) {
      if (p.raider || !p.visible || p.mode === 'gone' || p.mode === 'home' || p.mode === 'visit' || (p.mode as string) === 'thrown' || p.scuffle || p.leaving || p.shutIn) continue;
      if ((this.fled.get(p) ?? -Infinity) > this.age) continue;
      if (p.mode === 'walk' && p.walk && p.walk[p.at]!.kind !== 'move') continue;
      const tag = p.goal?.errand?.tag ?? '';
      if (tag.startsWith('fire:') || tag.startsWith('flee:') || tag.startsWith('chase:')) continue;
      const d = near(p.x, p.z);
      if (d > RAID.flee) continue;
      this.fled.set(p, this.age + 12);
      // Home if home is not where the raiders are; else away from them.
      const home = board.homeStep(p, { tag: 'flee:home', brisk: true });
      const hc = home ? board.centre(home.cell) : null;
      if (home && hc && near(hc.x, hc.z) > 3 && reaches(board, p, home.cell) && board.dist(p.cell, home.cell) < 26) {
        board.assign(p, { chain: this.chainOf(board), at: 0, steps: [{ ...home, linger: 0 }] });
        continue;
      }
      // Away: the nearest cell of their part well clear of every raider.
      let best: CellKey | null = null, bestD = Infinity;
      const part = p.node >= 0 ? nav.part[p.node]! : -1;
      for (let n = 0; n < nav.nodes.length; n += 2) {
        if (nav.part[n] !== part) continue;
        const c = nav.nodes[n]!.cell;
        const cx = keyX(c) + 0.5, cz = keyZ(c) + 0.5;
        if (near(cx, cz) < RAID.flee + 3) continue;
        const dd = Math.abs(cx - p.x) + Math.abs(cz - p.z);
        if (dd < bestD) {
          bestD = dd;
          best = c;
        }
      }
      if (best === null) continue;
      const c = board.centre(best);
      const spot = { x: c.x + (rand(p.seed, 'flee', this.n) - 0.5) * 0.4, z: c.z + (rand(p.seed, 'flee-z', this.n) - 0.5) * 0.4 };
      const t = threats.reduce((a, b) => (Math.hypot(b.x - c.x, b.z - c.z) < Math.hypot(a.x - c.x, a.z - c.z) ? b : a));
      board.assign(p, { chain: this.chainOf(board), at: 0, steps: [board.stepAt(best, { spot, face: facing(spot, t), pose: p.child ? 'cover' : 'look', linger: 10 + rand(p.seed, 'flee-stay', this.n) * 8, brisk: true, tag: 'flee:away' })] });
    }
    void time;
  }

  private chainOf(board: Board): Chain {
    return board.chains.find((c) => c.id === 'raid') ?? board.chains[0]!;
  }

  /** What to burn and what to loot: the nearest buildings to the landings that will catch, and those with doors and goods. */
  private chooseTargets(board: Board): void {
    const shape = board.shape, nav = board.nav;
    if (!shape || !nav) return;
    const d = this.host.director;
    const landings = this.site.landings;
    const dist = (c: CellKey): number => Math.min(...landings.map((l) => Math.hypot(keyX(c) + 0.5 - l.x, keyZ(c) + 0.5 - l.z)));
    const seen = new Set<StructureId>();
    const burn: (Target & { d: number; heat: number })[] = [];
    const loot: (Target & { d: number })[] = [];
    for (const [sid, st] of shape.structures) {
      if (seen.has(sid)) continue;
      seen.add(sid);
      const kind = st.kind;
      if (kind !== 'house' && kind !== 'stall' && kind !== 'windmill') continue;
      const low = st.cells.reduce((a, b) => (keyY(b) < keyY(a) ? b : a));
      const dd = dist(low);
      if (dd > 16) continue;
      if (shape.world.blocks.get(low)?.ruin) continue;
      const role = shape.roles.get(sid)?.role ?? kind;
      if (standsOf(board, sid).length === 0) continue;
      if (!standsOf(board, sid).some((s) => landings.some((l) => nav.part[nav.nodeAt.get(s.cell) ?? -1] === nav.part[l.node]))) continue;
      const canBurn = d.engine.canLight(low);
      if (canBurn && role !== 'chapel') burn.push({ structure: sid, cell: low, role, by: null, done: false, d: dd, heat: kind === 'stall' ? 3 : kind === 'windmill' ? 2 : role === 'barn' || role === 'cottage' ? 1.5 : 1 });
      const doors = nav.doorsOf.get(sid) ?? [];
      const usable = doors.some((i) => nav.doors[i]!.node >= 0 && !nav.doors[i]!.hatch);
      if (usable || kind === 'stall') loot.push({ structure: sid, cell: low, role, by: null, done: false, d: dd });
    }
    burn.sort((a, b) => a.d / a.heat - b.d / b.heat || a.structure - b.structure);
    loot.sort((a, b) => (a.role === 'warehouse' || a.role === 'shop' || a.role === 'inn' || a.role.endsWith('stall') ? -4 : 0) + a.d - ((b.role === 'warehouse' || b.role === 'shop' || b.role === 'inn' || b.role.endsWith('stall') ? -4 : 0) + b.d) || a.structure - b.structure);
    // Brands go a little way in (not only the first row on the shore); looters take what is nearest.
    this.burnTargets = burn.slice(0, this.burnWant + 3);
    this.lootTargets = loot.filter((t) => !this.burnTargets.slice(0, 2).some((b) => b.structure === t.structure)).slice(0, 14);
  }

  /** The horn: all back to the ships. */
  private recall(board: Board): void {
    this.setBeat('recall');
    const chief = this.raiders.find((r) => r.role === 'chief');
    const at = chief?.person ?? null;
    this.host.sound({ type: 'horn', x: at?.x ?? this.site.landings[0]!.x, z: at?.z ?? this.site.landings[0]!.z, long: true });
    for (const r of this.raiders) {
      if (r.where !== 'ashore' || !r.person) continue;
      r.cry = r.role === 'chief' ? 2.2 : 0;
      board.drop(r.person);
      board.crowd.rethink(r.person);
    }
  }

  /** Waited long enough: whoever is not back (blown away, carried off, lost in the lanes) is left behind and runs for the sea. */
  private leaveBehind(board: Board): void {
    this.heartless = true;
    for (const r of this.raiders) {
      if (r.where !== 'ashore') continue;
      r.routed = true;
      if (r.person && board.plans.has(r.person)) board.drop(r.person);
      if (r.person) board.crowd.rethink(r.person);
    }
    this.checkAllAboard(0);
    this.boats.forEach((_, i) => this.checkAllAboard(i + 1));
  }

  /** Stranded: the band loses heart, and the town chases them into the sea. */
  private loseHeart(board: Board): void {
    if (this.t < RAID.strandedWait && this.beat === 'ashore') return;
    this.heartless = true;
    this.setBeat('recall');
    for (const r of this.raiders) {
      if (r.where !== 'ashore' || !r.person) continue;
      r.routed = true;
      r.cry = 0;
      board.drop(r.person);
      board.crowd.rethink(r.person);
    }
    // A few bold townspeople come after them, shaking their fists.
    const nav = board.nav;
    if (!nav) return;
    const chasers = board.crowd.people.filter((p) => !p.raider && !p.child && p.visible && (p.mode === 'walk' || p.mode === 'linger') && !p.scuffle).sort((a, b) => this.nearBand(a) - this.nearBand(b)).slice(0, 6);
    chasers.forEach((p, k) => {
      const l = this.site.landings[k % this.site.landings.length]!;
      const back = key(Math.floor(l.x - l.ox * 1), keyY(l.cell), Math.floor(l.z - l.oz * 1));
      const cell = nav.nodeAt.has(back) ? back : l.cell;
      if (!reaches(board, p, cell)) return;
      const c = board.centre(cell);
      const spot = { x: c.x + (k % 3 - 1) * 0.25, z: c.z + (Math.floor(k / 3) - 0.5) * 0.25 };
      this.fled.set(p, this.age + 60);
      board.assign(p, { chain: this.chainOf(board), at: 0, steps: [board.stepAt(cell, { spot, face: Math.atan2(l.ox, l.oz), pose: 'wave', linger: 14, brisk: true, tag: 'chase:shake' })] });
    });
  }

  private nearBand(p: Person): number {
    const t = this.threats();
    return t.length ? Math.min(...t.map((q) => Math.hypot(q.x - p.x, q.z - p.z))) : 0;
  }

  /** A routed raider at the water's edge wades in and swims off over the edge of the map. */
  private intoSea(r: Raider, board: Board): void {
    const p = r.person!;
    this.boarded.add(p);
    board.unclaim(p);
    p.mode = 'gone';
    p.visible = false;
    r.person = null;
    const fig = r.fig!;
    const l = this.site.landings[r.landing]!;
    r.where = 'swim';
    r.t = 0;
    r.from = { x: p.x + l.ox * 0.6, y: SEA_Y, z: p.z + l.oz * 0.6 };
    const out = this.wayOut(r.from.x + l.ox, r.from.z + l.oz);
    r.to = { x: out.x, y: SEA_Y, z: out.z };
    r.dur = Math.hypot(r.to.x - r.from.x, r.to.z - r.from.z) / 0.6;
    fig.setVisible(true);
    this.host.sound({ type: 'splash', x: r.from.x, z: r.from.z });
  }

  /** Raiders back at the water's edge go out to their vessel (taking up a piece of the pile as they go). */
  private boardThose(board: Board): void {
    for (const r of this.raiders) {
      if (r.where !== 'ashore' || !r.person || r.routed) continue;
      const p = r.person;
      if (!(p.mode === 'linger' && p.goal?.errand?.tag === 'raid:board')) continue;
      const v = this.vesselOf(r);
      const i = r.vessel - 1;
      // The vessel is still there to go to.
      if (r.vessel === 0 ? this.shipState !== 'beached' : this.boatState[i] !== 'wait') continue;
      const pile = board.stores.get(this.piles[r.landing]!.key);
      r.carry = p.load ?? (pile ? board.take(pile) : null);
      p.load = null;
      this.boarded.add(p);
      board.unclaim(p);
      p.mode = 'gone';
      p.visible = false;
      r.person = null;
      r.where = 'wade-out';
      r.t = 0;
      r.from = { x: p.x, y: p.y, z: p.z };
      const w = this.boardingPoint(r);
      r.to = { x: w.x, y: SEA_Y - 0.14, z: w.z };
      r.dur = Math.max(0.6, Math.hypot(w.x - p.x, w.z - p.z) / 0.9);
      r.fig?.pose(p.x, p.y, p.z, p.heading, 'walk', 0, { load: r.carry });
      void v;
    }
    // Whoever is left ashore with their way home gone (their vessel sunk while they were out): routed.
    if (this.stranded && !this.heartless) this.heartless = false;
  }

  // ───────────────────────────────────────────── plans for raiders ──

  /** The raid's chain asks: what does this raider do now? */
  offer(p: Person, board: Board, chain: Chain): Plan | null {
    const r = this.raiders.find((q) => q.person === p);
    if (!r) return null;
    const l = this.site.landings[r.landing]!;
    const steps: PlanStep[] = [];
    const plan = (s: PlanStep[]): Plan => ({ chain, at: 0, steps: s, fail: () => this.failed(r) });
    // Routed: down to the water and away.
    if (r.routed) {
      const edge = board.centre(l.cell);
      steps.push(board.stepAt(l.cell, { spot: { x: edge.x + l.ox * 0.3, z: edge.z + l.oz * 0.3 }, face: Math.atan2(l.ox, l.oz), pose: 'cover', linger: 0.4, brisk: true, load: p.load, tag: 'raid:to-sea' }));
      return plan(steps);
    }
    if (this.beat === 'recall' || this.beat === 'away') {
      const s = this.shorePoint(r);
      steps.push(board.stepAt(this.shoreOf(r).cell, { spot: { x: s.x, z: s.z }, face: Math.atan2(l.ox, l.oz), pose: 'stand', linger: 1e6, brisk: true, load: p.load, tag: 'raid:board' }));
      return plan(steps);
    }
    // Something in their hands: to the pile with it.
    if (p.load) {
      const pile = this.piles[r.landing]!;
      const c = board.centre(l.cell);
      steps.push(board.stepAt(l.cell, { spot: { x: c.x - l.ox * 0.1, z: c.z - l.oz * 0.1 }, face: Math.atan2(l.ox, l.oz), pose: 'tend', linger: 0.6, load: p.load, brisk: true, tag: 'raid:pile', done: (q) => {
        const store = board.stores.get(pile.key);
        if (store && q.load && board.put(store, q.load)) q.load = null;
        else if (store && q.load) {
          // The pile is full: it goes straight aboard with them later.
          r.carry = q.load;
        }
        r.trips++;
      } }));
      return plan(steps);
    }
    // The charge: first up the shore a few cells with a roar.
    if (r.trips === 0 && r.fires === 0 && r.target === null && this.t < 6) {
      const c = this.charge(board, r);
      if (c !== null) {
        const at = board.centre(c);
        steps.push(board.stepAt(c, { spot: { x: at.x + (rand(this.seed, 'mx', r.i) - 0.5) * 0.5, z: at.z + (rand(this.seed, 'mz', r.i) - 0.5) * 0.5 }, face: Math.atan2(-l.ox, -l.oz), pose: 'cheer', linger: 0.9 + rand(this.seed, 'muster', r.i) * 0.6, brisk: true, tag: 'raid:charge' }));
        r.cry = 1.5;
        r.target = -1 as StructureId;
        return plan(steps);
      }
    }
    if (r.role === 'chief') {
      // The chief stands by the landing, horn up, roaring them on.
      const c = this.charge(board, r) ?? l.cell;
      const at = board.centre(c);
      steps.push(board.stepAt(c, { spot: { x: at.x, z: at.z }, face: Math.atan2(-l.ox, -l.oz), pose: 'cheer', linger: 6, tag: 'raid:chief' }));
      return plan(steps);
    }
    if (r.role === 'brand') {
      const t = this.takeTarget(this.burnTargets, r, board, () => this.burnt < this.burnWant);
      if (t) {
        const s = standsOf(board, t.structure).filter((x) => reaches(board, p, x.cell)).sort((a, b) => board.dist(a.cell, p.cell) - board.dist(b.cell, p.cell))[0];
        if (s) {
          const at = board.centre(s.cell);
          steps.push(board.stepAt(s.cell, { spot: { x: at.x, z: at.z }, face: s.face, pose: 'wave', linger: 1.1, brisk: true, tag: 'raid:burn', done: () => {
            t.done = true;
            t.by = null;
            r.target = null;
            const lit = this.host.director.ignite(t.cell);
            if (lit) {
              this.burnt++;
              r.fires++;
            }
          } }));
          return plan(steps);
        }
        t.done = true;
      }
    } else {
      const t = r.trips < RAID.trips ? this.takeTarget(this.lootTargets, r, board, () => true) : null;
      if (t) {
        const loot = this.lootFor(t, r);
        const nav = board.nav!;
        const door = (nav.doorsOf.get(t.structure) ?? []).map((i) => nav.doors[i]!).find((d) => d.node >= 0 && !d.hatch && reaches(board, p, nav.nodes[d.node]!.cell));
        if (door && door.dir !== undefined) {
          const cell = nav.nodes[door.node]!.cell;
          const c = board.centre(cell);
          const [dx, dz] = DIR4[door.dir]!;
          // In front of the door, facing it: a kick, in, and out with the goods.
          const spot = { x: c.x - dx * 0.22, z: c.z - dz * 0.22 };
          steps.push(board.stepAt(cell, { spot, face: DIR_HEADING[(door.dir + 2) % 4 as 0 | 1 | 2 | 3], pose: 'kick', linger: RAID.kick, brisk: true, tag: 'raid:kick' }));
          const inside = board.stepIn(t.structure, { cell, pose: 'stand', linger: RAID.inside, tag: 'raid:loot' });
          if (inside) steps.push(inside);
          const pile = this.piles[r.landing]!;
          const lc = board.centre(l.cell);
          steps.push(board.stepAt(l.cell, { spot: { x: lc.x - l.ox * 0.1, z: lc.z - l.oz * 0.1 }, face: Math.atan2(l.ox, l.oz), pose: 'tend', linger: 0.6, load: loot, brisk: true, tag: 'raid:pile', done: (q) => {
            const store = board.stores.get(pile.key);
            if (store && q.load && board.put(store, q.load)) q.load = null;
            r.trips++;
            t.done = true;
            t.by = null;
            r.target = null;
          } }));
          return plan(steps);
        }
        // A stall: taken off its counter where it stands.
        const s = standsOf(board, t.structure).filter((x) => reaches(board, p, x.cell)).sort((a, b) => board.dist(a.cell, p.cell) - board.dist(b.cell, p.cell))[0];
        if (s) {
          const at = board.centre(s.cell);
          const pile = this.piles[r.landing]!;
          const lc = board.centre(l.cell);
          steps.push(board.stepAt(s.cell, { spot: { x: at.x, z: at.z }, face: s.face, pose: 'tend', linger: 1.2, brisk: true, tag: 'raid:grab' }));
          steps.push(board.stepAt(l.cell, { spot: { x: lc.x - l.ox * 0.1, z: lc.z - l.oz * 0.1 }, face: Math.atan2(l.ox, l.oz), pose: 'tend', linger: 0.6, load: loot, brisk: true, tag: 'raid:pile', done: (q) => {
            const store = board.stores.get(pile.key);
            if (store && q.load && board.put(store, q.load)) q.load = null;
            r.trips++;
            t.done = true;
            t.by = null;
            r.target = null;
          } }));
          return plan(steps);
        }
        t.done = true;
      }
    }
    // Nothing left to do: swagger about near the band, weapon up.
    const c = this.charge(board, r) ?? l.cell;
    const at = board.centre(c);
    steps.push(board.stepAt(c, { spot: { x: at.x + (rand(this.seed, 'lx', r.i, Math.floor(this.age)) - 0.5) * 0.5, z: at.z + (rand(this.seed, 'lz', r.i, Math.floor(this.age)) - 0.5) * 0.5 }, face: NaN, pose: 'cheer', linger: 3, tag: 'raid:roam' }));
    return plan(steps);
  }

  private failed(r: Raider): void {
    // Its building is gone or out of reach: given up; the next plan is asked for.
    for (const t of [...this.burnTargets, ...this.lootTargets]) if (t.by === r) {
      t.by = null;
      t.done = true;
    }
    r.target = null;
  }

  private takeTarget(list: Target[], r: Raider, board: Board, more: () => boolean): Target | null {
    if (!more()) return null;
    const p = r.person!;
    let best: Target | null = null, bestD = Infinity;
    for (const t of list) {
      if (t.done || (t.by && t.by !== r)) continue;
      const d = board.dist(t.cell, p.cell) + (t.by === r ? -100 : 0);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best) {
      best.by = r;
      r.target = best.structure;
    }
    return best;
  }

  private lootFor(t: Target, r: Raider): Load {
    const list = LOOT_BY_ROLE[t.role] ?? LOOT_HOME;
    return list[Math.floor(rand(this.seed, 'loot', t.structure, r.i, r.trips) * list.length)]!;
  }

  /** A cell a few steps up from the landing, for the charge and the chief. */
  private charge(board: Board, r: Raider): CellKey | null {
    const nav = board.nav;
    if (!nav) return null;
    const l = this.site.landings[r.landing]!;
    for (const k of [3, 2, 4, 1]) {
      const side = (r.i % 3) - 1;
      const x = Math.floor(l.x - l.ox * k - l.oz * side), z = Math.floor(l.z - l.oz * k + l.ox * side);
      for (const y of [keyY(l.cell), keyY(l.cell) + 1, keyY(l.cell) - 1]) {
        const c = key(x, Math.max(0, y), z);
        if (nav.nodeAt.has(c) && reaches(board, r.person!, c)) return c;
      }
    }
    return null;
  }

  // ───────────────────────────────────────────────────────── the end ──

  /** Over: every drawing hidden (the system lets them go a frame later, so nothing goes while it is drawn). */
  hideAll(): void {
    for (const r of this.raiders) r.fig?.hideAll();
    for (const f of this.crewFigs) f.hideAll();
    this.ship.hideAll();
    for (const b of this.boats) b.hideAll();
  }

  /** Ends it now, everything put away (undo, a new town, a raid called off). */
  end(board: Board | null): void {
    if (this.ended) return;
    this.ended = true;
    this.beat = 'done';
    for (const r of this.raiders) {
      r.fig?.release();
      r.fig = null;
      if (r.person && r.person.mode !== 'gone') {
        board?.unclaim(r.person);
        board?.drop(r.person);
        r.person.load = null;
        r.person.mode = 'gone';
        r.person.visible = false;
      }
      r.person = null;
    }
    for (const f of this.crewFigs) f.release();
    this.crewFigs = [];
    this.ship.release();
    for (const b of this.boats) b.release();
    if (board) {
      for (const p of this.piles) {
        const s = board.stores.get(p.key);
        if (s) while (board.take(s)) {
          // Cleared.
        }
      }
      // Anybody still running from them goes about their day.
      for (const [p] of this.fled) {
        const plan = board.plans.get(p);
        if (plan && plan.chain.id === 'raid') board.drop(p);
      }
      if (this.scene) scenesOf(board).end(this.scene);
    }
    this.fled.clear();
    this.scene = null;
  }
}

/** Where the loot piles up at a landing: on the shore cell, round its landward side. */
function pileSpots(l: Landing): Spot[] {
  const out: Spot[] = [];
  const bx = l.x - l.ox * 0.18, bz = l.z - l.oz * 0.18;
  const offs: [number, number, number][] = [[-0.22, 0, 0], [0.22, 0, 0], [0, 0.02, -0.2], [-0.12, 0.13, -0.05], [0.12, 0.13, -0.05], [0, 0.24, -0.1]];
  for (const [a, up, back] of offs) {
    out.push({ x: bx - l.oz * a - l.ox * back, y: l.y + up + 0.01, z: bz + l.ox * a - l.oz * back, yaw: Math.atan2(l.ox, l.oz) + a * 2 });
  }
  return out;
}

