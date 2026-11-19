// What the harbour tells the rest of the town (L38–L42), per stage:
//
//   bigShipsOf(stage)    every big ship on the water now: where its hull is,
//                        which way it heads, whether it is under way. The
//                        small boats read it to give way.
//   shipInFor(stage, id) whether the ship of a call is in (alongside, or
//                        coming or going at the quay): the crowd sends
//                        residents to the quay to watch only then.
//   shipSoundsOf(stage)  a queue of sounds (a bell as a ship comes in, a
//                        creak of timber and rope as it casts off) for the
//                        sound system to play and empty.

import type { LifeStage } from '../api';

export interface BigShipNews {
  x: number;
  z: number;
  /** Heading (yaw) and the hull's extent along it from (x, z), and half its beam. */
  yaw: number;
  stern: number;
  bow: number;
  halfBeam: number;
  /** Columns a second. */
  speed: number;
}

export interface ShipSound {
  kind: 'bell' | 'creak';
  x: number;
  z: number;
}

interface News {
  ships: BigShipNews[];
  inPort: Set<string>;
  sounds: ShipSound[];
}

const all = new WeakMap<LifeStage, News>();

export function newsOf(stage: LifeStage): News {
  let n = all.get(stage);
  if (!n) all.set(stage, (n = { ships: [], inPort: new Set(), sounds: [] }));
  return n;
}

export function bigShipsOf(stage: LifeStage): readonly BigShipNews[] {
  return all.get(stage)?.ships ?? [];
}

export function shipInFor(stage: LifeStage, callId: string): boolean {
  return all.get(stage)?.inPort.has(callId) ?? false;
}

/** Takes the sounds waiting to be played (the queue is emptied). */
export function shipSoundsOf(stage: LifeStage): ShipSound[] {
  const n = all.get(stage);
  if (!n || !n.sounds.length) return [];
  const out = n.sounds;
  n.sounds = [];
  return out;
}

/**
 * How far a point is from a ship's hull (a line from stern to bow, `halfBeam` wide), and how far ahead of
 * its bow along its heading (negative: abeam or astern).
 */
export function fromHull(s: BigShipNews, x: number, z: number): { gap: number; ahead: number } {
  const hx = Math.sin(s.yaw), hz = Math.cos(s.yaw);
  const dx = x - s.x, dz = z - s.z;
  const along = dx * hx + dz * hz;
  const across = Math.abs(-dx * hz + dz * hx);
  const a = Math.max(s.stern, Math.min(s.bow, along));
  return { gap: Math.hypot(along - a, across) - s.halfBeam, ahead: along - s.bow };
}
