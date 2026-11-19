// The rider (L37): one mounted rider of the garrison, who leaves by the gate
// a few times a day, trots along the streets to the square, crosses it and
// comes back, walking the horse wherever people are about. Between rides
// the horse stands tethered by the gate, flicking its tail. Pure: no drawing,
// no clock of its own (garrison.system.ts draws it; rider.test.ts steps it).
//
// The ride is a track (track.ts) gate → square → across it → gate, out of
// doors all the way. The horse never turns on the spot: it slows to a walk
// into a sharp turn (its speed falls with how far its heading is off the
// track's), and its heading follows the track at a horse's turning rate.

import { CELL_H, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import { rand } from '@/core/rand';
import type { TimeSignal } from '@/life/api';
import type { NavGraph } from '@/resolve/plan';
import type { Castle } from '@/rules/life/castle.lib';
import { RIDER } from '@/style/people';
import type { Router } from './route';
import { outdoorRoute, trackAt, trackOf, type Track, type TrackPoint } from './track';
import type { Gait } from '@/parts/people/horse';

export interface Ride {
  readonly track: Track | null;
  /** On a ride, or tethered by the gate. */
  readonly riding: boolean;
  /** How far along the ride (world units). */
  readonly s: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  gait: Gait;
  /** Stride phase (rides) or seconds (standing). */
  phase: number;
  node: number;
  /** Rides finished. */
  readonly rides: number;
  step(dt: number, time: TimeSignal, crowded: (x: number, z: number, dx: number, dz: number) => boolean): void;
}

const TURN = 2.6; // radians a second

/**
 * The ride from a castle's gate to a square and back. `squares` are graph nodes of the town's squares
 * (haunt-square sockets): the ride goes to the nearest it can reach out of doors, crosses to the far side of
 * that square, and comes home.
 */
export function rideOf(nav: NavGraph, router: Router, castle: Castle, squares: readonly number[]): Track | null {
  const gate = castle.gate?.node;
  if (gate === undefined) return null;
  const gc = nav.nodes[gate]!.cell;
  // Only where a street leads from the gate (its own cell or one beside it); else the horse stays tethered.
  const onStreet = (n: number): boolean => nav.nodes[n]!.surface === 'path' || nav.nodes[n]!.surface === 'plaza';
  let street = onStreet(gate);
  for (let k = nav.linkStart[gate]!; k < nav.linkStart[gate + 1]! && !street; k++) {
    const l = nav.links[nav.linkOf[k]!]!;
    street = onStreet(l.a === gate ? l.b : l.a);
  }
  if (!street) return null;
  const dist = (n: number): number => Math.abs(keyX(nav.nodes[n]!.cell) - keyX(gc)) + Math.abs(keyZ(nav.nodes[n]!.cell) - keyZ(gc));
  const order = [...squares].filter((n) => nav.part[n] === nav.part[gate]).sort((a, b) => dist(a) - dist(b) || a - b);
  for (const a of order.slice(0, 6)) {
    const way = outdoorRoute(nav, router, gate, a);
    if (!way || way.nodes.length < 4) continue;
    // The horse is tethered a cell out from the gate (clear of the troop, which halts at the gate itself):
    // every ride starts and ends there.
    const tether = way.nodes[1]!;
    const there = outdoorRoute(nav, router, tether, a);
    if (!there) continue;
    // Across the square: the square cell farthest from where it came in that it can ride to.
    const ca = nav.nodes[a]!.cell;
    const across = order
      .filter((b) => b !== a && Math.abs(keyX(nav.nodes[b]!.cell) - keyX(ca)) + Math.abs(keyZ(nav.nodes[b]!.cell) - keyZ(ca)) <= 6)
      .sort((p, q) => dist(q) - dist(p) || p - q)[0];
    const cross = across !== undefined ? outdoorRoute(nav, router, a, across) : null;
    const end = cross ? across! : a;
    const back = outdoorRoute(nav, router, end, tether);
    if (!back) continue;
    const t = trackOf(nav, cross ? [there, cross, back] : [there, back], false);
    if (t) return t;
  }
  return streetRide(nav, router, gate);
}

/** No square to ride to: along the street from the gate to its far end, or the first crossing a few cells on, and back. */
function streetRide(nav: NavGraph, router: Router, gate: number): Track | null {
  const street = (n: number): boolean => nav.nodes[n]!.surface === 'path' || nav.nodes[n]!.surface === 'plaza';
  const next = (n: number): number[] => {
    const out: number[] = [];
    for (let k = nav.linkStart[n]!; k < nav.linkStart[n + 1]!; k++) {
      const l = nav.links[nav.linkOf[k]!]!;
      if (l.via === 'interior') continue;
      const m = l.a === n ? l.b : l.a;
      if (street(m)) out.push(m);
    }
    return out.sort((a, b) => a - b);
  };
  // Breadth-first along street cells from the gate (or the street beside it).
  const start = street(gate) ? gate : next(gate)[0];
  if (start === undefined) return null;
  const depth = new Map<number, number>([[start, 0]]);
  const queue = [start];
  let far = start;
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h]!;
    const d = depth.get(u)!;
    if (d > depth.get(far)!) far = u;
    // A crossing four or more cells on is far enough.
    if (d >= 4 && next(u).length >= 3) {
      far = u;
      break;
    }
    if (d >= 14) continue;
    for (const v of next(u)) {
      if (depth.has(v)) continue;
      depth.set(v, d + 1);
      queue.push(v);
    }
  }
  if (depth.get(far)! < 3) return null;
  const way = outdoorRoute(nav, router, gate, far);
  if (!way || way.nodes.length < 4) return null;
  const tether = way.nodes[1]!;
  const there = outdoorRoute(nav, router, tether, far);
  const back = outdoorRoute(nav, router, far, tether);
  return there && back ? trackOf(nav, [there, back], false) : null;
}

/** Where the horse stands when it has nowhere to ride: a cell out from the gate. */
export function tetherOf(nav: NavGraph, castle: Castle): { x: number; y: number; z: number; node: number } | null {
  const gate = castle.gate;
  if (!gate) return null;
  const c = nav.nodes[gate.node]!.cell;
  const x = keyX(c) + gate.dx, z = keyZ(c) + gate.dz;
  const out = x >= 0 && z >= 0 && x < SIZE_X && z < SIZE_Z ? nav.nodeAt.get(key(x, keyY(c), z)) : undefined;
  const node = out ?? gate.node;
  const cell = nav.nodes[node]!.cell;
  return { x: keyX(cell) + 0.5, y: keyY(cell) * CELL_H, z: keyZ(cell) + 0.5, node };
}

export function createRide(castle: Castle, track: Track | null, seed: number, time: TimeSignal, tether: { x: number; y: number; z: number; node: number } | null = null): Ride {
  const gate = castle.gate!;
  const pt: TrackPoint = { x: 0, y: 0, z: 0, dx: 0, dz: 1, node: -1 };
  // Tethered beside the gate, side on to it.
  const rest = (): void => {
    if (!track) {
      // Nowhere to ride: it stands by the gate all day.
      if (tether) [ride.x, ride.y, ride.z, ride.node] = [tether.x, tether.y, tether.z, tether.node];
      return;
    }
    trackAt(track, 0, pt);
    ride.x = pt.x;
    ride.z = pt.z;
    ride.y = pt.y;
    ride.node = pt.node;
  };
  let s = 0;
  let riding = false;
  let speed = 0;
  let rides = 0;
  let wait = 8 + rand(seed, 'first-ride') * 30;
  const ride: Ride = {
    get track() {
      return track;
    },
    get riding() {
      return riding;
    },
    get s() {
      return s;
    },
    get rides() {
      return rides;
    },
    x: 0,
    y: 0,
    z: 0,
    heading: Math.atan2(-gate.dx, -gate.dz), // tethered facing the gate
    gait: 'stand',
    phase: 0,
    node: -1,
    step(dt, now, crowded) {
      if (!track) {
        ride.gait = 'stand';
        ride.phase += dt;
        return;
      }
      if (!riding) {
        ride.gait = 'stand';
        ride.phase += dt;
        // Rides by day only, a few a day (RIDER.rides in the 4.5 minutes of day).
        if (now.isDay) wait -= dt;
        if (wait <= 0 && now.isDay) {
          riding = true;
          s = 0;
          speed = 0;
          ride.phase = 0;
        }
        rest();
        return;
      }
      trackAt(track, s, pt);
      const want = Math.atan2(pt.dx, pt.dz);
      let d = want - ride.heading;
      d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
      ride.heading += Math.max(-TURN * dt, Math.min(TURN * dt, d));
      // Into a sharp turn at a walk, through a crowd at a walk, and otherwise at a trot.
      const busy = crowded(pt.x, pt.z, Math.sin(ride.heading), Math.cos(ride.heading));
      const top = busy || s < 0.6 || track.length - s < 0.8 ? RIDER.walk : RIDER.trot;
      const target = top * Math.max(0.12, Math.cos(Math.min(Math.PI / 2, Math.abs(d))));
      speed += (target - speed) * Math.min(1, dt * 3);
      const go = speed * dt;
      s += go;
      ride.gait = speed > (RIDER.walk + RIDER.trot) / 2 ? 'trot' : 'walk';
      ride.phase += go / (ride.gait === 'trot' ? 1 / RIDER.trotSteps : 1 / RIDER.walkSteps);
      if (s >= track.length) {
        riding = false;
        rides++;
        wait = (270 / Math.max(1, RIDER.rides)) * (0.6 + 0.4 * rand(seed, 'ride', rides)) - track.length / RIDER.trot;
        wait = Math.max(20, wait);
        ride.phase = 0;
        // It stands where the ride ended, facing the way it came home.
        rest();
        return;
      }
      trackAt(track, s, pt);
      ride.x = pt.x;
      ride.y = pt.y;
      ride.z = pt.z;
      ride.node = pt.node;
    },
  };
  // A town opened by day may find the rider already out.
  if (track && time.isDay && rand(seed, 'out-at-start') < 0.3) {
    riding = true;
    s = rand(seed, 'out-at') * track.length * 0.8;
    speed = RIDER.walk;
    trackAt(track, s, pt);
    ride.x = pt.x;
    ride.y = pt.y;
    ride.z = pt.z;
    ride.node = pt.node;
    ride.heading = Math.atan2(pt.dx, pt.dz);
  } else rest();
  return ride;
}
