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

import { SIZE_X as SIZE } from '@/core/grid';
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

/** A small boat's footprint, as its behaviour last drew it. */
export interface Float extends BigShipNews {
  /** The frame it was seen in (stale ones are gone). */
  seen: number;
}

/** Hull sizes of the small boats, for keeping clear (half a column of slack is in the give-way reach). */
export const SMALL_HULLS: Record<string, { stern: number; bow: number; halfBeam: number }> = {
  rowboat: { stern: -0.33, bow: 0.33, halfBeam: 0.15 },
  rower: { stern: -0.33, bow: 0.33, halfBeam: 0.15 },
  sailboat: { stern: -0.5, bow: 0.52, halfBeam: 0.19 },
  'fishing-boat': { stern: -0.6, bow: 0.6, halfBeam: 0.24 },
};

interface News {
  ships: BigShipNews[];
  /** Every small boat afloat, by id (moored, rowing, sailing, being rowed away). */
  floats: Map<string, Float>;
  /** Frames counted by the harbour (a float not seen this frame or the last is gone). */
  tick: number;
  /** The stretches of quay a big ship is taking now (coming in, alongside, casting off): hull-shaped zones. */
  zones: BigShipNews[];
  /** Small boats seen this frame (each that asked giveWay), for the ships to slow for. */
  small: { x: number; z: number }[];
  inPort: Set<string>;
  sounds: ShipSound[];
}

const all = new WeakMap<LifeStage, News>();

export function newsOf(stage: LifeStage): News {
  let n = all.get(stage);
  if (!n) all.set(stage, (n = { ships: [], floats: new Map(), tick: 0, zones: [], small: [], inPort: new Set(), sounds: [] }));
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

/** A small boat says where it is (every frame it is drawn). */
export function noteFloat(stage: LifeStage, id: string, type: string, x: number, z: number, yaw: number, speed = 0): void {
  const size = SMALL_HULLS[type] ?? SMALL_HULLS.rowboat!;
  const n = newsOf(stage);
  n.floats.set(id, { x, z, yaw, stern: size.stern, bow: size.bow, halfBeam: size.halfBeam, speed, seen: n.tick });
}

/** The small boats afloat now (seen this frame or the last), with their ids. */
export function floatsOf(stage: LifeStage): [string, Float][] {
  const n = all.get(stage);
  if (!n) return [];
  const out: [string, Float][] = [];
  for (const [id, f] of n.floats) {
    if (f.seen >= n.tick - 1) out.push([id, f]);
    else if (f.seen < n.tick - 120) n.floats.delete(id);
  }
  return out;
}

/** Points along every small boat's hull (for a big ship or the barge to slow for one under its bow). */
export function floatPoints(stage: LifeStage): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (const [, f] of floatsOf(stage)) {
    const sx = Math.sin(f.yaw), cz = Math.cos(f.yaw);
    for (const a of [f.stern, 0, f.bow]) out.push({ x: f.x + sx * a, z: f.z + cz * a });
  }
  return out;
}

/**
 * How a small boat at (x, z) heading `yaw` gives way to the big ships (L38–L42): `slow` (0–1) scales its
 * speed, falling to nothing as it closes on a hull ahead of it; (px, pz) is a push in columns a second,
 * away from any hull within `reach`, so it stands aside instead of waiting in a ship's way.
 */
export function giveWay(stage: LifeStage, x: number, z: number, yaw: number, reach = 2.8, self = ''): { slow: number; px: number; pz: number } {
  const n = newsOf(stage);
  const out = { slow: 1, px: 0, pz: 0 };
  const hx = Math.sin(yaw), hz = Math.cos(yaw);
  // How far its own hull reaches from its middle (the gaps below are measured from there).
  const me = n.floats.get(self);
  const own = me ? Math.max(me.bow, -me.stern) : 0.35;
  // Other small boats: closer in, gentler (two small boats both stand aside and pass).
  for (const [id, f] of floatsOf(stage)) {
    if (id === self) continue;
    const near = fromHull(f, x, z);
    near.gap -= own - 0.35;
    if (near.gap > 1.4) continue;
    const sx = Math.sin(f.yaw), cz = Math.cos(f.yaw);
    const along = Math.max(f.stern, Math.min(f.bow, (x - f.x) * sx + (z - f.z) * cz));
    const nx = f.x + sx * along - x, nz = f.z + cz * along - z;
    const d = Math.hypot(nx, nz) || 1e-6;
    if ((nx * hx + nz * hz) / d > 0.2) out.slow = Math.min(out.slow, Math.max(0, Math.min(1, (near.gap - 0.45) / 0.9)));
    if (near.gap < 1.2) {
      const k = (1 - Math.max(0, near.gap) / 1.2) * 0.5;
      out.px -= (nx / d) * k;
      out.pz -= (nz / d) * k;
    }
  }
  const ships = n.ships;
  if (!ships.length) return out;
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
    if (ahead > -0.2) out.slow = Math.min(out.slow, Math.max(0, Math.min(1, (near.gap - 0.55 - own) / reach)));
    // And stand aside, harder the closer, harder still for a ship under way.
    if (near.gap < reach) {
      const k = (1 - Math.max(0, near.gap) / reach) * (0.45 + 0.6 * Math.min(1, s.speed));
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

/** The zone of a big ship's berth (stretch of quay and the water off it) that covers (x, z), if any. */
export function berthZoneAt(stage: LifeStage, x: number, z: number): BigShipNews | null {
  for (const s of all.get(stage)?.zones ?? []) if (fromHull(s, x, z).gap < 0) return s;
  return null;
}

const offsets = new WeakMap<object, { x: number; z: number }>();
/**
 * A small boat at (x, z) heading `yaw` standing aside for the big ships: where to draw it (its place pushed
 * out of a ship's way, easing back once the ship has passed) and how much to slow. `owner` is any object
 * that lives as long as the boat (its behaviour state).
 */
export function standAside(stage: LifeStage, owner: object, x: number, z: number, yaw: number, dt: number, self = ''): { x: number; z: number; slow: number } {
  let off = offsets.get(owner);
  if (!off) offsets.set(owner, (off = { x: 0, z: 0 }));
  const g = giveWay(stage, x + off.x, z + off.z, yaw, 2.8, self);
  if (g.px !== 0 || g.pz !== 0) {
    off.x += g.px * dt;
    off.z += g.pz * dt;
    // Never out over the edge of the map: it stands aside along it instead.
    const lo = 0.8, hi = SIZE - 0.8;
    off.x = Math.min(hi - x, Math.max(lo - x, off.x));
    off.z = Math.min(hi - z, Math.max(lo - z, off.z));
  } else {
    const k = Math.min(1, dt * 0.6);
    off.x -= off.x * k;
    off.z -= off.z * k;
  }
  return { x: x + off.x, z: z + off.z, slow: g.slow };
}
