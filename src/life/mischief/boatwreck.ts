// Small boats in a blast (design section 13b): rowing, sailing and fishing
// boats. Owner: Mischief. The boats' own behaviours (src/life/boats) call
// `boatPose` once a frame with the pose they are about to draw: it notes where
// the boat is (for a blast to find it) and, if a blast has hit it, puts the
// wreck's pose in its place, so everything the boat draws on its hull (sail,
// oars, rower) goes with it:
//   scorched   (the edge of a blast) it carries on; the caller draws smoke
//   swamped    (closer) it stops where it was, deck awash, listing, and drifts
//   capsized   (closest) over it goes, hull up, drifting; after a while it goes
//              under. Whoever was aboard is swimming (drawn by shipwreck.system).
// Undo or a new town forgets the wrecks: the boats are as they were.

import { SEA_Y } from '@/core/grid';
import type { Mat4 } from '@/core/mat4';
import type { LifeStage } from '../api';
import { fly } from '../motion/pose';
import { critterPose } from './critters';

/** Seconds a capsized boat floats hull up before it goes under, and how long that takes. */
const AFLOAT = 30, UNDER = 6;

export interface BoatWreck {
  stage: 1 | 2 | 3;
  /** When it was hit (signals' seconds). */
  at: number;
  x: number;
  z: number;
  yaw: number;
  /** Which way it lists or rolls over. */
  side: number;
}

interface Seen {
  type: string;
  x: number;
  z: number;
  yaw: number;
  /** Signals' seconds when last seen. */
  now: number;
}

interface Registry {
  seen: Map<string, Seen>;
  wrecks: Map<string, BoatWreck>;
  /** Boats the Hand threw down into the sea, for the wreck drawing to put their crews in the water. */
  capsized: { id: string; type: string; x: number; z: number; yaw: number }[];
}

const byStage = new WeakMap<LifeStage, Registry>();
function registry(stage: LifeStage): Registry {
  let r = byStage.get(stage);
  if (!r) byStage.set(stage, (r = { seen: new Map(), wrecks: new Map(), capsized: [] }));
  return r;
}

/** Half a boat's length and its half beam, by type. */
const SIZE: Record<string, [number, number]> = { rowboat: [0.33, 0.15], rower: [0.33, 0.15], sailboat: [0.52, 0.19], 'fishing-boat': [0.6, 0.24] };

/**
 * A small boat's behaviour, about to draw it at `m` (its hull's world matrix): noted for a blast to find,
 * and if wrecked, `m` is replaced by the wreck's pose. True if it is wrecked (scorched boats included).
 */
export function boatPose(stage: LifeStage, id: string, type: string, m: Mat4, now: number): boolean {
  const r = registry(stage);
  const w = r.wrecks.get(id);
  if (!w || w.stage === 1) {
    // The Hand may have it (critters.ts): lifted out of the water with whoever is aboard, thrown, dropped.
    const held = critterPose(stage, `boat:${id}`, type, m[12]!, SEA_Y, m[14]!, Math.atan2(m[8]!, m[10]!), 0.22, 1);
    if (held) {
      for (let i = 0; i < 16; i++) m[i] = held[i]!;
      return true;
    }
  }
  if (!w) {
    r.seen.set(id, { type, x: m[12]!, z: m[14]!, yaw: Math.atan2(m[8]!, m[10]!), now });
    return false;
  }
  if (w.stage === 1) return true;
  const t = Math.max(0, now - w.at);
  // Drifting off a little where it was hit.
  const drift = Math.min(1.2, t * 0.04);
  const x = w.x + Math.sin(w.yaw + 1.2) * drift, z = w.z + Math.cos(w.yaw + 1.2) * drift;
  const bob = Math.sin(now * 1.7 + w.x) * 0.012;
  if (w.stage === 2) {
    // Swamped: deck awash, listing.
    fly(x, SEA_Y - 0.1 + bob, z, w.yaw + drift * 0.3, 0.04, w.side * 0.28, 1, m);
    return true;
  }
  // Capsized: over it goes (a second), then hull up, then under.
  const over = Math.min(1, t / 0.9);
  const under = t < AFLOAT ? 0 : Math.min(1, (t - AFLOAT) / UNDER);
  fly(x, SEA_Y + 0.06 * over - 0.04 + bob - 1.6 * under * under, z, w.yaw + drift * 0.3, 0.05, w.side * Math.PI * (over * over * (3 - 2 * over)), 1, m);
  return true;
}

/** A blast at (x, z) reaching r3 (capsizes), r2 (swamps) and r1 (scorches): the boats it hurt, worse off than before. */
export function strikeBoats(stage: LifeStage, x: number, z: number, now: number, r3: number, r2: number, r1: number): { id: string; type: string; stage: 1 | 2 | 3; x: number; z: number; yaw: number }[] {
  const r = registry(stage);
  const out: { id: string; type: string; stage: 1 | 2 | 3; x: number; z: number; yaw: number }[] = [];
  for (const [id, s] of r.seen) {
    // Seen lately (a boat no longer drawn is not hit).
    if (now - s.now > 1) continue;
    const [half, beam] = SIZE[s.type] ?? SIZE.rowboat!;
    const sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
    const along = Math.max(-half, Math.min(half, (x - s.x) * sin + (z - s.z) * cos));
    const d = Math.max(0, Math.hypot(x - (s.x + sin * along), z - (s.z + cos * along)) - beam);
    const stage3: 0 | 1 | 2 | 3 = d <= r3 ? 3 : d <= r2 ? 2 : d <= r1 ? 1 : 0;
    const was = r.wrecks.get(id);
    if (stage3 === 0 || (was && was.stage >= stage3)) continue;
    const side = (x - s.x) * cos - (z - s.z) * sin > 0 ? -1 : 1;
    r.wrecks.set(id, { stage: stage3, at: now, x: was?.x ?? s.x, z: was?.z ?? s.z, yaw: was?.yaw ?? s.yaw, side });
    out.push({ id, type: s.type, stage: stage3, x: s.x, z: s.z, yaw: s.yaw });
  }
  return out;
}

/** The small boat nearest (x, z) within `reach`, seen lately and not wrecked past scorching: where it is. */
export function boatNear(stage: LifeStage, x: number, z: number, reach: number, now: number): { x: number; z: number } | null {
  const r = registry(stage);
  let best: { x: number; z: number; d: number } | null = null;
  for (const [id, s] of r.seen) {
    if (now - s.now > 1 || (r.wrecks.get(id)?.stage ?? 0) > 1) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= reach && (!best || d < best.d)) best = { x: s.x, z: s.z, d };
  }
  return best;
}

/** Where a small boat was last drawn (its wreck's place if wrecked past scorching), or null. */
export function boatAt(stage: LifeStage, id: string): { x: number; z: number; y: number } | null {
  const r = registry(stage);
  const w = r.wrecks.get(id);
  if (w && w.stage > 1) return { x: w.x, z: w.z, y: SEA_Y };
  const s = r.seen.get(id);
  return s ? { x: s.x, z: s.z, y: SEA_Y } : null;
}

/** A small boat thrown down hard into the sea (the Hand): it capsizes where it lands. */
export function capsizeBoat(stage: LifeStage, id: string, x: number, z: number, yaw: number, now: number): void {
  const r = registry(stage);
  r.wrecks.set(id, { stage: 3, at: now, x, z, yaw, side: 1 });
  r.capsized.push({ id, type: r.seen.get(id)?.type ?? 'rowboat', x, z, yaw });
}

/** The boats thrown over since last asked (shipwreck.system puts their crews in the water). */
export function takeCapsized(stage: LifeStage): { id: string; type: string; x: number; z: number; yaw: number }[] {
  const r = registry(stage);
  const out = r.capsized;
  r.capsized = [];
  return out;
}

/** Undo, or a different town: no boat is wrecked any more. */
export function forgetBoatWrecks(stage: LifeStage): void {
  registry(stage).wrecks.clear();
}

/** The wrecks now (for tests and the drawing of smoke). */
export function boatWrecksOf(stage: LifeStage): ReadonlyMap<string, BoatWreck> {
  return registry(stage).wrecks;
}
