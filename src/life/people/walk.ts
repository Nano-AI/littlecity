// From a route (a list of graph nodes) to the line a person actually walks.
// Pure.
//
// A walk is a list of PIECES. Each piece lies in one cell of the graph: the
// person comes in at one point of the cell and leaves at another, in a
// straight line or, where the route turns, along a curve through the cell.
// Because a piece never leaves its cell, and consecutive pieces are joined
// only where the graph has a link, a walker can never cut a corner through a
// fence, a wall or a building: the tests in crowd.test.ts check exactly that.
//
//   move   across one cell (a quadratic curve in x and z)
//   door   the step through a doorway: from the threshold into the building
//          (or out of it). The person is still drawn; the wall hides them.
//   hide   inside a building for `seconds`, not drawn
//
// People keep right: where a piece crosses into the next cell it does so
// PEOPLE.lane to the right of the middle, so two people walking opposite
// ways along one street pass each other.
//
// Height is not stored per piece but worked out from where the person is:
// a stairs cell rises across itself, carved steps rise over the last part of
// the lower cell, a stoop rises to the door.

import { CELL_H, DIR4, keyX, keyY, keyZ, opposite, type Dir4 } from '@/core/grid';
import type { NavDoor, NavGraph } from '@/resolve/plan';
import { PEOPLE } from '@/style/people';
import type { Route } from './route';

/** Height that changes along one axis: h0 at `from`, h1 at `to`, clamped outside. */
export interface Ramp {
  /** 0: along x, 1: along z. */
  axis: 0 | 1;
  from: number;
  to: number;
  h0: number;
  h1: number;
}

export interface Piece {
  kind: 'move' | 'door' | 'hide';
  /** The graph node whose cell this piece lies in (door, hide: the node outside the door). */
  node: number;
  /** The curve: start, control, end, in world x and z. */
  x0: number;
  z0: number;
  cx: number;
  cz: number;
  x1: number;
  z1: number;
  /** Its length in world units (0 for hide). */
  length: number;
  /** Floor height where there is no ramp. */
  base: number;
  ramp: Ramp | null;
  /** Added to the height, from `sink0` at the start to `sink1` at the end (going down a hatch). */
  sink0: number;
  sink1: number;
  /** The graph link crossed where this piece ends and the next begins, or -1. */
  link: number;
  /** hide: how long. */
  seconds: number;
  /** Walking speed here, as a share of the person's own. */
  pace: number;
  /** door, hide: the door this piece goes through. */
  door: NavDoor | null;
  /** door: going in (from the threshold into the building); false coming out, and for other pieces. */
  enter: boolean;
}

/** How far carved steps reach into the lower cell (src/parts/ground/terrain-steps.part.ts). */
const STEPS_RUN = 0.6;
/** How far a stoop reaches out from the wall. */
const STOOP_RUN = 0.34;
/** How far inside the wall a person goes before they are hidden, and how far a hatch swallows them. */
const DOOR_DEPTH = 0.24;
const HATCH_DEPTH = 0.5;
/** How far straight out from a door's threshold a walk goes before it turns (its leaf swings beside that). */
const DOOR_SQUARE = 0.36;
/** A floor lies a little above the top it rests on. */
const FLOOR_LIFT = 0.015;

export interface Point {
  x: number;
  z: number;
}

/** Where a door's threshold is: on the line between the building's cell and the cell outside. */
export type DoorPlace = (door: NavDoor) => Point | null;

/** The middle of a node's cell. */
export function nodeCentre(nav: NavGraph, node: number): Point {
  const c = nav.nodes[node]!.cell;
  return { x: keyX(c) + 0.5, z: keyZ(c) + 0.5 };
}

/** The floor height of a node at its middle. */
export function nodeHeight(nav: NavGraph, node: number): number {
  const n = nav.nodes[node]!;
  return keyY(n.cell) * CELL_H + (n.rot !== undefined ? CELL_H / 2 : 0) + (n.lift ?? 0);
}

function flatHeight(nav: NavGraph, node: number): number {
  const n = nav.nodes[node]!;
  const floor = n.surface === 'path' || n.surface === 'plaza' || n.surface === 'garden';
  return keyY(n.cell) * CELL_H + (floor ? FLOOR_LIFT : 0) + (n.lift ?? 0);
}

/** Over the plinth of a bandstand's floor: up the steps from the side it is entered by. */
const PLINTH_RUN = 0.3;

/** The rise of a stairs cell, as a ramp. */
function stairsRamp(nav: NavGraph, node: number): Ramp | null {
  const n = nav.nodes[node]!;
  if (n.rot === undefined) return null;
  const [dx, dz] = DIR4[n.rot]!;
  const y = keyY(n.cell) * CELL_H;
  const lo = dx !== 0 ? keyX(n.cell) : keyZ(n.cell);
  const up = dx + dz > 0;
  return { axis: dx !== 0 ? 0 : 1, from: up ? lo : lo + 1, to: up ? lo + 1 : lo, h0: y, h1: y + CELL_H };
}

/** A ramp over the last `run` before the boundary on side `dir` of a node's cell. */
function edgeRamp(nav: NavGraph, node: number, dir: Dir4, run: number, h0: number, h1: number): Ramp {
  const c = nav.nodes[node]!.cell;
  const [dx, dz] = DIR4[dir]!;
  const axis = dx !== 0 ? 0 : 1;
  const lo = axis === 0 ? keyX(c) : keyZ(c);
  const edge = dx + dz > 0 ? lo + 1 : lo;
  return { axis, from: edge - (dx + dz) * run, to: edge, h0, h1 };
}

/** The default threshold of a door: the middle of its face (a hatch: the middle of its cell). */
export function doorThreshold(nav: NavGraph, door: NavDoor): Point {
  if (door.dir === undefined) return nodeCentre(nav, door.node);
  const [dx, dz] = DIR4[door.dir]!;
  return { x: keyX(door.cell) + 0.5 + dx * 0.5, z: keyZ(door.cell) + 0.5 + dz * 0.5 };
}

function dirBetween(nav: NavGraph, a: number, b: number): Dir4 {
  const ca = nav.nodes[a]!.cell, cb = nav.nodes[b]!.cell;
  const dx = keyX(cb) - keyX(ca), dz = keyZ(cb) - keyZ(ca);
  return (dx > 0 ? 1 : dx < 0 ? 3 : dz > 0 ? 2 : 0) as Dir4;
}

function curveLength(x0: number, z0: number, cx: number, cz: number, x1: number, z1: number): number {
  let len = 0;
  let px = x0, pz = z0;
  for (let i = 1; i <= 6; i++) {
    const t = i / 6, u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const z = u * u * z0 + 2 * u * t * cz + t * t * z1;
    len += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
  }
  return len;
}

export interface WalkOptions {
  /** Where the walk starts: a point in the first node's cell. Default: its middle. */
  from?: Point;
  /** Where it ends: a point in the last node's cell. Default: its middle. */
  to?: Point;
  /** Come out of this door first (it must open onto the first node). */
  startDoor?: NavDoor;
  /** Go in at this door at the end (it must open onto the last node). */
  endDoor?: NavDoor;
  /** How far right of the middle to keep. Default PEOPLE.lane. */
  lane?: number;
  doorAt?: DoorPlace;
}

const doorSides = new WeakMap<NavGraph, Map<number, Dir4[]>>();
/** True if a door opens onto this node (its leaf swings out over part of the cell). */
export function hasDoor(nav: NavGraph, node: number): boolean {
  return doorDirs(nav, node).length > 0;
}

/** The directions of the doors that open onto this node (each points out of its building, into the node). */
export function doorDirs(nav: NavGraph, node: number): readonly Dir4[] {
  towardDoor(nav, node, 0, 0);
  return doorSides.get(nav)?.get(node) ?? [];
}

/** True if an offset (ox, oz) from a node's middle leans toward the wall of a door that opens onto it. */
function towardDoor(nav: NavGraph, node: number, ox: number, oz: number): boolean {
  let sides = doorSides.get(nav);
  if (!sides) {
    sides = new Map();
    for (const d of nav.doors) {
      if (d.dir === undefined || d.node < 0) continue;
      const list = sides.get(d.node);
      if (list) list.push(d.dir);
      else sides.set(d.node, [d.dir]);
    }
    doorSides.set(nav, sides);
  }
  for (const dir of sides.get(node) ?? []) if (-(DIR4[dir]![0] * ox + DIR4[dir]![1] * oz) > 0.05) return true;
  return false;
}

/** The pieces of a walk along a route. */
export function buildWalk(nav: NavGraph, route: Route, opts: WalkOptions = {}): Piece[] {
  const lane = opts.lane ?? PEOPLE.lane;
  const pieces: Piece[] = [];
  const place = (door: NavDoor): Point => {
    const p = opts.doorAt?.(door) ?? doorThreshold(nav, door);
    if (door.dir === undefined) return p;
    // Keep it on the boundary line, a hair outside, and away from the corners.
    const [dx, dz] = DIR4[door.dir]!;
    const mid = doorThreshold(nav, door);
    const along = Math.max(-0.3, Math.min(0.3, dx !== 0 ? p.z - mid.z : p.x - mid.x));
    return { x: mid.x + dx * 0.02 + (dx !== 0 ? 0 : along), z: mid.z + dz * 0.02 + (dz !== 0 ? 0 : along) };
  };

  const move = (node: number, a: Point, b: Point, turn: boolean, link: number, ramp: Ramp | null): void => {
    const c = nodeCentre(nav, node);
    // A turn bends through the cell: its control point is where the line in meets the line out, which is
    // the middle of the cell moved by both ends' lane offsets. A straight piece is a line.
    const cx = turn ? c.x + laneShift(a, c) + laneShift(b, c) : (a.x + b.x) / 2;
    const cz = turn ? c.z + laneShiftZ(a, c) + laneShiftZ(b, c) : (a.z + b.z) / 2;
    const n = nav.nodes[node]!;
    pieces.push({
      kind: 'move',
      node,
      x0: a.x, z0: a.z, cx, cz, x1: b.x, z1: b.z,
      length: Math.max(1e-4, curveLength(a.x, a.z, cx, cz, b.x, b.z)),
      base: flatHeight(nav, node),
      ramp: ramp ?? stairsRamp(nav, node),
      sink0: 0,
      sink1: 0,
      link,
      seconds: 0,
      pace: n.rot !== undefined ? 0.7 : 1,
      door: null,
      enter: false,
    });
  };
  // A boundary point sits on one edge of the cell: its lane offset lies along that edge. The control
  // point of a turn takes both ends' offsets, which keeps the curve the same distance right of centre.
  const laneShift = (p: Point, c: Point): number => (Math.abs(p.z - c.z) > 0.45 ? p.x - c.x : 0);
  const laneShiftZ = (p: Point, c: Point): number => (Math.abs(p.x - c.x) > 0.45 ? p.z - c.z : 0);

  const doorPiece = (door: NavDoor, entering: boolean): void => {
    const t = place(door);
    const level = keyY(door.cell) * CELL_H;
    let inX = t.x, inZ = t.z;
    let sink = 0;
    if (door.dir === undefined) sink = -HATCH_DEPTH;
    else {
      inX -= DIR4[door.dir]![0] * DOOR_DEPTH;
      inZ -= DIR4[door.dir]![1] * DOOR_DEPTH;
    }
    const a = entering ? t : { x: inX, z: inZ };
    const b = entering ? { x: inX, z: inZ } : t;
    pieces.push({
      kind: 'door',
      node: door.node,
      x0: a.x, z0: a.z, cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, x1: b.x, z1: b.z,
      length: Math.max(0.12, Math.hypot(b.x - a.x, b.z - a.z), -sink),
      base: door.dir === undefined ? flatHeight(nav, door.node) : level,
      ramp: null,
      sink0: entering ? 0 : sink,
      sink1: entering ? sink : 0,
      link: -1,
      seconds: 0,
      pace: 0.8,
      door,
      enter: entering,
    });
  };
  /** The ramp of the approach to a door, if it stands above its node (a stoop, or the head of a flight). */
  const doorRamp = (door: NavDoor): Ramp | null => {
    if (door.dir === undefined || door.drop === 0) return null;
    const level = keyY(door.cell) * CELL_H;
    return edgeRamp(nav, door.node, opposite(door.dir), STOOP_RUN, level - door.drop * CELL_H, level);
  };

  const { nodes, links } = route;
  let entry: Point = opts.from ?? nodeCentre(nav, nodes[0]!);
  let entryOnEdge = false;
  /** The door the walk comes out of into this cell, and the one it goes in at from it: square to the wall. */
  let entryDoor: Dir4 | undefined;
  if (opts.startDoor) {
    doorPiece(opts.startDoor, false);
    entry = place(opts.startDoor);
    entryOnEdge = opts.startDoor.dir !== undefined;
    entryDoor = opts.startDoor.dir;
  } else if (opts.from) {
    // Setting off from a doorstep (turned back on the way in): square to the wall first, too.
    for (const d of nav.doors) {
      if (d.node !== nodes[0] || d.dir === undefined) continue;
      const t = place(d);
      if (Math.hypot(t.x - opts.from.x, t.z - opts.from.z) < 0.3) entryDoor = d.dir;
    }
  }
  let startRamp: Ramp | null = opts.startDoor ? doorRamp(opts.startDoor) : null;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const last = i === nodes.length - 1;
    const link = last ? null : nav.links[links[i]!]!;
    let exit: Point;
    let exitOnEdge = false;
    let ramp: Ramp | null = startRamp;
    startRamp = null;
    let after: (() => void) | null = null;
    let exitDoor: Dir4 | undefined;

    if (last) {
      if (opts.endDoor) {
        exit = place(opts.endDoor);
        exitDoor = opts.endDoor.dir;
        exitOnEdge = opts.endDoor.dir !== undefined;
        ramp = doorRamp(opts.endDoor) ?? ramp;
        const door = opts.endDoor;
        after = () => doorPiece(door, true);
      } else exit = opts.to ?? nodeCentre(nav, node);
    } else if (link!.via === 'interior') {
      const here = nav.doors[link!.a === node ? link!.doorA! : link!.doorB!]!;
      const there = nav.doors[link!.a === node ? link!.doorB! : link!.doorA!]!;
      exit = place(here);
      exitOnEdge = here.dir !== undefined;
      exitDoor = here.dir;
      ramp = doorRamp(here) ?? ramp;
      const seconds = link!.seconds ?? 1;
      after = () => {
        doorPiece(here, true);
        pieces.push({ ...pieces[pieces.length - 1]!, kind: 'hide', length: 0, seconds, link: links[i]!, door: there, sink0: 0, sink1: 0, enter: false });
        doorPiece(there, false);
      };
    } else {
      // The middle of the edge between the two cells, shifted to the walker's right.
      const next = nodes[i + 1]!;
      const d = dirBetween(nav, node, next);
      const [dx, dz] = DIR4[d]!;
      const c = nodeCentre(nav, node);
      // Single file through a gate; wide of a post on the boundary, or of whatever stands in the middle
      // of either cell.
      const wide = link!.post === true || nav.nodes[node]!.clutter === true || nav.nodes[next]!.clutter === true;
      let off = wide ? PEOPLE.laneWide : lane * (nav.runOf[links[i]!]! >= 0 ? 0.55 : 1);
      // Into or about a bandstand: down the middle, clear of its columns.
      if (nav.nodes[node]!.pavilion !== undefined || nav.nodes[next]!.pavilion !== undefined) off = 0;
      // Going wide past a door, go wide on the side away from it: its leaf swings out there (L29).
      if (wide && (towardDoor(nav, node, -dz * off, dx * off) || towardDoor(nav, next, -dz * off, dx * off))) off = -off;
      exit = { x: c.x + dx * 0.5 - dz * off, z: c.z + dz * 0.5 + dx * off };
      exitOnEdge = true;
      if (link!.via === 'steps') {
        // Carved steps stand in the LOWER cell, against the bank.
        const up = link!.a === node;
        const low = up ? node : next;
        const h = keyY(nav.nodes[low]!.cell) * CELL_H;
        if (up) ramp = edgeRamp(nav, node, d, STEPS_RUN, h, h + CELL_H);
        else startRamp = edgeRamp(nav, next, opposite(d), STEPS_RUN, h, h + CELL_H);
      }
    }

    // A bandstand's floor stands on its plinth: up its steps from the cell outside (or down to it).
    if (nav.nodes[node]!.pavilion !== undefined) {
      for (const o of [i > 0 ? nodes[i - 1]! : -1, last ? -1 : nodes[i + 1]!]) {
        if (o < 0 || nav.nodes[o]!.pavilion !== undefined || link?.via === 'interior') continue;
        ramp = edgeRamp(nav, node, dirBetween(nav, node, o), PLINTH_RUN, flatHeight(nav, node), flatHeight(nav, o));
      }
      // Square through the open bay, as through a door, before turning: clear of the columns either side.
      if (i > 0 && nav.nodes[nodes[i - 1]!]!.pavilion === undefined && entryDoor === undefined) entryDoor = dirBetween(nav, nodes[i - 1]!, node);
      if (!last && link!.via !== 'interior' && nav.nodes[nodes[i + 1]!]!.pavilion === undefined && exitDoor === undefined) exitDoor = opposite(dirBetween(nav, node, nodes[i + 1]!));
    }

    // A turn: in at one edge and out at another that is not opposite it.
    const c = nodeCentre(nav, node);
    const side = (p: Point): number => (Math.abs(p.x - c.x) > 0.45 ? 0 : Math.abs(p.z - c.z) > 0.45 ? 1 : -1);
    const turn = entryOnEdge && exitOnEdge && side(entry) !== -1 && side(exit) !== -1 && side(entry) !== side(exit);
    const endLink = last || link!.via === 'interior' ? -1 : links[i]!;
    if (entryDoor === undefined && exitDoor === undefined) move(node, entry, exit, turn, endLink, ramp);
    else {
      // Out of a door, or in at one: square to the wall for the first or last stretch, clear of where its
      // leaf swings (L29), then straight across the cell.
      let a = entry;
      if (entryDoor !== undefined) {
        const [dx, dz] = DIR4[entryDoor]!;
        const a2 = { x: a.x + dx * DOOR_SQUARE, z: a.z + dz * DOOR_SQUARE };
        move(node, a, a2, false, -1, ramp);
        a = a2;
      }
      if (exitDoor !== undefined) {
        const [dx, dz] = DIR4[exitDoor]!;
        const b2 = { x: exit.x + dx * DOOR_SQUARE, z: exit.z + dz * DOOR_SQUARE };
        if (Math.hypot(b2.x - a.x, b2.z - a.z) > 0.02) move(node, a, b2, false, -1, ramp);
        move(node, Math.hypot(b2.x - a.x, b2.z - a.z) > 0.02 ? b2 : a, exit, false, endLink, ramp);
      } else move(node, a, exit, false, endLink, ramp);
    }
    entryDoor = undefined;
    after?.();
    if (!last) {
      if (link!.via === 'interior') {
        const there = nav.doors[link!.a === node ? link!.doorB! : link!.doorA!]!;
        entry = place(there);
        entryOnEdge = there.dir !== undefined;
        entryDoor = there.dir;
        startRamp = doorRamp(there);
      } else {
        entry = exit;
        entryOnEdge = true;
      }
    }
  }
  return pieces;
}

/** Where a piece is at t (0–1): position, floor height and the direction of travel. */
export function pieceAt(p: Piece, t: number, out: { x: number; y: number; z: number; dx: number; dz: number }): void {
  const u = 1 - t;
  const x = u * u * p.x0 + 2 * u * t * p.cx + t * t * p.x1;
  const z = u * u * p.z0 + 2 * u * t * p.cz + t * t * p.z1;
  out.x = x;
  out.z = z;
  out.dx = 2 * u * (p.cx - p.x0) + 2 * t * (p.x1 - p.cx);
  out.dz = 2 * u * (p.cz - p.z0) + 2 * t * (p.z1 - p.cz);
  let y = p.base;
  const r = p.ramp;
  if (r) {
    const k = ((r.axis === 0 ? x : z) - r.from) / (r.to - r.from);
    y = r.h0 + (r.h1 - r.h0) * (k < 0 ? 0 : k > 1 ? 1 : k);
  }
  out.y = y + p.sink0 + (p.sink1 - p.sink0) * t;
}
