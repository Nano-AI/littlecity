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
  /** Small boats seen this frame (each that asked giveWay), for the ships to slow for. */
  small: { x: number; z: number }[];
  inPort: Set<string>;
  sounds: ShipSound[];
}

const all = new WeakMap<LifeStage, News>();

export function newsOf(stage: LifeStage): News {
  let n = all.get(stage);
  if (!n) all.set(stage, (n = { ships: [], small: [], inPort: new Set(), sounds: [] }));
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

/**
 * How a small boat at (x, z) heading `yaw` gives way to the big ships (L38–L42): `slow` (0–1) scales its
 * speed, falling to nothing as it closes on a hull ahead of it; (px, pz) is a push in columns a second,
 * away from any hull within `reach`, so it stands aside instead of waiting in a ship's way.
 */
export function giveWay(stage: LifeStage, x: number, z: number, yaw: number, reach = 2.2): { slow: number; px: number; pz: number } {
  const n = newsOf(stage);
  if (n.small.length < 64) n.small.push({ x, z });
  const ships = n.ships;
  const out = { slow: 1, px: 0, pz: 0 };
  if (!ships.length) return out;
  const hx = Math.sin(yaw), hz = Math.cos(yaw);
  for (const s of ships) {
    const near = fromHull(s, x, z);
    if (near.gap > reach + 1.5) continue;
    // The nearest point of the hull, and which way it lies from the boat.
    const sx = Math.sin(s.yaw), sz = Math.cos(s.yaw);
    const along = Math.max(s.stern, Math.min(s.bow, (x - s.x) * sx + (z - s.z) * sz));
    const nx = s.x + sx * along - x, nz = s.z + sz * along - z;
    const d = Math.hypot(nx, nz) || 1e-6;
    const ahead = (nx * hx + nz * hz) / d;
    // Closing on it (it lies ahead): slow to a stop half a column off.
    if (ahead > -0.2) out.slow = Math.min(out.slow, Math.max(0, Math.min(1, (near.gap - 0.5) / reach)));
    // And stand aside, harder the closer, harder still for a ship under way.
    if (near.gap < reach) {
      const k = (1 - Math.max(0, near.gap) / reach) * (0.25 + 0.5 * Math.min(1, s.speed));
      out.px -= (nx / d) * k;
      out.pz -= (nz / d) * k;
    }
  }
  return out;
}

/** How a ship slows for small boats in its way: 1 clear, falling to 0 for one right under its bow. */
export function clearAhead(s: BigShipNews, boats: readonly { x: number; z: number }[]): number {
  const hx = Math.sin(s.yaw), hz = Math.cos(s.yaw);
  let k = 1;
  for (const b of boats) {
    const dx = b.x - s.x, dz = b.z - s.z;
    const along = dx * hx + dz * hz - s.bow;
    const across = Math.abs(-dx * hz + dz * hx);
    if (along < -0.5 || along > 4 || across > s.halfBeam + 0.9) continue;
    k = Math.min(k, Math.max(0, Math.min(1, (along - 0.4) / 2.5)));
  }
  return k;
}
