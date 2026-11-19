// The sailboat's hull numbers and where its rig stands (Animation owner).
// Shared by the hull part, the sail part and the sailboat behaviour, so the
// boom meets the mast and the jib meets the stem by construction.

import type { Vec3 } from '@/core/mat4';
import { BOATS } from '@/style/boats';
import { hullShape, type HullSpec } from './hull';

export function sailboatSpec(): HullSpec {
  return {
    length: BOATS.sailLength,
    beam: BOATS.sailBeam,
    freeboard: 0.1,
    bowRise: 0.075,
    sternRise: 0.022,
    draft: 0.08,
    widest: 0.4,
    transom: 0.62,
    bowPoint: 1.15,
    stemRake: 0.5,
    transomRake: 0.16,
    round: 0.42,
    vee: 0.95,
    skin: 0.024,
    strake: 0.036,
    boot: 0.02,
    sole: 0.02,
    stations: 10,
  };
}

export interface Rig {
  /** Station of the mast and of the aft edge of the foredeck. */
  mastT: number;
  mastZ: number;
  mastTop: number;
  /** Where the boom meets the mast: the mainsail's frame. Its foot runs aft (−Z) from here. */
  gooseneck: Vec3;
  /** Length of the mainsail's foot and height of its luff. */
  foot: number;
  luff: number;
  /** Where the jib is tacked down: the jib's frame. Its luff leans aft by `jibSlant` and is `jibLuff` long. */
  jibTack: Vec3;
  jibSlant: number;
  jibLuff: number;
  /** The jib's clew when sheeted amidships, in the jib's own frame (y along the luff, −z aft). */
  jibClew: Vec3;
}

export function sailboatRig(): Rig {
  const hull = hullShape(sailboatSpec());
  const mastT = 0.62;
  const mastZ = hull.z(mastT, 0);
  const mastTop = BOATS.mast;
  const boomY = 0.27;
  const foot = mastZ - 0.012 - (hull.z(0, 0) + 0.09);
  const jibTack: Vec3 = [0, hull.stemHead[1] + 0.012, hull.stemHead[2] - 0.03];
  const hounds: Vec3 = [0, mastTop * 0.9, mastZ + 0.02];
  const dy = hounds[1] - jibTack[1], dz = hounds[2] - jibTack[2];
  const jibSlant = Math.atan2(-dz, dy);
  // The clew sits low, just ahead of the mast.
  const cy = boomY - 0.01 - jibTack[1], cz = mastZ + 0.05 - jibTack[2];
  const sin = Math.sin(jibSlant), cos = Math.cos(jibSlant);
  return {
    mastT,
    mastZ,
    mastTop,
    gooseneck: [0, boomY, mastZ - 0.012],
    foot,
    luff: mastTop - boomY - 0.05,
    jibTack,
    jibSlant,
    jibLuff: Math.hypot(dy, dz),
    jibClew: [0, cy * cos - cz * sin, cy * sin + cz * cos],
  };
}
