// The garrison (L36): a troop of soldiers marching in step, in a column of
// twos, on a patrol round the outside of a castle's walls. Pure: no drawing,
// no clock of its own (garrison.system.ts draws it; troop.test.ts steps it).
//
// The column is one body on a track (track.ts). Its rows stand GARRISON.spacing
// apart along the track and its two files GARRISON.file either side of it,
// so at a corner the inner file wheels tight and the outer file wide, and
// nobody turns on the spot. Everybody's stride comes from the distance the
// column has marched: they are in step.
//
//   march    round the patrol (a loop, or there and back along one side)
//   halt     at the gate, facing out, for a few seconds each lap; longer at
//            dawn and dusk, when the guard is changed (the files face each
//            other, then front again)
//   night    the front pair stays at the gate as sentries with torches; the
//            rest walk in through the gate and stand inside until dawn
//
// Where no loop can be walked round the walls, the patrol is there and back
// along the longest side that can: at each end the column halts, about-turns
// where it stands, and marches back.

import { columnIndex, inColumnBounds, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import type { TimeSignal } from '@/life/api';
import { castleCentre, type Castle } from '@/rules/life/castle.lib';
import type { NavGraph } from '@/resolve/plan';
import { GARRISON, PERSON } from '@/style/people';
import type { Route } from './route';
import { nearestOnTrack, trackAt, trackOf, type Track, type TrackPoint } from './track';

export interface Soldier {
  /** 0, 1 the front pair (the sentries at night), and so on back. */
  index: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pose: 'walk' | 'stand';
  stride: number;
  /** Holding a lit torch (a sentry at night). */
  torch: boolean;
  visible: boolean;
  /** Graph node of the cell they stand in. */
  node: number;
}

export type TroopMode = 'march' | 'halt' | 'in' | 'night' | 'out';

export interface Troop {
  readonly soldiers: readonly Soldier[];
  readonly track: Track;
  readonly mode: TroopMode;
  /** Arc length of the gate on the track. */
  readonly gateAt: number;
  /** Where the column's rear row is on the track; it marches toward +s when `sense` is 1. */
  readonly s: number;
  readonly sense: 1 | -1;
  /** Where the column last halted: at the gate, or at an end of a there-and-back. */
  readonly haltedAt: 'gate' | 'end' | null;
  step(dt: number, time: TimeSignal): void;
}

const p = (): TrackPoint => ({ x: 0, y: 0, z: 0, dx: 0, dz: 1, node: -1 });

/** How far out from its walls a castle's patrol may go, in cells. */
const RING = 3;

/**
 * The patrol: round the outside of the castle's footprint, keeping within RING cells of it; or, where no
 * loop can be walked, there and back along the longest stretch of that ring through the gate.
 */
export function patrolOf(nav: NavGraph, castle: Castle): Track | null {
  // Columns outside the castle (reached from the map's edge without crossing it).
  const out = new Uint8Array(SIZE_X * SIZE_Z);
  const stack: number[] = [];
  for (let x = 0; x < SIZE_X; x++) for (const z of [0, SIZE_Z - 1]) stack.push(columnIndex(x, z));
  for (let z = 0; z < SIZE_Z; z++) for (const x of [0, SIZE_X - 1]) stack.push(columnIndex(x, z));
  while (stack.length > 0) {
    const k = stack.pop()!;
    if (out[k] || castle.columns.has(k)) continue;
    out[k] = 1;
    const x = k % SIZE_X, z = Math.floor(k / SIZE_X);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (inColumnBounds(x + dx, z + dz)) stack.push(columnIndex(x + dx, z + dz));
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const k of castle.columns) {
    x0 = Math.min(x0, k % SIZE_X);
    x1 = Math.max(x1, k % SIZE_X);
    z0 = Math.min(z0, Math.floor(k / SIZE_X));
    z1 = Math.max(z1, Math.floor(k / SIZE_X));
  }
  const inRing = (node: number): boolean => {
    const c = nav.nodes[node]!.cell;
    const x = keyX(c), z = keyZ(c);
    if (x < x0 - RING || x > x1 + RING || z < z0 - RING || z > z1 + RING) return false;
    return out[columnIndex(x, z)] === 1;
  };
  /** Breadth-first within the ring: the path from a to b, or null. */
  const search = (a: number, b: number): Route | null => {
    const from = new Int32Array(nav.nodes.length).fill(-2);
    const via = new Int32Array(nav.nodes.length).fill(-1);
    const queue = [a];
    from[a] = -1;
    for (let h = 0; h < queue.length; h++) {
      const u = queue[h]!;
      if (u === b) break;
      for (let k = nav.linkStart[u]!; k < nav.linkStart[u + 1]!; k++) {
        const li = nav.linkOf[k]!, l = nav.links[li]!;
        if (l.via === 'interior') continue;
        const v = l.a === u ? l.b : l.a;
        if (from[v] !== -2 || !inRing(v)) continue;
        from[v] = u;
        via[v] = li;
        queue.push(v);
      }
    }
    if (from[b] === -2) return null;
    const nodes: number[] = [], links: number[] = [];
    for (let v = b; v !== -1; v = from[v]!) {
      nodes.push(v);
      if (from[v]! >= 0) links.push(via[v]!);
    }
    return { nodes: nodes.reverse(), links: links.reverse(), cost: nodes.length };
  };
  const gate = castle.gate && inRing(castle.gate.node) ? castle.gate.node : -1;
  // The four corners just outside, each the nearest ring node (on the gate's side of the town).
  const corners = [[x0 - 1, z0 - 1], [x1 + 1, z0 - 1], [x1 + 1, z1 + 1], [x0 - 1, z1 + 1]].map(([cx, cz]) => {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < nav.nodes.length; i++) {
      const n = nav.nodes[i]!;
      if (n.rot !== undefined || n.passage !== undefined || !inRing(i)) continue;
      if (gate >= 0 && nav.part[i] !== nav.part[gate]) continue;
      const d = Math.hypot(keyX(n.cell) - cx!, keyZ(n.cell) - cz!) + (n.clutter ? 1 : 0);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  });
  const legs = [0, 1, 2, 3].map((i) => {
    const a = corners[i]!, b = corners[(i + 1) % 4]!;
    return a >= 0 && b >= 0 && a !== b ? search(a, b) : null;
  });
  if (legs.every((l) => l !== null)) {
    // A loop only if it really goes round: no leg doubles back over another.
    const seen = new Set<number>();
    let doubled = 0;
    for (const l of legs) {
      for (const n of l!.nodes.slice(1)) {
        if (seen.has(n)) doubled++;
        seen.add(n);
      }
    }
    if (doubled === 0) {
      const loop = trackOf(nav, legs, true);
      if (loop) return loop;
    }
  }
  // There and back: the longest stretch of the ring, through the gate where it can be.
  const start = gate >= 0 ? gate : (corners.find((c) => c >= 0) ?? -1);
  if (start < 0) return null;
  const far = (from: number): number => {
    let best = from, bestLen = 0;
    for (let i = 0; i < nav.nodes.length; i++) {
      if (!inRing(i) || nav.part[i] !== nav.part[from]) continue;
      const r = search(from, i);
      if (r && r.nodes.length > bestLen) {
        bestLen = r.nodes.length;
        best = i;
      }
    }
    return best;
  };
  const a = far(start);
  const b = far(a);
  // (The column halts where it passes nearest the gate.)
  return trackOf(nav, [search(a, b)], false);
}

export function createTroop(nav: NavGraph, castle: Castle, track: Track, time: TimeSignal): Troop {
  const n = castle.troop;
  const rows = Math.ceil(n / 2);
  const centre = castleCentre(castle);
  const gate = castle.gate;
  const gx = gate ? keyX(nav.nodes[gate.node]!.cell) + 0.5 : centre.x, gz = gate ? keyZ(nav.nodes[gate.node]!.cell) + 0.5 : centre.z;
  const gateAt = nearestOnTrack(track, gx, gz);
  // The gate faces out of the castle.
  const outX = gate?.dx ?? 0, outZ = gate?.dz ?? 1;
  // In through the gate for the night: from the gate node two cells inward, if the graph goes there.
  const inward = ((): Track | null => {
    if (!gate) return null;
    const nodes = [gate.node];
    const links: number[] = [];
    for (let k = 0; k < 3; k++) {
      const a = nodes[nodes.length - 1]!;
      const c = nav.nodes[a]!.cell;
      if (!inColumnBounds(keyX(c) - outX, keyZ(c) - outZ)) break;
      const b = nav.nodeAt.get(c - outX - outZ * 64);
      if (b === undefined) break;
      let link = -1;
      for (let i = nav.linkStart[a]!; i < nav.linkStart[a + 1]!; i++) {
        const l = nav.links[nav.linkOf[i]!]!;
        if (l.via !== 'interior' && ((l.a === a && l.b === b) || (l.b === a && l.a === b))) link = nav.linkOf[i]!;
      }
      if (link < 0) break;
      nodes.push(b);
      links.push(link);
    }
    // Through the gate and at least a cell beyond it.
    return nodes.length >= 3 ? trackOf(nav, [{ nodes, links, cost: 0 }], false) : null;
  })();

  const soldiers: Soldier[] = [];
  for (let i = 0; i < n; i++) soldiers.push({ index: i, x: 0, y: 0, z: 0, heading: 0, pose: 'stand', stride: 0, torch: false, visible: true, node: -1 });

  let mode: TroopMode = 'march';
  let s = track.loop ? gateAt + 1.2 : 0.5; // the rear row
  let sense: 1 | -1 = 1;
  let timer = 0;
  let marched = 0;
  let sinceHalt = 10;
  let haltedAt: 'gate' | 'end' | null = null;
  let part = time.part;
  /** Per soldier: how far along the inward track (night). */
  const along = new Array<number>(n).fill(0);
  const pt = p(), q = p();
  const span = (rows - 1) * GARRISON.spacing;

  const place = (): void => {
    for (const sd of soldiers) {
      const row = sd.index >> 1, file = sd.index & 1 ? 1 : -1;
      if ((mode === 'in' || mode === 'night' || mode === 'out') && inward && sd.index >= 2) {
        // Single file in through the gate: each on the inward track, spaced out.
        trackAt(inward, along[sd.index]!, pt);
        sd.x = pt.x;
        sd.y = pt.y;
        sd.z = pt.z;
        sd.node = pt.node;
        continue;
      }
      // Front row leads: with sense 1 the front is at s + span.
      // The right-hand file marches a little behind the left, so from any quarter the two files read as
      // separate figures (dead behind a column of twos, each pair would be one blot).
      const behind = file === 1 ? GARRISON.stagger : 0;
      const at = (sense === 1 ? s + span - row * GARRISON.spacing : s + row * GARRISON.spacing) - sense * behind;
      trackAt(track, at, pt);
      // Right of the line of march is (−dz, dx) when facing (dx, dz); the files sit either side.
      const rx = -pt.dz * sense, rz = pt.dx * sense;
      sd.x = pt.x + rx * GARRISON.file * file;
      sd.y = pt.y;
      sd.z = pt.z + rz * GARRISON.file * file;
      sd.node = nav.nodeAt.get(key(Math.floor(sd.x), keyY(nav.nodes[pt.node]!.cell), Math.floor(sd.z))) ?? pt.node;
      if (mode === 'march' || mode === 'out') sd.heading = Math.atan2(pt.dx * sense, pt.dz * sense);
    }
  };

  const troop: Troop = {
    soldiers,
    track,
    get mode() {
      return mode;
    },
    gateAt,
    get s() {
      return s;
    },
    get haltedAt() {
      return haltedAt;
    },
    get sense() {
      return sense;
    },
    step(dt, now) {
      const night = now.isNight;
      const changing = now.part !== part && (now.part === 'dawn' || now.part === 'dusk');
      if (now.part !== part) part = now.part;
      timer -= dt;
      const mid = (): number => s + span / 2;
      const atGate = (): boolean => {
        const d = track.loop ? (((mid() - gateAt) % track.length) + track.length) % track.length : Math.abs(mid() - gateAt);
        return track.loop ? d < 0.05 || d > track.length - 0.05 : d < 0.05;
      };
      switch (mode) {
        case 'march': {
          const go = GARRISON.speed * dt;
          // Halt with the middle of the column at the gate: once a lap (or a pass), and at dusk and night.
          const d = track.loop ? (((gateAt - mid()) % track.length) + track.length) % track.length : (gateAt - mid()) * sense;
          if (gate && d >= 0 && d <= go && (sinceHalt > Math.min(3, track.length / 2) || night)) {
            s += d * sense;
            marched += d;
            sinceHalt = 0;
            mode = 'halt';
            haltedAt = 'gate';
            timer = changing || now.isDusk ? GARRISON.changeHalt : GARRISON.halt;
            break;
          }
          if (!track.loop) {
            const end = sense === 1 ? track.length - span : 0;
            if ((end - s) * sense <= go) {
              marched += Math.abs(end - s);
              s = end;
              sinceHalt = 0;
              mode = 'halt';
              haltedAt = 'end';
              timer = GARRISON.endHalt;
              sense = sense === 1 ? -1 : 1; // about turn where they stand, once halted
              break;
            }
          }
          s += go * sense;
          marched += go;
          sinceHalt += go;
          if (track.loop) s = ((s % track.length) + track.length) % track.length;
          break;
        }
        case 'halt':
          if (night && atGate()) {
            mode = 'in';
            along.fill(0);
          } else if (timer <= 0) mode = 'march';
          if (changing) timer = Math.max(timer, GARRISON.changeHalt);
          break;
        case 'in': {
          let done = true;
          for (const sd of soldiers) {
            if (sd.index < 2 || !inward) continue;
            const want = Math.max(0.2, inward.length - 0.2 - (sd.index - 2) * GARRISON.spacing);
            // They file in one after another, the rear first.
            if (along[sd.index]! < want) {
              along[sd.index] = Math.min(want, along[sd.index]! + GARRISON.speed * dt);
              done = false;
            }
          }
          if (done) mode = 'night';
          break;
        }
        case 'night':
          if (!night) mode = 'out';
          break;
        case 'out': {
          let done = true;
          for (const sd of soldiers) {
            if (sd.index < 2 || !inward) continue;
            if (along[sd.index]! > 0) {
              along[sd.index] = Math.max(0, along[sd.index]! - GARRISON.speed * dt);
              done = false;
            }
          }
          if (done) {
            mode = 'halt';
            haltedAt = 'gate';
            timer = GARRISON.changeHalt;
          }
          break;
        }
      }
      place();
      const marching = mode === 'march';
      for (const sd of soldiers) {
        sd.torch = night && sd.index < 2 && (mode === 'night' || mode === 'in' || mode === 'halt');
        const filing = (mode === 'in' || mode === 'out') && inward !== null && sd.index >= 2;
        sd.pose = marching || filing ? 'walk' : 'stand';
        if (marching) sd.stride = marched * PERSON.stepsPerCell * 0.5; // in step: one stride for all, from the distance marched
        if (filing) {
          trackAt(inward!, along[sd.index]!, q);
          sd.heading = mode === 'in' ? Math.atan2(q.dx, q.dz) : Math.atan2(-q.dx, -q.dz);
          sd.stride = along[sd.index]! * 2.5;
        }
        if (mode === 'halt' || mode === 'night' || (!filing && (mode === 'in' || mode === 'out'))) {
          // Face front, out of the gate; at the change of the guard the files face each other for a moment.
          const facing = Math.atan2(outX, outZ);
          const turning = timer > GARRISON.halt && timer < GARRISON.changeHalt - 1.5;
          const face = turning && mode === 'halt' ? facing + (sd.index & 1 ? -Math.PI / 2 : Math.PI / 2) : facing;
          let d = face - sd.heading;
          d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
          const most = 6 * dt;
          sd.heading += Math.max(-most, Math.min(most, d));
        }
        if (mode === 'night' && inward && sd.index >= 2) {
          // Inside, at ease, facing back out to the gate.
          let d = Math.atan2(outX, outZ) - sd.heading;
          d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
          sd.heading += Math.max(-6 * dt, Math.min(6 * dt, d));
        }
      }
    },
  };
  // A troop first seen at night is already in.
  if (time.isNight && gate) {
    s = track.loop ? gateAt - span / 2 : Math.max(0, Math.min(track.length - span, gateAt - span / 2));
    mode = 'night';
    if (inward) for (let i = 2; i < n; i++) along[i] = Math.max(0.2, inward.length - 0.2 - (i - 2) * GARRISON.spacing);
  }
  place();
  for (const sd of soldiers) {
    trackAt(track, sense === 1 ? s + span : s, pt);
    sd.heading = mode === 'night' ? Math.atan2(outX, outZ) : Math.atan2(pt.dx, pt.dz);
  }
  return troop;
}
