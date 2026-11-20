// A sailboat's sails (L19): a mainsail on its boom and a jib, trimmed to the
// wind. The sail fills on the lee side; when the wind crosses the bow or the
// stern it goes slack, swings across the boat and fills on the other side.
//
// Each sail is two instances, one built bellying each way
// (src/parts/actors/boats/boat-sail.part.ts): the one on the lee side is
// shown, squeezed across by how full it is. `trim` moves the sails (a pose:
// call it on twos); `pose` places them on the hull (call it whenever the
// hull moves).

import type { Mat4, Mat4Like } from '@/core/mat4';
import { sailboatRig, type Rig } from '@/parts/actors/boats/rig';
import { BOATS } from '@/style/boats';
import type { InstanceHandle, LifeStage } from '../api';
import { approach, clamp01, easeInOut, lerp } from '../motion/ease';
import { mulInto } from '../motion/pose';

/** A sail is never squeezed flatter than this (it would vanish edge-on); below it, it changes sides. */
const THIN = 0.16;

const smooth = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export class Sails {
  private rig: Rig = sailboatRig();
  /** [bellying to +X, bellying to −X] */
  private main: [InstanceHandle, InstanceHandle];
  private jib: [InstanceHandle, InstanceHandle];
  /** Which side each sail is on, −1 … 1; it runs through 0 as the sail crosses the boat. */
  mainSide = 0;
  jibSide = 0;
  /** The side the wind wants them on: −1 or 1. */
  private want = 0;
  /** How far the boom is let out (radians) and how full the cloth is (0–1). */
  private boom = BOATS.boomIn;
  private sheet = 0.3;
  private drive = 1;
  private local: Mat4 = new Array<number>(16).fill(0);
  private world: Mat4 = new Array<number>(16).fill(0);
  private shown: [number, number] = [0, 0];

  constructor(private stage: LifeStage, look: number, at: Mat4Like) {
    const spawn = (variant: string, side: number): InstanceHandle => stage.spawn({ actor: 'boat-sail', variant, params: { side, look } }, at);
    this.main = [spawn('main', 1), spawn('main', -1)];
    this.jib = [spawn('jib', 1), spawn('jib', -1)];
    for (const h of [this.main[1], this.jib[1]]) h.setVisible(false);
    this.shown = [1, 1];
  }

  /** The sail's signed angle off the centreline, as a fraction of its trim: where it is on its way across. */
  private static swing(side: number): number {
    return 2 * easeInOut((side + 1) / 2) - 1;
  }

  /**
   * Trims the sails for `step` seconds. `lee` is the wind's component across the boat (+: it blows
   * toward the boat's +X side) and `along` its component along it (+: from astern), both of the unit
   * wind direction in the boat's frame; `strength` is the wind's strength.
   */
  trim(step: number, lee: number, along: number, strength: number): void {
    if (this.want === 0) {
      // First time: straight onto the lee side.
      this.want = lee >= 0 ? 1 : -1;
      this.mainSide = this.jibSide = this.want;
    } else if (lee > BOATS.tackDead) this.want = 1;
    else if (lee < -BOATS.tackDead) this.want = -1;
    const rate = (2 / Math.max(0.05, BOATS.tack)) * step;
    this.mainSide = approach(this.mainSide, this.want, rate);
    // The jib is lighter and gets across a little sooner.
    this.jibSide = approach(this.jibSide, this.want, rate * 1.25);
    // The angle off the wind: 0 head to wind, π running before it.
    const off = Math.acos(Math.min(1, Math.max(-1, -along)));
    const free = smooth((off - 0.6) / 2.2);
    const ease = Math.min(1, step * 2.5);
    this.boom += (lerp(BOATS.boomIn, BOATS.boomOut, free) - this.boom) * ease;
    this.sheet += (lerp(0.24, 0.85, free) - this.sheet) * ease;
    // Pinched close to the wind a sail lifts and loses its belly; a fresh breeze fills it out.
    this.drive = (0.5 + 0.5 * smooth((off - 0.15) / 0.5)) * (0.78 + 0.22 * Math.min(1, strength / 0.5));
  }

  /** How full the mainsail is and which way: −1 … 1 (for tests and for the hull's heel). */
  get fill(): number {
    const g = Sails.swing(this.mainSide);
    return Math.sign(g || 1) * Math.max(THIN, Math.abs(g)) * this.drive;
  }

  /** Places the sails on a hull whose world matrix is `hull`. */
  pose(hull: Mat4Like): void {
    const rig = this.rig;
    // ── the mainsail: at the gooseneck, swung about the mast, squeezed across ──
    {
      const g = Sails.swing(this.mainSide);
      const which = g >= 0 ? 0 : 1;
      const angle = -this.boom * g;
      const full = Math.max(THIN, Math.abs(g)) * this.drive;
      const c = Math.cos(angle), s = Math.sin(angle);
      const m = this.local;
      m[0] = c * full; m[1] = 0; m[2] = -s * full; m[3] = 0;
      m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
      m[8] = s; m[9] = 0; m[10] = c; m[11] = 0;
      m[12] = rig.gooseneck[0]; m[13] = rig.gooseneck[1]; m[14] = rig.gooseneck[2]; m[15] = 1;
      this.show(0, this.main, which);
      this.main[which].setMatrix(mulInto(this.world, hull, m));
    }
    // ── the jib: at its tack, leaning back along the forestay, swung about its own luff ──
    {
      const g = Sails.swing(this.jibSide);
      const which = g >= 0 ? 0 : 1;
      const angle = -this.sheet * g;
      const full = Math.max(THIN, Math.abs(g)) * this.drive;
      const c = Math.cos(angle), s = Math.sin(angle);
      const ca = Math.cos(rig.jibSlant), sa = Math.sin(rig.jibSlant);
      const m = this.local;
      m[0] = c * full; m[1] = -s * sa * full; m[2] = -s * ca * full; m[3] = 0;
      m[4] = 0; m[5] = ca; m[6] = -sa; m[7] = 0;
      m[8] = s; m[9] = c * sa; m[10] = c * ca; m[11] = 0;
      m[12] = rig.jibTack[0]; m[13] = rig.jibTack[1]; m[14] = rig.jibTack[2]; m[15] = 1;
      this.show(1, this.jib, which);
      this.jib[which].setMatrix(mulInto(this.world, hull, m));
    }
  }

  private show(sail: number, pair: [InstanceHandle, InstanceHandle], which: number): void {
    const code = which + 1;
    if (this.shown[sail] === code) return;
    this.shown[sail] = code;
    pair[which].setVisible(true);
    pair[1 - which]!.setVisible(false);
  }

  /** Cut off at the edge of the map as the boat sails out through it (src/life/ships/ferry.system.ts). */
  cutAtEdge(on: boolean): void {
    for (const h of [...this.main, ...this.jib]) h.setParams(1, 0, 0, on ? -1 : 0);
  }

  release(): void {
    for (const h of [...this.main, ...this.jib]) h.release();
  }
}
