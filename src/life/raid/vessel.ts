// The raid's ships and boats as drawn and moved (design section 13b, the raid).
//
// A VESSEL is a hull, its sail and yard (a ship), its two banks of oars, and
// the loot heaped amidships, posed together on the swell. Where it is comes
// from the raid (raid.ts): along a path, spinning about at its turning point,
// rowing straight in to a beach, lying with its bow up on the sand, towed on
// a line behind the ship (a boat). It is cut off at the edge of the map as
// every ship is (params.w −2), never shrunk or faded.

import { SEA_Y } from '@/core/grid';
import type { Mat4 } from '@/core/mat4';
import { BOAT, LONGSHIP, longshipMesh, longshipSailMesh, longshipYardMesh, lootHeapMesh, oarBankMesh, raidBoatMesh } from '@/parts/raid/longship';
import type { HullSize } from '@/rules/life/ship-routes';
import { mapEdge } from '@/rules/life/ship-routes';
import type { InstanceHandle, LifeStage } from '../api';
import { swellAt, type Swell } from '../boats/afloat';
import { oarStroke } from '../ships/body';
import { clamp01, easeInOut } from '../motion/ease';
import { fly, mulInto } from '../motion/pose';

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -60, 0, 1];

export interface Seat {
  /** In the vessel's frame (+Z the bow). */
  x: number;
  y: number;
  z: number;
  /** Heading in the vessel's frame (π: facing aft, as a rower does). */
  face: number;
  /** Sitting on a bench (a rower), or standing (the chief at the prow, the steersman). */
  sit: boolean;
}

export class Vessel {
  x = 0;
  z = 0;
  yaw = 0;
  /** The bow up on the sand (0–1). */
  beach = 0;
  /** Sail set, 0 (furled on its yard) to 1; how full it is. */
  sail = 0;
  fill = 0.8;
  /** Oars: 0 at rest (level, blades on the water), 1 pulling; the stroke's phase. */
  rowing = 0;
  stroke = 0;
  /** Going astern (backing water): the stroke runs the other way. */
  astern = false;
  /** Loot heaped amidships (pieces). */
  heap = 0;
  /** Mischief: 0 whole, 1 scorched (sail torn), 2 burning, 3 broken; how far gone down (0–1); listing which way. */
  hurt: 0 | 1 | 2 | 3 = 0;
  sink = 0;
  list = 1;
  /** Seconds it has burnt. */
  burnt = 0;
  readonly seats: Seat[] = [];
  readonly hull: HullSize;
  readonly length: number;
  private hullH: InstanceHandle;
  private yardH: InstanceHandle | null = null;
  private sailH: InstanceHandle | null = null;
  private oarsH: InstanceHandle[];
  private heapH: InstanceHandle | null = null;
  private heapShown = 0;
  /** Heaps outgrown (hidden; let go with the vessel). */
  private oldHeaps: InstanceHandle[] = [];
  private swell: Swell = { heave: 0, roll: 0, pitch: 0 };
  private cut = false;
  private released = false;
  readonly m: Mat4 = new Array<number>(16).fill(0);
  private tmp: Mat4 = new Array<number>(16).fill(0);
  private tmp2: Mat4 = new Array<number>(16).fill(0);

  constructor(private stage: LifeStage, readonly kind: 'ship' | 'boat', readonly size: number, readonly look: number, private phase: number) {
    const ship = kind === 'ship';
    this.hull = ship
      ? { stern: LONGSHIP.stern * size, bow: LONGSHIP.bow * size, halfBeam: LONGSHIP.halfBeam * size }
      : { stern: BOAT.stern, bow: BOAT.bow, halfBeam: BOAT.halfBeam };
    this.length = this.hull.bow - this.hull.stern;
    this.hullH = stage.spawnMesh(ship ? longshipMesh(size, look) : raidBoatMesh(look), HIDDEN);
    if (ship) {
      this.yardH = stage.spawnMesh(longshipYardMesh(size), HIDDEN);
      this.sailH = stage.spawnMesh(longshipSailMesh(size), HIDDEN);
    }
    this.oarsH = ([1, -1] as const).map((side) => stage.spawnMesh(oarBankMesh(side, ship ? size : 1, !ship), HIDDEN));
    // Seats: a rower each side of every bench, facing aft; the chief at the prow and a steersman aft.
    const o = ship ? LONGSHIP : BOAT;
    const k = ship ? size : 1;
    for (let i = 0; i < o.oars; i++) {
      const z = (o.oarZ0 + ((o.oarZ1 - o.oarZ0) * i) / Math.max(1, o.oars - 1)) * k + (ship ? 0.05 : 0.04);
      for (const side of [1, -1]) this.seats.push({ x: side * (ship ? 0.27 : 0.17) * k, y: (ship ? 0.07 : 0.05) * k, z, face: Math.PI, sit: true });
    }
    if (ship) {
      this.seats.unshift({ x: 0, y: 0.12 * k, z: 1.75 * k, face: 0, sit: false });
      this.seats.push({ x: 0.18 * k, y: 0.12 * k, z: -1.95 * k, face: 0, sit: false });
    } else {
      this.seats.push({ x: 0, y: 0.06, z: -0.72, face: 0, sit: true });
    }
  }

  /** Where a seat is in the world now, and the heading of whoever is in it. */
  seatAt(i: number): { x: number; y: number; z: number; heading: number } {
    const s = this.seats[i % this.seats.length]!;
    const m = this.m;
    return {
      x: m[0]! * s.x + m[4]! * s.y + m[8]! * s.z + m[12]!,
      y: m[1]! * s.x + m[5]! * s.y + m[9]! * s.z + m[13]!,
      z: m[2]! * s.x + m[6]! * s.y + m[10]! * s.z + m[14]!,
      heading: this.yaw + s.face,
    };
  }

  /** A point on the water beside it: `along` its length from its origin, `side` (+1 starboard) a little off its side. */
  beside(along: number, side: number, off = 0.35): { x: number; z: number } {
    const sx = Math.sin(this.yaw), cz = Math.cos(this.yaw);
    const w = this.hull.halfBeam + off;
    return { x: this.x + sx * along + cz * side * w, z: this.z + cz * along - sx * side * w };
  }

  /** Poses every piece for life time `seconds` with the wind `wind` (0–1) blowing toward `downwind` (yaw). */
  draw(seconds: number, wind: number): void {
    if (this.released) return;
    const sw = swellAt(seconds, this.phase, this.length, wind * (1 - this.beach), this.swell);
    const beach = easeInOut(clamp01(this.beach));
    // Down by the stern and over to one side as it sinks: under the water, never shrunk.
    const s = clamp01(this.sink);
    const y = SEA_Y + sw.heave * (1 - beach) + beach * 0.08 * this.size - s * s * (0.9 + this.length * 0.2);
    const pitch = sw.pitch * (1 - beach) + beach * 0.07 - s * 0.35;
    const roll = sw.roll * (1 - beach) + s * this.list * 0.5;
    fly(this.x, y, this.z, this.yaw, pitch, roll, 1, this.m);
    this.hullH.setMatrix(this.m);
    const ship = this.kind === 'ship';
    if (ship && this.yardH && this.sailH) {
      // The yard at the masthead, squared across; the cloth below it, set and bellied.
      const k = this.size;
      const t = this.tmp;
      t.fill(0);
      t[0] = 1; t[5] = 1; t[10] = 1; t[15] = 1;
      t[13] = LONGSHIP.yardY * k; t[14] = LONGSHIP.mastZ * k;
      this.yardH.setMatrix(mulInto(this.tmp2, this.m, t));
      const set = this.hurt >= 1 ? 0 : easeInOut(clamp01(this.sail));
      if (set < 0.04) this.sailH.setVisible(false);
      else {
        this.sailH.setVisible(true);
        t[5] = set;
        t[10] = Math.max(0.2, this.fill);
        this.sailH.setMatrix(mulInto(this.tmp2, this.m, t));
      }
    }
    this.poseOars();
    // The loot heap amidships.
    const want = Math.min(3, this.heap);
    if (want !== this.heapShown) {
      this.heapShown = want;
      this.heapH?.setVisible(false);
      if (this.heapH) this.oldHeaps.push(this.heapH);
      this.heapH = want > 0 ? this.stage.spawnMesh(lootHeapMesh(want, ship ? this.size : 0.7), HIDDEN) : null;
      if (this.heapH && this.cut) this.heapH.setParams(1, 0, 0, -2);
    }
    if (this.heapH) {
      const t = this.tmp;
      t.fill(0);
      t[0] = 1; t[5] = 1; t[10] = 1; t[15] = 1;
      t[13] = (ship ? 0.07 : 0.05) * (ship ? this.size : 1);
      t[14] = ship ? -0.75 * this.size : 0.25;
      this.heapH.setMatrix(mulInto(this.tmp2, this.m, t));
    }
    this.setCut(mapEdge(this.x, this.z) > -this.length * 0.6);
  }

  private poseOars(): void {
    const ship = this.kind === 'ship';
    const o = ship ? LONGSHIP : BOAT;
    const k = ship ? this.size : 1;
    // At rest the oars lie level with their blades on the water (rowing 0 here is "resting", not tossed).
    const phase = this.astern ? 1 - this.stroke : this.stroke;
    const [dipRow, sweep] = oarStroke(phase, 1);
    const r = clamp01(this.rowing);
    const dip = 0.15 + (dipRow - 0.15) * r;
    const sw = sweep * r * 0.8;
    this.oarsH.forEach((h, i) => {
      const side = i === 0 ? 1 : -1;
      const px = side * o.oarX * k, py = o.oarY * k;
      const a = -side * dip;
      const c = Math.cos(a), sn = Math.sin(a);
      const m = this.tmp;
      m.fill(0);
      m[0] = c; m[1] = sn; m[2] = side * sw;
      m[4] = -sn; m[5] = c;
      m[10] = 1;
      m[15] = 1;
      m[12] = px - (m[0]! * px + m[4]! * py);
      m[13] = py - (m[1]! * px + m[5]! * py);
      m[14] = -(m[2]! * px);
      h.setMatrix(mulInto(this.tmp2, this.m, m));
      // Broken and going down: the oars go with it, unmanned.
      h.setVisible(this.hurt < 3 || this.sink < 0.6);
    });
  }

  private setCut(on: boolean): void {
    if (on === this.cut || this.released) return;
    this.cut = on;
    const w = on ? -2 : 0;
    for (const h of [this.hullH, this.yardH, this.sailH, this.heapH, ...this.oarsH]) h?.setParams(1, 0, 0, w);
  }

  get edgeCut(): boolean {
    return this.cut;
  }

  /** Mischief took its sail (torn away, or burnt): the yard stays, the cloth is not shown again. */
  loseSail(): void {
    this.sailH?.setVisible(false);
  }

  /** Hidden, every piece (before it is let go). */
  hideAll(): void {
    for (const h of [this.hullH, this.yardH, this.sailH, this.heapH, ...this.oarsH]) h?.setVisible(false);
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    for (const h of [this.hullH, this.yardH, this.sailH, this.heapH, ...this.oarsH, ...this.oldHeaps]) h?.release();
  }
}
