// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// MeshData and MeshBuilder: how every generator and part describes geometry.
// Plain typed arrays, no Three.js objects, so it runs under Vitest in Node.
//
//   const b = new MeshBuilder({ ink: structure.id });
//   b.setColor(WALLS[3]).setPattern(PATTERN.plaster).setInk('walls');
//   b.box([0, 0, 0], [1, CELL_H, 1], { skip: ['bottom'] });
//   b.setColor(ROOF[1]).setPattern(PATTERN.shingles).setInk('roof');
//   b.at(translation(0.5, CELL_H, 0.5), () => b.lathe([[0.7, 0], [0, 0.6]], { segments: 4 }));
//   return b.build();
//
// Conventions:
//  - Triangle soup, three vertices per triangle, no index buffer.
//  - Front faces are counter-clockwise seen from outside; normals point out.
//  - Units are world units: a cell is 1 × CELL_H × 1.
//  - Ink: the renderer draws an ink line wherever the ink id changes between
//    neighbouring pixels. Surfaces that should read as one (a merged wall, a
//    roof across several cells) share an ink group; equal groups draw no seam.

import { hash } from '@/core/rand';
import { identity, multiply, rotationX, rotationY, rotationZ, scaling, translation, type Mat4, type Mat4Like, type Vec3 } from '@/core/mat4';

export interface MeshData {
  /** xyz per vertex. */
  position: Float32Array;
  /** xyz per vertex, unit length. */
  normal: Float32Array;
  /** rgb per vertex, 0–255, sRGB. */
  color: Uint8Array;
  /** Shader pattern id per vertex (PATTERN). */
  pattern: Uint8Array;
  /** Ink id per vertex; equal neighbours draw no seam line. 0 is never used. */
  inkId: Uint16Array;
  /** Distance from a marked edge, for bevel lines; EDGE_FAR where there is none. */
  edge: Float32Array;
  /** How much the vertex moves with the wind, 0 (rigid) to 1. */
  sway: Float32Array;
}

/** `edge` value meaning "no marked edge near here". */
export const EDGE_FAR = 9;

/**
 * Surface patterns drawn by the shader. Ids 1–8 are the spike's; the rest
 * are reserved names the renderer fills in. A pattern the shader does not
 * know yet draws as flat colour.
 */
export const PATTERN = {
  none: 0,
  grass: 1, //     sparse tick strokes on tops
  shingles: 2, //  roof rows
  earth: 3, //     speckles and strata on sides
  stone: 4, //     stone courses
  paving: 5, //    one tile per grid cell
  planks: 6, //    wood boards
  glass: 7, //     diagonal glint
  marble: 8, //    soft veins; bevel line from the `edge` attribute
  sand: 9,
  rock: 10,
  water: 11,
  plaster: 12, //  house walls: almost flat, a few flecks
  brick: 13,
  cobbles: 14,
  thatch: 15,
  timber: 16, //   half-timber framing
  leaves: 17, //   foliage scallops
  bark: 18,
  stripes: 19, //  awnings, bands
  crops: 20, //    wheat and vegetable rows
  cloth: 21,
  metal: 22,
  dirt: 23, //     worn trails
  foam: 24,
  // Added by Look (Stage 1); see docs/swarm/requests/look.md.
  glow: 25, //         a self-lit surface (lamp glass, lantern): unshaded by day, radiant at dusk and night
  planksAcross: 26, // wood boards running along z (`planks` run along x)
  beam: 27, //         a shaft of light: translucent, never inked, fading along `edge` (0 at the source)
} as const;
export type PatternId = (typeof PATTERN)[keyof typeof PATTERN];

/** 0xrrggbb, '#rrggbb', or [r, g, b] with 0–255 components. */
export type ColorInput = number | string | readonly [number, number, number];
export type BoxFace = 'top' | 'bottom' | 'n' | 'e' | 's' | 'w';
/** A number, or a function of the vertex's local position (before the transform stack). */
export type SwayInput = number | ((x: number, y: number, z: number) => number);

export interface FaceOptions {
  /** Per-vertex colours for this face (overrides the current colour). */
  colors?: readonly ColorInput[];
  /** Per-vertex edge distances for this face (overrides the current edge value). */
  edge?: readonly number[];
  /** Per-vertex normals in local space (overrides the flat face normal), for smooth shading. */
  normals?: readonly Vec3[];
}

export interface BoxOptions {
  /** Faces to leave out (hidden against a neighbour). */
  skip?: readonly BoxFace[];
  /** Emit only these faces. */
  only?: readonly BoxFace[];
  /** Mark the top edge: side faces get `edge` = distance below the top (the marble bevel line). */
  bevelTop?: boolean;
}

export interface ExtrudeOptions {
  /** Which ends to close. Default 'both'. */
  cap?: 'both' | 'top' | 'bottom' | 'none';
  /** Blend side normals around corners (round outlines). Default false: every side is flat. */
  smooth?: boolean;
}

export interface LatheOptions {
  /** Sides around the axis. Default 12. */
  segments?: number;
  /** Round (normals blend around the axis) or faceted. Default true; faceted suits 4–8 sided shapes. */
  smooth?: boolean;
  /** Close the bottom / top with a disc when the profile does not start / end on the axis. Default false. */
  capBottom?: boolean;
  capTop?: boolean;
  /** Start angle and sweep in radians. Default 0 and a full turn. Angle 0 is +X, a quarter turn is +Z. */
  start?: number;
  sweep?: number;
}

export function parseColor(c: ColorInput): [number, number, number] {
  if (typeof c === 'number') return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  if (typeof c === 'string') {
    const hex = c.startsWith('#') ? c.slice(1) : c;
    const full = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex;
    const n = Number.parseInt(full, 16);
    if (full.length !== 6 || Number.isNaN(n)) throw new Error(`parseColor: '${c}' is not #rrggbb`);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return [c[0], c[1], c[2]];
}

interface State {
  r: number;
  g: number;
  b: number;
  pattern: number;
  ink: number;
  edge: number;
  sway: SwayInput;
}

export interface MeshState {
  color?: ColorInput;
  pattern?: number;
  /** An ink group (hashed with the builder's ink base). */
  ink?: number | string;
  /** A raw ink id (to share a seam-free surface with another builder). */
  inkId?: number;
  edge?: number;
  sway?: SwayInput;
}

export class MeshBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private pat: number[] = [];
  private ink: number[] = [];
  private edg: number[] = [];
  private swy: number[] = [];

  private readonly inkBase: number;
  private state: State;
  private matrix: Mat4 = identity();
  private stack: Mat4[] = [];
  private isIdentity = true;
  private flip = false;
  private normalMat: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  /**
   * `ink` namespaces this builder's ink groups: pass the structure id (or a
   * prop id) so `setInk('walls')` on two structures gives two different ids.
   */
  constructor(opts: { ink?: number | string } = {}) {
    this.inkBase = hash(0x1c5e, opts.ink ?? 0);
    this.state = { r: 255, g: 255, b: 255, pattern: 0, ink: this.inkOf(0), edge: EDGE_FAR, sway: 0 };
  }

  // ── state ──────────────────────────────────────────────────────────────

  setColor(c: ColorInput): this {
    const [r, g, b] = parseColor(c);
    this.state.r = r;
    this.state.g = g;
    this.state.b = b;
    return this;
  }
  setPattern(id: number): this {
    this.state.pattern = id & 255;
    return this;
  }
  /** Everything emitted with the same group reads as one surface: no ink seam inside it. */
  setInk(group: number | string): this {
    this.state.ink = this.inkOf(group);
    return this;
  }
  /** Use a raw ink id, e.g. `host.inkOf('walls')`, so this mesh merges into another builder's surface. */
  setInkId(id: number): this {
    this.state.ink = id & 0xffff;
    return this;
  }
  /** The raw ink id of a group in this builder (1–65535). */
  inkOf(group: number | string): number {
    return (hash(this.inkBase, group) % 65535) + 1;
  }
  setEdge(distance: number): this {
    this.state.edge = distance;
    return this;
  }
  setSway(sway: SwayInput): this {
    this.state.sway = sway;
    return this;
  }
  /** Runs `fn` with some state changed, then restores it. */
  with(change: MeshState, fn: () => void): this {
    const saved = { ...this.state };
    if (change.color !== undefined) this.setColor(change.color);
    if (change.pattern !== undefined) this.setPattern(change.pattern);
    if (change.ink !== undefined) this.setInk(change.ink);
    if (change.inkId !== undefined) this.setInkId(change.inkId);
    if (change.edge !== undefined) this.setEdge(change.edge);
    if (change.sway !== undefined) this.setSway(change.sway);
    try {
      fn();
    } finally {
      this.state = saved;
    }
    return this;
  }

  // ── transform stack ────────────────────────────────────────────────────

  /** Saves the current transform; optionally applies `m` on top of it. */
  push(m?: Mat4Like): this {
    this.stack.push(this.matrix);
    if (m) this.transform(m);
    return this;
  }
  pop(): this {
    const m = this.stack.pop();
    if (!m) throw new Error('MeshBuilder.pop: nothing to pop');
    this.setMatrix(m);
    return this;
  }
  /** Runs `fn` with `m` applied on top of the current transform, then restores it. */
  at(m: Mat4Like, fn: () => void): this {
    this.push(m);
    try {
      fn();
    } finally {
      this.pop();
    }
    return this;
  }
  /** Applies `m` in the current local space (current = current × m). */
  transform(m: Mat4Like): this {
    this.setMatrix(multiply(this.matrix, m));
    return this;
  }
  translate(x: number, y: number, z: number): this {
    return this.transform(translation(x, y, z));
  }
  rotateX(rad: number): this {
    return this.transform(rotationX(rad));
  }
  rotateY(rad: number): this {
    return this.transform(rotationY(rad));
  }
  rotateZ(rad: number): this {
    return this.transform(rotationZ(rad));
  }
  scale(x: number, y = x, z = x): this {
    return this.transform(scaling(x, y, z));
  }
  resetTransform(): this {
    this.setMatrix(identity());
    return this;
  }

  private setMatrix(m: Mat4): void {
    this.matrix = m;
    const a = m[0]!, b = m[1]!, c = m[2]!, d = m[4]!, e = m[5]!, f = m[6]!, g = m[8]!, h = m[9]!, i = m[10]!;
    this.isIdentity =
      a === 1 && e === 1 && i === 1 && b === 0 && c === 0 && d === 0 && f === 0 && g === 0 && h === 0 &&
      m[12] === 0 && m[13] === 0 && m[14] === 0;
    const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
    this.flip = det < 0;
    // Normals transform by the cofactor matrix (= det × inverse transpose), stored row by row;
    // the sign fixes mirrors.
    const s = det < 0 ? -1 : 1;
    this.normalMat = [
      s * (e * i - f * h), s * (c * h - b * i), s * (b * f - c * e),
      s * (f * g - d * i), s * (a * i - c * g), s * (c * d - a * f),
      s * (d * h - e * g), s * (b * g - a * h), s * (a * e - b * d),
    ];
  }

  // ── primitives ─────────────────────────────────────────────────────────

  /** A triangle, counter-clockwise seen from outside. */
  tri(a: Vec3, b: Vec3, c: Vec3, opts?: FaceOptions): this {
    this.emit([a, b, c], opts);
    return this;
  }

  /** A quad a→b→c→d, counter-clockwise seen from outside. Need not be planar. */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, opts?: FaceOptions): this {
    if (opts && (opts.colors || opts.edge || opts.normals)) {
      const sub = (i: number, j: number, k: number): FaceOptions => ({
        colors: opts.colors && [opts.colors[i]!, opts.colors[j]!, opts.colors[k]!],
        edge: opts.edge && [opts.edge[i]!, opts.edge[j]!, opts.edge[k]!],
        normals: opts.normals && [opts.normals[i]!, opts.normals[j]!, opts.normals[k]!],
      });
      const flat = opts.normals ? undefined : faceNormal(a, b, c, d);
      this.emit([a, b, c], sub(0, 1, 2), flat);
      this.emit([a, c, d], sub(0, 2, 3), flat);
    } else {
      const flat = faceNormal(a, b, c, d);
      this.emit([a, b, c], undefined, flat);
      this.emit([a, c, d], undefined, flat);
    }
    return this;
  }

  /** A flat polygon (convex or not, no holes), counter-clockwise seen from outside. */
  polygon(points: readonly Vec3[], opts?: Pick<FaceOptions, 'normals'>): this {
    if (points.length < 3) return this;
    const n = newell(points);
    // Project to the dominant plane for triangulation.
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    const flat2: [number, number][] = points.map((p) =>
      ay >= ax && ay >= az ? [p[2], p[0]] : ax >= az ? [p[1], p[2]] : [p[0], p[1]],
    );
    const sign = ay >= ax && ay >= az ? n[1] : ax >= az ? n[0] : n[2];
    const tris = triangulate(flat2);
    for (const [i, j, k] of tris) {
      const order = sign >= 0 ? [i, j, k] : [i, k, j];
      this.emit(
        [points[order[0]!]!, points[order[1]!]!, points[order[2]!]!],
        opts?.normals && { normals: [opts.normals[order[0]!]!, opts.normals[order[1]!]!, opts.normals[order[2]!]!] },
        opts?.normals ? undefined : n,
      );
    }
    return this;
  }

  /** An axis-aligned box from its minimum to its maximum corner. */
  box(min: Vec3, max: Vec3, opts: BoxOptions = {}): this {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const want = (f: BoxFace): boolean => (opts.only ? opts.only.includes(f) : !opts.skip?.includes(f));
    // Opposite faces split along matching diagonals, so two boxes sharing a
    // wall produce coincident triangles (which findDuplicateFaces can catch).
    const h = y1 - y0;
    const bottomFirst = opts.bevelTop ? { edge: [h, h, 0, 0] } : undefined;
    const upFirst = opts.bevelTop ? { edge: [h, 0, 0, h] } : undefined;
    if (want('top')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    if (want('bottom')) this.quad([x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y0, z0]);
    if (want('s')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], bottomFirst);
    if (want('n')) this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], upFirst);
    if (want('e')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], bottomFirst);
    if (want('w')) this.quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], upFirst);
    return this;
  }

  /** A box given its bottom-centre point and its size (width x, height y, depth z). */
  boxAt(bottomCenter: Vec3, size: Vec3, opts?: BoxOptions): this {
    const [cx, y, cz] = bottomCenter;
    const [w, h, d] = size;
    return this.box([cx - w / 2, y, cz - d / 2], [cx + w / 2, y + h, cz + d / 2], opts);
  }

  /**
   * A prism: a footprint outline in the XZ plane ([x, z] points, either
   * winding, no holes) raised from y0 to y1.
   */
  extrude(outline: readonly (readonly [number, number])[], y0: number, y1: number, opts: ExtrudeOptions = {}): this {
    const n = outline.length;
    if (n < 3) return this;
    // Normalise to positive signed area in (x, z).
    let area = 0;
    for (let i = 0; i < n; i++) {
      const p = outline[i]!, q = outline[(i + 1) % n]!;
      area += p[0] * q[1] - q[0] * p[1];
    }
    const pts = area >= 0 ? outline : [...outline].reverse();
    const sideNormal = (i: number): Vec3 => {
      const p = pts[i]!, q = pts[(i + 1) % n]!;
      const dx = q[0] - p[0], dz = q[1] - p[1];
      const len = Math.hypot(dx, dz) || 1;
      return [dz / len, 0, -dx / len];
    };
    for (let i = 0; i < n; i++) {
      const p = pts[i]!, q = pts[(i + 1) % n]!;
      const a: Vec3 = [q[0], y0, q[1]], b: Vec3 = [p[0], y0, p[1]], c: Vec3 = [p[0], y1, p[1]], d: Vec3 = [q[0], y1, q[1]];
      if (opts.smooth) {
        const here = sideNormal(i), prev = sideNormal((i + n - 1) % n), next = sideNormal((i + 1) % n);
        const np = norm3([here[0] + prev[0], 0, here[2] + prev[2]]);
        const nq = norm3([here[0] + next[0], 0, here[2] + next[2]]);
        this.quad(a, b, c, d, { normals: [nq, np, np, nq] });
      } else {
        this.quad(a, b, c, d);
      }
    }
    const cap = opts.cap ?? 'both';
    if (cap !== 'none') {
      const tris = triangulate(pts as readonly (readonly [number, number])[]);
      for (const [i, j, k] of tris) {
        const P = (idx: number, y: number): Vec3 => [pts[idx]![0], y, pts[idx]![1]];
        if (cap === 'both' || cap === 'top') this.emit([P(i, y1), P(k, y1), P(j, y1)], undefined, [0, 1, 0]);
        if (cap === 'both' || cap === 'bottom') this.emit([P(i, y0), P(j, y0), P(k, y0)], undefined, [0, -1, 0]);
      }
    }
    return this;
  }

  /**
   * A surface of revolution about the Y axis: `profile` is [radius, y]
   * points from bottom to top. A radius of 0 closes to a point (a cone tip).
   */
  lathe(profile: readonly (readonly [number, number])[], opts: LatheOptions = {}): this {
    const segs = Math.max(3, Math.floor(opts.segments ?? 12));
    const smooth = opts.smooth ?? true;
    const start = opts.start ?? 0;
    const sweep = opts.sweep ?? Math.PI * 2;
    const ring = (r: number, y: number, t: number): Vec3 => [r * Math.cos(t), y, r * Math.sin(t)];
    for (let i = 0; i + 1 < profile.length; i++) {
      const [r0, y0] = profile[i]!;
      const [r1, y1] = profile[i + 1]!;
      if (r0 === 0 && r1 === 0) continue;
      const dr = r1 - r0, dy = y1 - y0;
      const len = Math.hypot(dr, dy) || 1;
      const nr = dy / len, ny = -dr / len;
      for (let j = 0; j < segs; j++) {
        const t0 = start + (sweep * j) / segs;
        const t1 = start + (sweep * (j + 1)) / segs;
        const a = ring(r0, y0, t1), b = ring(r0, y0, t0), c = ring(r1, y1, t0), d = ring(r1, y1, t1);
        if (smooth) {
          const n0: Vec3 = [nr * Math.cos(t0), ny, nr * Math.sin(t0)];
          const n1: Vec3 = [nr * Math.cos(t1), ny, nr * Math.sin(t1)];
          if (r0 === 0) this.emit([a, c, d], { normals: [n1, n0, n1] });
          else if (r1 === 0) this.emit([a, b, c], { normals: [n1, n0, n0] });
          else this.quad(a, b, c, d, { normals: [n1, n0, n0, n1] });
        } else {
          // Each facet is planar, so the geometric face normal is exact.
          if (r0 === 0) this.emit([a, c, d]);
          else if (r1 === 0) this.emit([a, b, c]);
          else this.quad(a, b, c, d);
        }
      }
    }
    const disc = (r: number, y: number, up: boolean): void => {
      for (let j = 0; j < segs; j++) {
        const t0 = start + (sweep * j) / segs;
        const t1 = start + (sweep * (j + 1)) / segs;
        if (up) this.emit([[0, y, 0], ring(r, y, t1), ring(r, y, t0)], undefined, [0, 1, 0]);
        else this.emit([[0, y, 0], ring(r, y, t0), ring(r, y, t1)], undefined, [0, -1, 0]);
      }
    };
    const first = profile[0], last = profile[profile.length - 1];
    if (opts.capBottom && first && first[0] > 0) disc(first[0], first[1], false);
    if (opts.capTop && last && last[0] > 0) disc(last[0], last[1], true);
    return this;
  }

  /** Appends another mesh, placed by `m` on top of the current transform. Its ink ids are kept. */
  add(mesh: MeshData | MeshBuilder, m?: Mat4Like): this {
    const data = mesh instanceof MeshBuilder ? mesh.build() : mesh;
    if (m) this.push(m);
    const n = data.position.length / 3;
    const p = data.position, nn = data.normal;
    for (let v = 0; v < n; v += 3) {
      // Mirrored transforms flip winding, so emit each triangle's vertices in reverse.
      const order = this.flip ? [v + 2, v + 1, v] : [v, v + 1, v + 2];
      for (const i of order) {
        this.pushVertex(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!, nn[i * 3]!, nn[i * 3 + 1]!, nn[i * 3 + 2]!);
        this.col.push(data.color[i * 3]!, data.color[i * 3 + 1]!, data.color[i * 3 + 2]!);
        this.pat.push(data.pattern[i]!);
        this.ink.push(data.inkId[i]!);
        this.edg.push(data.edge[i]!);
        this.swy.push(data.sway[i]!);
      }
    }
    if (m) this.pop();
    return this;
  }

  // ── result ─────────────────────────────────────────────────────────────

  get vertexCount(): number {
    return this.pos.length / 3;
  }
  get triangleCount(): number {
    return this.pos.length / 9;
  }

  build(): MeshData {
    return {
      position: new Float32Array(this.pos),
      normal: new Float32Array(this.nor),
      color: new Uint8Array(this.col),
      pattern: new Uint8Array(this.pat),
      inkId: new Uint16Array(this.ink),
      edge: new Float32Array(this.edg),
      sway: new Float32Array(this.swy),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────

  private pushVertex(x: number, y: number, z: number, nx: number, ny: number, nz: number): void {
    if (this.isIdentity) {
      this.pos.push(x, y, z);
      this.nor.push(nx, ny, nz);
      return;
    }
    const m = this.matrix, k = this.normalMat;
    this.pos.push(
      m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
      m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
      m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
    );
    const tx = k[0]! * nx + k[1]! * ny + k[2]! * nz;
    const ty = k[3]! * nx + k[4]! * ny + k[5]! * nz;
    const tz = k[6]! * nx + k[7]! * ny + k[8]! * nz;
    const len = Math.hypot(tx, ty, tz) || 1;
    this.nor.push(tx / len, ty / len, tz / len);
  }

  private emit(v: readonly [Vec3, Vec3, Vec3], opts?: FaceOptions | false, flat?: Vec3): void {
    const o = opts || undefined;
    const n = o?.normals ? undefined : (flat ?? faceNormal(v[0], v[1], v[2]));
    if (n && n[0] === 0 && n[1] === 0 && n[2] === 0) return; // degenerate
    const s = this.state;
    const order = this.flip ? [2, 1, 0] : [0, 1, 2];
    for (const i of order) {
      const p = v[i]!;
      const vn = o?.normals ? norm3(o.normals[i]!) : n!;
      this.pushVertex(p[0], p[1], p[2], vn[0], vn[1], vn[2]);
      if (o?.colors) {
        const [r, g, b] = parseColor(o.colors[i]!);
        this.col.push(r, g, b);
      } else {
        this.col.push(s.r, s.g, s.b);
      }
      this.pat.push(s.pattern);
      this.ink.push(s.ink);
      this.edg.push(o?.edge ? o.edge[i]! : s.edge);
      const sway = typeof s.sway === 'function' ? s.sway(p[0], p[1], p[2]) : s.sway;
      this.swy.push(sway < 0 ? 0 : sway > 1 ? 1 : sway);
    }
  }
}

function norm3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len === 0 ? [0, 0, 0] : [v[0] / len, v[1] / len, v[2] / len];
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3, d?: Vec3): Vec3 {
  if (d) return newell([a, b, c, d]);
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return norm3([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
}

/** Newell's method: a robust normal for a polygon that may be slightly non-planar. */
function newell(points: readonly Vec3[]): Vec3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!, q = points[(i + 1) % points.length]!;
    nx += (p[1] - q[1]) * (p[2] + q[2]);
    ny += (p[2] - q[2]) * (p[0] + q[0]);
    nz += (p[0] - q[0]) * (p[1] + q[1]);
  }
  return norm3([nx, ny, nz]);
}

/**
 * Ear-clipping triangulation of a simple polygon given as 2D points (either
 * winding). Returns index triples, each wound like a positive-area polygon.
 */
export function triangulate(points: readonly (readonly [number, number])[]): [number, number, number][] {
  const n = points.length;
  if (n < 3) return [];
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i]!, q = points[(i + 1) % n]!;
    area += p[0] * q[1] - q[0] * p[1];
  }
  const idx: number[] = [];
  for (let i = 0; i < n; i++) idx.push(area >= 0 ? i : n - 1 - i);
  const cross = (a: number, b: number, c: number): number => {
    const A = points[a]!, B = points[b]!, C = points[c]!;
    return (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
  };
  const inside = (a: number, b: number, c: number, p: number): boolean =>
    cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  const out: [number, number, number][] = [];
  let guard = n * n + 8;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length]!, b = idx[i]!, c = idx[(i + 1) % idx.length]!;
      if (cross(a, b, c) <= 0) continue; // reflex or collinear
      let ear = true;
      for (const p of idx) {
        if (p === a || p === b || p === c) continue;
        if (inside(a, b, c, p)) {
          ear = false;
          break;
        }
      }
      if (!ear) continue;
      out.push([a, b, c]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) idx.splice(0, 1); // degenerate input: drop a vertex and carry on
  }
  if (idx.length === 3) out.push([idx[0]!, idx[1]!, idx[2]!]);
  return out;
}

// ─────────────────────────────────────────────────────────── utilities ──

export function emptyMesh(): MeshData {
  return {
    position: new Float32Array(0),
    normal: new Float32Array(0),
    color: new Uint8Array(0),
    pattern: new Uint8Array(0),
    inkId: new Uint16Array(0),
    edge: new Float32Array(0),
    sway: new Float32Array(0),
  };
}

/** Concatenates meshes into one (ink ids kept, so seams between them stay). */
export function mergeMeshes(meshes: readonly MeshData[]): MeshData {
  let verts = 0;
  for (const m of meshes) verts += m.position.length / 3;
  const out: MeshData = {
    position: new Float32Array(verts * 3),
    normal: new Float32Array(verts * 3),
    color: new Uint8Array(verts * 3),
    pattern: new Uint8Array(verts),
    inkId: new Uint16Array(verts),
    edge: new Float32Array(verts),
    sway: new Float32Array(verts),
  };
  let v = 0;
  for (const m of meshes) {
    out.position.set(m.position, v * 3);
    out.normal.set(m.normal, v * 3);
    out.color.set(m.color, v * 3);
    out.pattern.set(m.pattern, v);
    out.inkId.set(m.inkId, v);
    out.edge.set(m.edge, v);
    out.sway.set(m.sway, v);
    v += m.position.length / 3;
  }
  return out;
}

/** A copy of the mesh placed by `m` (normals and winding handled, mirrors included). */
export function transformMesh(mesh: MeshData, m: Mat4Like): MeshData {
  return new MeshBuilder().add(mesh, m).build();
}

export function vertexCount(mesh: MeshData): number {
  return mesh.position.length / 3;
}
export function triangleCount(mesh: MeshData): number {
  return mesh.position.length / 9;
}

export function meshBounds(mesh: MeshData): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const p = mesh.position;
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (p[i + k]! < min[k]!) min[k] = p[i + k]!;
      if (p[i + k]! > max[k]!) max[k] = p[i + k]!;
    }
  }
  return { min, max };
}
