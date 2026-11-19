// A big ship as drawn (L38–L41): its hull and every piece that moves on it,
// spawned as instances and posed together. The harbour system decides where
// the ship is and what its crew are doing; this places the pieces.
//
//   sails   each square sail is its yard (always shown) and its cloth,
//           scaled up toward the yard to furl it and across by how full it
//           is; the yards are braced round to the wind. A lateen swings to
//           the lee side like the sailboat's mainsail (two cloths, one
//           bellying each way, the lee one shown).
//   flags   turned downwind about their hoist, wherever the ship heads
//   oars    a bank each side, moved as one: dipped about the line of the
//           tholes and swept fore and aft (a shear), see `oarStroke`
//
// Poses (the set of the sails, the fill, the brace) are trimmed on twos by
// the caller; `pose` places everything on the hull's matrix and may be
// called every frame.

import type { Mat4, Mat4Like } from '@/core/mat4';
import { lateenFrame } from '@/parts/actors/ships/sail.part';
import { rigOf, shipIndex, type ShipKind, type ShipRig } from '@/parts/actors/ships/rig';
import type { InstanceHandle, LifeStage } from '../api';
import { approach, clamp01, easeInOut } from '../motion/ease';
import { mulInto } from '../motion/pose';

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
/** The thinnest a cloth is drawn: below this it is hidden (furled). */
const FURLED = 0.035;
/** Square yards are braced round at most this far (radians). */
const BRACE = 0.62;

export interface SailPiece {
  yard: InstanceHandle;
  /** One cloth (square) or two, bellying to +X and −X (lateen). */
  cloth: InstanceHandle[];
  /** How far set, 0 (furled) to 1, and where it is going. */
  set: number;
  want: number;
  shown: number;
}

/** The wind in the ship's own frame: `lee` across (+: blowing toward +X), `along` (+: from astern). */
export interface ShipWind {
  lee: number;
  along: number;
  strength: number;
}

export class ShipBody {
  readonly rig: ShipRig;
  readonly hull: InstanceHandle;
  readonly sails: SailPiece[] = [];
  private pennant: InstanceHandle | null = null;
  private ensign: InstanceHandle | null = null;
  private oars: InstanceHandle[] = [];
  /** Yards' brace (radians), the cloth's fill (0.15–1), the lateen's swing and side. */
  brace = 0;
  fill = 0.6;
  swing = 0.4;
  side = 1;
  /** The oars: 0 shipped (tossed up), 1 rowing; and where in the stroke they are (0–1). */
  rowing = 0;
  stroke = 0;
  private local: Mat4 = new Array<number>(16).fill(0);
  private world: Mat4 = new Array<number>(16).fill(0);
  private tmp: Mat4 = new Array<number>(16).fill(0);
  private released = false;

  constructor(private stage: LifeStage, readonly kind: ShipKind, readonly look: number, at: Mat4Like, set = 1) {
    this.rig = rigOf(kind, look);
    this.hull = stage.spawn({ actor: kind, params: { look } }, at);
    const ship = shipIndex(kind);
    this.rig.sails.forEach((def, i) => {
      const params = { ship, sail: i, look };
      const yard = stage.spawn({ actor: 'ship-sail', variant: 'yard', params }, HIDDEN);
      const cloth = def.kind === 'square'
        ? [stage.spawn({ actor: 'ship-sail', variant: 'cloth', params }, HIDDEN)]
        : [stage.spawn({ actor: 'ship-sail', variant: 'cloth', params: { ...params, side: 1 } }, HIDDEN), stage.spawn({ actor: 'ship-sail', variant: 'cloth', params: { ...params, side: -1 } }, HIDDEN)];
      for (const c of cloth) c.setVisible(false);
      this.sails.push({ yard, cloth, set, want: set, shown: -1 });
    });
    if (this.rig.pennant) this.pennant = stage.spawn({ actor: 'ship-flag', variant: 'pennant', params: { look, length: this.rig.pennant.length } }, HIDDEN);
    if (this.rig.ensign) this.ensign = stage.spawn({ actor: 'ship-flag', variant: 'ensign', params: { look, length: this.rig.ensign.length } }, HIDDEN);
    if (this.rig.oars) this.oars = [1, -1].map((side) => stage.spawn({ actor: 'ship-oars', params: { side, look } }, HIDDEN));
  }

  /** Sets every sail's target: 1 all set, 0 all furled. */
  setAll(want: number): void {
    for (const s of this.sails) s.want = want;
  }

  /** How much sail is set, 0–1 (the mean over the sails, weighted by nothing). */
  get canvas(): number {
    let n = 0;
    for (const s of this.sails) n += s.set;
    return this.sails.length ? n / this.sails.length : 0;
  }

  /** Moves the sails toward their targets and trims them to the wind, for `step` seconds. */
  trim(step: number, wind: ShipWind, sailTime: number): void {
    for (const s of this.sails) s.set = approach(s.set, s.want, step / Math.max(0.05, sailTime));
    // Square yards: square to the wind as far as the braces allow.
    const braced = wind.along < -0.2 ? Math.sign(wind.lee || 1) * BRACE : Math.max(-BRACE, Math.min(BRACE, Math.atan2(wind.lee, Math.max(0.05, wind.along))));
    const ease = Math.min(1, step * 1.8);
    this.brace += (braced - this.brace) * ease;
    const facing = Math.sin(this.brace) * wind.lee + Math.cos(this.brace) * wind.along;
    const fill = clamp01(0.2 + 0.8 * Math.max(0, facing)) * (0.7 + 0.3 * Math.min(1, wind.strength / 0.5));
    this.fill += (Math.max(0.15, fill) - this.fill) * ease;
    // The lateen: out to the lee side, further the freer the wind.
    if (Math.abs(wind.lee) > 0.1) this.side = wind.lee > 0 ? 1 : -1;
    const off = Math.acos(Math.max(-1, Math.min(1, -wind.along)));
    const swing = this.side * (0.25 + 0.7 * clamp01((off - 0.5) / 2));
    this.swing += (swing - this.swing) * ease;
  }

  /** Places every piece on a hull whose world matrix is `hull`, the flags flying toward `downwind` (yaw). */
  pose(hull: Mat4Like, downwind: number, scale = 1): void {
    if (this.released) return;
    this.hull.setMatrix(hull);
    const rig = this.rig;
    this.sails.forEach((s, i) => {
      const def = rig.sails[i]!;
      const m = this.local;
      if (def.kind === 'square') {
        const c = Math.cos(this.brace), sn = Math.sin(this.brace);
        // T(at) · Ry(brace)
        m.fill(0);
        m[0] = c; m[2] = -sn; m[5] = 1; m[8] = sn; m[10] = c; m[15] = 1;
        m[12] = def.at[0]; m[13] = def.at[1]; m[14] = def.at[2];
        s.yard.setMatrix(mulInto(this.world, hull, m));
        const shown = s.set > FURLED ? 0 : -1;
        this.show(s, shown);
        if (shown >= 0) {
          const k = easeInOut(clamp01(s.set));
          // · S(1, set, fill)
          m[4] = 0; m[5] = k; m[6] = 0;
          m[8] = sn * this.fill; m[10] = c * this.fill;
          s.cloth[0]!.setMatrix(mulInto(this.world, hull, m));
        }
      } else {
        const L = lateenFrame(def);
        const sw = this.swing;
        const c = Math.cos(sw), sn = Math.sin(sw);
        // T(at) · Ry(swing) · L
        m.fill(0);
        m[0] = c; m[2] = -sn; m[5] = 1; m[8] = sn; m[10] = c; m[15] = 1;
        m[12] = def.at[0]; m[13] = def.at[1]; m[14] = def.at[2];
        mulInto(this.tmp, m, L);
        s.yard.setMatrix(mulInto(this.world, hull, this.tmp));
        const which = this.side > 0 ? 0 : 1;
        const shown = s.set > FURLED ? which : -1;
        this.show(s, shown);
        if (shown >= 0) {
          const k = easeInOut(clamp01(s.set));
          const f = Math.max(0.2, this.fill);
          // · S(fill, set, 1)
          const t = this.tmp;
          for (let r = 0; r < 3; r++) {
            t[r] = t[r]! * f;
            t[4 + r] = t[4 + r]! * k;
          }
          s.cloth[which]!.setMatrix(mulInto(this.world, hull, t));
        }
      }
    });
    if (this.pennant) this.flag(this.pennant, rig.pennant!.at, hull, downwind, scale);
    if (this.ensign) this.flag(this.ensign, rig.ensign!.at, hull, downwind, scale);
    if (this.oars.length) this.poseOars(hull);
  }

  private flag(h: InstanceHandle, at: readonly number[], hull: Mat4Like, yaw: number, scale: number): void {
    const x = hull[0]! * at[0]! + hull[4]! * at[1]! + hull[8]! * at[2]! + hull[12]!;
    const y = hull[1]! * at[0]! + hull[5]! * at[1]! + hull[9]! * at[2]! + hull[13]!;
    const z = hull[2]! * at[0]! + hull[6]! * at[1]! + hull[10]! * at[2]! + hull[14]!;
    const c = Math.cos(yaw) * scale, s = Math.sin(yaw) * scale;
    const m = this.local;
    m.fill(0);
    m[0] = c; m[2] = -s; m[5] = scale; m[8] = s; m[10] = c; m[15] = 1;
    m[12] = x; m[13] = y; m[14] = z;
    h.setMatrix(m);
  }

  /**
   * The oars: dipped by `dip` (radians, + blades down) about the line of the tholes and swept by `sweep`
   * (the blade moves forward by sweep per unit outboard). Shipped, they are tossed up nearly upright.
   */
  private poseOars(hull: Mat4Like): void {
    const o = this.rig.oars!;
    const [dip, sweep] = oarStroke(this.stroke, this.rowing);
    this.oars.forEach((h, k) => {
      const side = k === 0 ? 1 : -1;
      const px = side * o.x, py = o.y;
      // Rotation about the Z line through (px, py): blade (outboard, +side·X) goes down for dip > 0.
      const a = -side * dip;
      const c = Math.cos(a), s = Math.sin(a);
      // M = T(p) · Rz(a) · Shear · T(−p), Shear: z += sweep · side · (x − px)
      const m = this.local;
      m.fill(0);
      // Rz(a) · Shear: columns: X → (c, s, side·sweep), Y → (−s, c, 0), Z → (0, 0, 1)
      m[0] = c; m[1] = s; m[2] = side * sweep;
      m[4] = -s; m[5] = c; m[6] = 0;
      m[8] = 0; m[9] = 0; m[10] = 1;
      m[15] = 1;
      m[12] = px - (m[0]! * px + m[4]! * py);
      m[13] = py - (m[1]! * px + m[5]! * py);
      m[14] = -(m[2]! * px);
      h.setMatrix(mulInto(this.world, hull, m));
    });
  }

  private show(s: SailPiece, which: number): void {
    if (s.shown === which) return;
    s.shown = which;
    s.cloth.forEach((c, i) => c.setVisible(i === which));
  }

  setVisible(v: boolean): void {
    this.hull.setVisible(v);
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    this.hull.release();
    for (const s of this.sails) {
      s.yard.release();
      for (const c of s.cloth) c.release();
    }
    this.pennant?.release();
    this.ensign?.release();
    for (const h of this.oars) h.release();
  }
}

/**
 * The oars at `phase` (0–1) of a stroke, `rowing` (0–1) of the way from tossed to pulling: [dip, sweep].
 * Catch (blades forward, going in), drive (aft through the water), release (out), recovery (forward in
 * the air). Tossed: upright, still.
 */
export function oarStroke(phase: number, rowing: number): [number, number] {
  const p = ((phase % 1) + 1) % 1;
  // Sweep: forward at the catch (p = 0), aft at the release (p = 0.5), back forward by p = 1.
  const sweep = 0.42 * Math.cos(p * Math.PI * 2);
  // Dip: in the water through the drive (blades down), lifted through the recovery.
  const inWater = p < 0.5 ? Math.sin(p * Math.PI * 2) : 0;
  const lifted = p >= 0.5 ? Math.sin((p - 0.5) * Math.PI * 2) : 0;
  const dipRow = 0.2 + 0.1 * inWater - 0.16 * lifted;
  const tossed = -1.25;
  const r = clamp01(rowing);
  return [tossed + (dipRow - tossed) * r, sweep * r];
}
