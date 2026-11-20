// The plan being grown: the grower, the island reading, where the square
// is, and the districts made so far with their ways in. Helpers for stamps
// that look at and claim rectangles in a stamp's own frame.

import type { Dir4 } from '@/core/grid';
import type { EdgeKind, FloorKind, PlacedKind } from '@/core/kinds';
import type { Frame } from './frame';
import { CLAIM, type Grower } from './grower';
import type { Site } from './site';

export interface District {
  id: number;
  name: string;
  /** A column near its middle: districts are watched growing outward from the square. */
  x: number;
  z: number;
  /** Columns that must join the streets. */
  ways: [number, number][];
  /** The ways are alternatives: one joined street is enough. */
  anyWay?: boolean;
}

export interface Town {
  g: Grower;
  site: Site;
  square: { x: number; z: number; h: number } | null;
  districts: District[];
  /** A town with no fountain at all: it draws its water at a hand pump (D33) instead. */
  pumps: boolean;
  /** A market cross in the middle of the square instead of the fountain (market towns). */
  marketCross?: boolean;
  /** Where the outlying farmstead goes, its ground kept clear (farmstead.ts). */
  farm?: [number, number];
}

export function startDistrict(town: Town, name: string, x: number, z: number): District {
  const d: District = { id: town.districts.length + 1, name, x, z, ways: [] };
  town.districts.push(d);
  town.g.district = d.id;
  return d;
}

/** Steps from the square (or the island's centre) to a column. */
export function fromSquare(town: Town, x: number, z: number): number {
  const [cx, cz] = town.square ? [town.square.x, town.square.z] : town.site.centre;
  return Math.abs(x - cx) + Math.abs(z - cz);
}

/** The world rectangle covered by a local rectangle (inclusive corners, any turn). */
function worldRect(f: Frame, u0: number, v0: number, u1: number, v1: number): [number, number, number, number] {
  const xa = f.x(u0, v0), xb = f.x(u1, v1), za = f.z(u0, v0), zb = f.z(u1, v1);
  return [Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)];
}

/** Every column of the local rectangle (inclusive) is on the map, land, and has none of `bits` claimed. */
export function rectFree(g: Grower, f: Frame, u0: number, v0: number, u1: number, v1: number, bits = 0xff): boolean {
  const [x0, z0, x1, z1] = worldRect(f, u0, v0, u1, v1);
  return g.blockedIn(x0, z0, x1, z1, bits) === 0;
}

/**
 * A stamp's footprint fits: the core rectangle is land with no claim at all,
 * and a margin round it (default 1) has no building or kept ground (streets
 * and other districts' open approaches may be shared).
 */
export function fits(g: Grower, f: Frame, u0: number, v0: number, u1: number, v1: number, margin = 1): boolean {
  if (!rectFree(g, f, u0, v0, u1, v1)) return false;
  if (margin === 0) return true;
  const [x0, z0, x1, z1] = worldRect(f, u0 - margin, v0 - margin, u1 + margin, v1 + margin);
  // Water in the margin is fine; only claims count there.
  return g.blockedIn(x0, z0, x1, z1, CLAIM.built | CLAIM.keep, false) === 0;
}

/** The single terrain height of the local rectangle, or −1 if it is not flat land. */
export function rectFlat(g: Grower, f: Frame, u0: number, v0: number, u1: number, v1: number): number {
  const [x0, z0, x1, z1] = worldRect(f, u0, v0, u1, v1);
  return g.flatIn(x0, z0, x1, z1);
}

/** Lowest and highest terrain under the local rectangle (water counts as 0). */
export function rectRange(g: Grower, f: Frame, u0: number, v0: number, u1: number, v1: number): [number, number] {
  let lo = 99, hi = 0;
  for (let v = v0; v <= v1; v++) {
    for (let u = u0; u <= u1; u++) {
      const h = g.h(f.x(u, v), f.z(u, v));
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  return [lo, hi];
}

export function claimRect(g: Grower, f: Frame, u0: number, v0: number, u1: number, v1: number, bits: number): void {
  for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) g.mark(f.x(u, v), f.z(u, v), bits);
}

/** A thin layer over the grower that speaks in a stamp's local coordinates. */
export class Local {
  constructor(
    readonly g: Grower,
    readonly f: Frame,
  ) {}
  x(u: number, v: number): number {
    return this.f.x(u, v);
  }
  z(u: number, v: number): number {
    return this.f.z(u, v);
  }
  h(u: number, v: number): number {
    return this.g.h(this.f.x(u, v), this.f.z(u, v));
  }
  top(u: number, v: number): number {
    return this.g.top(this.f.x(u, v), this.f.z(u, v));
  }
  put(kind: PlacedKind, u: number, y: number, v: number, color: number | 'auto' = 'auto'): boolean {
    return this.g.put(kind, this.f.x(u, v), y, this.f.z(u, v), color);
  }
  stack(kind: PlacedKind, u: number, v: number, floors: number, color: number | 'auto' = 'auto'): number {
    return this.g.stack(kind, this.f.x(u, v), this.f.z(u, v), floors, color);
  }
  floor(kind: FloorKind, u: number, v: number, y?: number): boolean {
    return this.g.floor(kind, this.f.x(u, v), this.f.z(u, v), y);
  }
  /** An edge piece on local side `d` of the cell at (u, y, v). */
  edge(u: number, y: number, v: number, d: Dir4, kind: EdgeKind): boolean {
    return this.g.edgePiece(this.f.x(u, v), y, this.f.z(u, v), this.f.dir(d), kind);
  }
  mark(u: number, v: number, bits: number): void {
    this.g.mark(this.f.x(u, v), this.f.z(u, v), bits);
  }
  claim(u0: number, v0: number, u1: number, v1: number, bits: number): void {
    claimRect(this.g, this.f, u0, v0, u1, v1, bits);
  }
  /** A colour for a house (or tower, marble) on these local cells that no touching structure of its kind has. */
  color(kind: PlacedKind, cells: readonly (readonly [number, number, number])[], salt: string | number): number {
    return this.g.colorFor(
      kind,
      cells.map(([u, y, v]) => [this.f.x(u, v), y, this.f.z(u, v)] as const),
      `${salt}@${this.f.ox},${this.f.oz}`,
    );
  }
  /** A house: `floors` storeys over the local rectangle, one colour so it is one structure. */
  house(u0: number, v0: number, u1: number, v1: number, floors: number, salt: string | number, kind: PlacedKind = 'house'): number {
    const cells: [number, number, number][] = [];
    for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) for (let f = 0; f < floors; f++) cells.push([u, this.top(u, v) + f, v]);
    const color = this.color(kind, cells, salt);
    for (let f = 0; f < floors; f++) {
      for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) this.put(kind, u, this.h(u, v) + f, v, color);
    }
    return color;
  }
  way(d: District, u: number, v: number): void {
    d.ways.push([this.f.x(u, v), this.f.z(u, v)]);
  }
  free(u: number, v: number): boolean {
    return this.g.free(this.f.x(u, v), this.f.z(u, v));
  }
}

export { CLAIM };

/** The fewest steps (Chebyshev) from the square's middle to any corner of a local rectangle: a barn wants no square within six of it. */
export function chebFromSquare(town: Town, f: Frame, u0: number, v0: number, u1: number, v1: number): number {
  if (!town.square) return 99;
  let best = 99;
  for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]] as const) {
    best = Math.min(best, Math.max(Math.abs(f.x(u, v) - town.square.x), Math.abs(f.z(u, v) - town.square.z)));
  }
  return best;
}
