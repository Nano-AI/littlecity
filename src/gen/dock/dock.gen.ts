// Docks (J23): touching dock blocks are one timber deck on stilts.
//
//   deck    planks along the run, one ink group across every cell, no faces
//           between merged cells. Its top is exactly CELL_H, flush with a
//           beach and with a block standing on it. On open sides it overhangs
//           its frame, and where plank ENDS are exposed each board stops at
//           its own length (seeded), in step with the shader's plank lines.
//   frame   a darker beam under the deck's open edges.
//   piles   stilts at corners and every 2 cells along open edges, standing in
//           the water (they run on down under the surface), cross-braced
//           along the edge. Free corners carry a post that rises through the
//           deck with a white-painted top. Nothing on sides that meet land
//           or a wall.
//   sill    a threshold board where the deck meets level ground.
//   ladder  drawn here for the dock's `ladder` features (R-D02).
//
// Everything else (pier head, bollards, ramp, crane, goods, mooring piles)
// is a feature drawn by its part in src/parts/ground.
//
// Reads only what the structure hash covers: its cells, their side and upper
// neighbours, the terrain round them, and its features.

import { above, CELL_H, columnIndex, inColumnBounds, key, keyX, keyZ, neighbor, SEA_Y, type CellKey, type Dir4 } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { rand } from '@/core/rand';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { faceFrame } from '@/gen/frames';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { tube } from '@/parts/ground/kit';
import type { Feature, ShapePlan, Structure } from '@/resolve/plan';
import { DIRS, dockSide, type DockSide } from '@/rules/roles/dock-shape';
import { DOCK } from '@/style/dock';
import { PALETTE } from '@/style/palette';
import { dockColors } from './wood';

type Axis = 'x' | 'z';
const N: Dir4 = 0, E: Dir4 = 1, S: Dir4 = 2, W: Dir4 = 3;

interface DockCell {
  cell: CellKey;
  x: number;
  z: number;
  side: DockSide[];
  /** How far the deck reaches past the cell line on each side. */
  ext: number[];
  /** Which way this cell's planks run. */
  axis: Axis;
}

const extOf = (s: DockSide): number => (s === 'open' ? DOCK.over : s === 'cliff' || s === 'solid' ? DOCK.tuck : 0);
/** The side at the low end (0) or the high end (1) of side `d`'s edge. */
const perp = (d: Dir4, end: 0 | 1): Dir4 => (d === E || d === W ? (end === 0 ? N : S) : end === 0 ? W : E);
const isPlankEnd = (axis: Axis, d: Dir4): boolean => (axis === 'x' ? d === E || d === W : d === N || d === S);

function layoutOf(s: Structure, plan: ShapePlan): Map<CellKey, DockCell> {
  const mine = new Set(s.cells);
  let x0 = 99, x1 = -1, z0 = 99, z1 = -1;
  for (const c of s.cells) {
    x0 = Math.min(x0, keyX(c));
    x1 = Math.max(x1, keyX(c));
    z0 = Math.min(z0, keyZ(c));
    z1 = Math.max(z1, keyZ(c));
  }
  const sides = new Map<CellKey, DockSide[]>();
  // A neighbouring dock that is not ours cannot happen (touching docks merge), but stay safe.
  for (const c of s.cells) {
    sides.set(c, DIRS.map((d): DockSide => {
      const v = dockSide(plan, c, d);
      return v === 'dock' && !mine.has(neighbor(c, d)) ? 'solid' : v;
    }));
  }
  // The run: the longer way; a square or a single block runs out from the shore, or else by seed.
  let main: Axis;
  if (x1 - x0 !== z1 - z0) main = x1 - x0 > z1 - z0 ? 'x' : 'z';
  else {
    let shoreX = 0, shoreZ = 0;
    for (const c of s.cells) {
      const sd = sides.get(c)!;
      if (sd[E] === 'land' || sd[W] === 'land') shoreX++;
      if (sd[N] === 'land' || sd[S] === 'land') shoreZ++;
    }
    main = shoreX !== shoreZ ? (shoreX > shoreZ ? 'x' : 'z') : rand(s.seed, 'run') < 0.5 ? 'x' : 'z';
  }
  const out = new Map<CellKey, DockCell>();
  for (const c of s.cells) {
    const side = sides.get(c)!;
    // Planks follow the arm a cell is in; where arms meet, the one that runs straight through. A cell in
    // the body of a wide deck (part of a 2 × 2 block of it) follows the dock's run.
    const x = keyX(c), z = keyZ(c);
    const has = (dx: number, dz: number): boolean => inColumnBounds(x + dx, z + dz) && mine.has(key(x + dx, 0, z + dz));
    const body = [[-1, -1], [1, -1], [-1, 1], [1, 1]].some(([dx, dz]) => has(dx!, 0) && has(0, dz!) && has(dx!, dz!));
    const ew = side[E] === 'dock' || side[W] === 'dock', ns = side[N] === 'dock' || side[S] === 'dock';
    const throughX = side[E] === 'dock' && side[W] === 'dock', throughZ = side[N] === 'dock' && side[S] === 'dock';
    const axis: Axis = body ? main : ew && !ns ? 'x' : ns && !ew ? 'z' : throughX && !throughZ ? 'x' : throughZ && !throughX ? 'z' : main;
    out.set(c, { cell: c, x: keyX(c), z: keyZ(c), side, ext: side.map(extOf), axis });
  }
  return out;
}

/** A point on side `d` of a cell: `al` along the edge (0–1, growing with the world axis), `out` past the cell line. */
function edgePoint(c: DockCell, d: Dir4, al: number, out: number): [number, number] {
  if (d === E) return [c.x + 1 + out, c.z + al];
  if (d === W) return [c.x - out, c.z + al];
  if (d === S) return [c.x + al, c.z + 1 + out];
  return [c.x + al, c.z - out];
}
const OUT: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

class Deck {
  constructor(
    readonly b: MeshBuilder,
    readonly cells: Map<CellKey, DockCell>,
    readonly seed: number,
  ) {}
  readonly yTop = CELL_H;
  readonly yUnder = CELL_H - DOCK.deckThick;

  top(p: readonly [number, number], q: readonly [number, number], y = this.yTop): void {
    const x0 = Math.min(p[0], q[0]), x1 = Math.max(p[0], q[0]), z0 = Math.min(p[1], q[1]), z1 = Math.max(p[1], q[1]);
    if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) return;
    this.b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]);
  }
  /** An upright face from a to b, facing (nx, nz). */
  wall(a: readonly [number, number], q: readonly [number, number], y0: number, y1: number, nx: number, nz: number): void {
    let p0 = a, p1 = q;
    const ux = p1[0] - p0[0], uz = p1[1] - p0[1];
    if (Math.hypot(ux, uz) < 1e-6) return;
    if (-uz * nx + ux * nz < 0) [p0, p1] = [p1, p0];
    this.b.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]);
  }

  /** The stretch of deck past the cell line on one side: its top, and its faces where the side is open. */
  strip(c: DockCell, d: Dir4): void {
    const cls = c.side[d]!, e = c.ext[d]!;
    if (e <= 0) return;
    const open = cls === 'open';
    const ragged = open && DOCK.ragged > 0 && isPlankEnd(c.axis, d);
    const range = [0, 1];
    /** How far out the deck beside each end already reaches (so no face is needed up to there). */
    const flank = [0, 0];
    const tame = [false, false];
    for (const end of [0, 1] as const) {
      const p = perp(d, end);
      const cp = c.side[p]!;
      const sign = end === 0 ? -1 : 1;
      if (cp !== 'dock') {
        if (c.ext[p]! > 0) {
          // A corner of the deck: one of the two strips covers it.
          const pRagged = cp === 'open' && DOCK.ragged > 0 && isPlankEnd(c.axis, p);
          const owner = ragged ? d : pRagged ? p : d === E || d === W ? d : p;
          if (owner === d) range[end]! += sign * c.ext[p]!;
          else flank[end] = Infinity;
          if (cp !== 'open') flank[end] = Infinity;
        }
      } else {
        const nb = this.cells.get(neighbor(c.cell, p))!;
        const nc = nb.side[d]!;
        if (nc === 'dock') {
          // An inner corner: the north or south strip keeps it, the east or west strip gives way.
          flank[end] = Infinity;
          if (d === E || d === W) range[end]! -= sign * e;
          else tame[end] = true;
        } else if (nc === cls && (!open || nb.axis === c.axis)) flank[end] = Infinity;
        else flank[end] = extOf(nc);
      }
    }
    const [a0, a1] = range as [number, number];
    const [ox, oz] = OUT[d]!;
    const alongSign = (end: 0 | 1): [number, number] => (d === E || d === W ? [0, end === 0 ? -1 : 1] : [end === 0 ? -1 : 1, 0]);
    const flankFace = (end: 0 | 1, reach: number): void => {
      if (!open || !(reach > flank[end]! + 1e-6)) return;
      const al = end === 0 ? a0 : a1;
      const [nx, nz] = alongSign(end);
      this.wall(edgePoint(c, d, al, flank[end]!), edgePoint(c, d, al, reach), this.yUnder, this.yTop, nx, nz);
    };
    if (!ragged) {
      this.top(edgePoint(c, d, a0, 0), edgePoint(c, d, a1, e));
      if (open) this.wall(edgePoint(c, d, a0, e), edgePoint(c, d, a1, e), this.yUnder, this.yTop, ox, oz);
      flankFace(0, e);
      flankFace(1, e);
      return;
    }
    // Plank ends: one piece per board of the shader's plank pattern (nine to a cell, a line every 1/9).
    const base = d === E || d === W ? c.z : c.x;
    const line = `${d}:${d === E || d === W ? c.x : c.z}`;
    const w0 = base + a0, w1 = base + a1;
    const pieces: { p0: number; p1: number; len: number }[] = [];
    for (let k = Math.floor(w0 * 9 + 0.5 + 1e-6); k <= Math.floor(w1 * 9 + 0.5 - 1e-6); k++) {
      const p0 = Math.max(w0, (k - 0.5) / 9) - base, p1 = Math.min(w1, (k + 0.5) / 9) - base;
      if (p1 - p0 < 1e-6) continue;
      let len = e + rand(this.seed, 'board', line, k) * DOCK.ragged;
      if (rand(this.seed, 'proud', line, k) < 0.14) len += DOCK.ragged * 0.7;
      // Beside an inner corner the boards stay short, so they do not lie over the strip round the corner.
      if ((tame[0] && p0 < e) || (tame[1] && p1 > 1 - e)) len = e;
      pieces.push({ p0, p1, len });
    }
    for (let i = 0; i < pieces.length; i++) {
      const { p0, p1, len } = pieces[i]!;
      this.top(edgePoint(c, d, p0, 0), edgePoint(c, d, p1, len));
      this.wall(edgePoint(c, d, p0, len), edgePoint(c, d, p1, len), this.yUnder, this.yTop, ox, oz);
      const next = pieces[i + 1];
      if (next && Math.abs(next.len - len) > 1e-6) {
        // The side of the longer board shows past the shorter one.
        const [nx, nz] = alongSign(len > next.len ? 1 : 0);
        this.wall(edgePoint(c, d, p1, Math.min(len, next.len)), edgePoint(c, d, p1, Math.max(len, next.len)), this.yUnder, this.yTop, nx, nz);
      }
    }
    if (pieces.length) {
      flankFace(0, pieces[0]!.len);
      flankFace(1, pieces[pieces.length - 1]!.len);
    }
  }
}

interface Stilt {
  x: number;
  z: number;
  /** Rises through the deck as a corner post. */
  proud: boolean;
}

/** Stilts by grid vertex (vx + vz × 64): corners of the deck and every second vertex along its open edges. */
function stiltsOf(s: Structure, plan: ShapePlan, cells: Map<CellKey, DockCell>): Map<number, Stilt> {
  const out = new Map<number, Stilt>();
  let bx = 99, bz = 99;
  for (const c of cells.values()) {
    bx = Math.min(bx, c.x);
    bz = Math.min(bz, c.z);
  }
  const at = (x: number, z: number): DockCell | undefined => (inColumnBounds(x, z) ? cells.get(key(x, 0, z)) : undefined);
  const land = (x: number, z: number): boolean => inColumnBounds(x, z) && plan.terrain.height[columnIndex(x, z)]! > 0;
  const seen = new Set<number>();
  for (const c of cells.values()) {
    for (const [vx, vz] of [[c.x, c.z], [c.x + 1, c.z], [c.x, c.z + 1], [c.x + 1, c.z + 1]] as const) {
      const k = vx + vz * 64;
      if (seen.has(k)) continue;
      seen.add(k);
      // The four cells round the vertex: NW, NE, SW, SE.
      const round = [[vx - 1, vz - 1], [vx, vz - 1], [vx - 1, vz], [vx, vz]] as const;
      const m = round.map(([x, z]) => at(x, z));
      const count = m.filter(Boolean).length;
      if (count === 4) continue;
      if (round.some(([x, z], i) => !m[i] && land(x, z))) continue;
      const [nw, ne, sw, se] = m;
      // The deck edges that meet at the vertex.
      const edges: DockSide[] = [];
      const edge = (a: DockCell | undefined, da: Dir4, bb: DockCell | undefined, db: Dir4): void => {
        if (a && !bb) edges.push(a.side[da]!);
        else if (bb && !a) edges.push(bb.side[db]!);
      };
      edge(nw, E, ne, W);
      edge(ne, S, se, N);
      edge(sw, E, se, W);
      edge(nw, S, sw, N);
      if (!edges.includes('open')) continue;
      let sx = 0, sz = 0;
      [nw, ne, sw, se].forEach((c, i) => {
        if (!c) return;
        sx += i % 2 === 0 ? -1 : 1;
        sz += i < 2 ? -1 : 1;
      });
      if (count === 2 && (sx !== 0 || sz !== 0)) {
        // A straight edge: every second vertex.
        const along = sx === 0 ? vx - bx : vz - bz;
        if (along % 2 !== 0) continue;
      }
      const corner = count === 1 ? m.find(Boolean)! : undefined;
      const proud = corner !== undefined && edges.every((e) => e === 'open') && !plan.kinds.has(above(corner.cell));
      out.set(k, { x: vx + Math.sign(sx) * DOCK.stiltInset, z: vz + Math.sign(sz) * DOCK.stiltInset, proud });
    }
  }
  return out;
}

/** The outward side of the deck along the grid line from vertex (vx, vz) one step along +x or +z, if that edge is open. */
function openEdge(cells: Map<CellKey, DockCell>, vx: number, vz: number, alongX: boolean): Dir4 | null {
  const get = (x: number, z: number): DockCell | undefined => (inColumnBounds(x, z) ? cells.get(key(x, 0, z)) : undefined);
  if (alongX) {
    const north = get(vx, vz - 1), south = get(vx, vz);
    if (north && !south && north.side[S] === 'open') return S;
    if (south && !north && south.side[N] === 'open') return N;
  } else {
    const west = get(vx - 1, vz), east = get(vx, vz);
    if (west && !east && west.side[E] === 'open') return E;
    if (east && !west && east.side[W] === 'open') return W;
  }
  return null;
}

function drawLadder(b: MeshBuilder, f: Feature): void {
  if (f.cell === undefined || f.dir === undefined) return;
  const length = (f.params as { length?: number } | undefined)?.length ?? 1;
  const foot = CELL_H - length * CELL_H + SEA_Y - 0.14;
  const out = DOCK.over + 0.045, top = CELL_H + 0.3, back = -0.13;
  b.at(faceFrame(f.cell, f.dir as Dir4), () => {
    b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: `ladder:${f.id}` }, () => {
      for (const x of [-0.115, 0.115]) {
        // A rail down into the water, and a hoop over the deck's edge to hold on to.
        tube(b, [[x, foot, out], [x, top, out]], 0.02, { seg: 5 });
        tube(b, [[x, top, out + 0.015], [x, top, back - 0.015]], 0.02, { seg: 5, capEnd: true, capStart: true });
        tube(b, [[x, CELL_H, back], [x, top, back]], 0.02, { seg: 5 });
      }
      for (let y = CELL_H - 0.07; y > SEA_Y - 0.05; y -= 0.115) tube(b, [[-0.115, y, out], [0.115, y, out]], 0.016, { seg: 4 });
    });
  });
}

/** Draws a dock's own timber (deck, frame, piles, sills) into `b`. */
export function drawDock(b: MeshBuilder, s: Structure, plan: ShapePlan): void {
  const cells = layoutOf(s, plan);
  const colors = dockColors(s.color);
  const deck = new Deck(b, cells, s.seed);
  const features = plan.featuresByStructure.get(s.id) ?? [];
  const ramps = new Set(features.filter((f) => f.type === 'ramp').map((f) => `${f.cell}:${f.dir}`));

  // ── the deck: one surface ──
  for (const c of cells.values()) {
    b.with({ color: colors.deck, pattern: c.axis === 'x' ? PATTERN.planks : PATTERN.planksAcross, ink: 'deck' }, () => {
      deck.top([c.x, c.z], [c.x + 1, c.z + 1]);
      for (const d of DIRS) deck.strip(c, d);
    });
  }

  // ── the frame: a beam under every open edge ──
  const yBeam = deck.yUnder - DOCK.beam;
  b.with({ color: colors.frame, pattern: PATTERN.none, ink: 'frame' }, () => {
    for (const c of cells.values()) {
      for (const d of DIRS) {
        if (c.side[d] !== 'open') continue;
        deck.wall(edgePoint(c, d, 0, 0), edgePoint(c, d, 1, 0), yBeam, deck.yUnder, OUT[d]![0], OUT[d]![1]);
      }
    }
  });

  // ── sills: a threshold board where the deck meets level ground (unless a ramp lies there) ──
  b.with({ color: colors.frame, pattern: PATTERN.none, ink: 'sill' }, () => {
    for (const c of cells.values()) {
      for (const d of DIRS) {
        if (c.side[d] !== 'land' || ramps.has(`${c.cell}:${d}`)) continue;
        const p = edgePoint(c, d, 0.03, -0.05), q = edgePoint(c, d, 0.97, 0.05);
        b.box([Math.min(p[0], q[0]), CELL_H, Math.min(p[1], q[1])], [Math.max(p[0], q[0]), CELL_H + 0.022, Math.max(p[1], q[1])], { skip: ['bottom'] });
      }
    }
  });

  // ── piles: stilts, corner posts and the bracing between them ──
  const stilts = stiltsOf(s, plan, cells);
  const foot = SEA_Y - 0.3;
  b.with({ color: colors.pile, pattern: PATTERN.bark, ink: 'piles' }, () => {
    for (const [k, st] of stilts) {
      const r = (...p: (number | string)[]): number => rand(s.seed, 'stilt', k, ...p);
      const lean = st.proud ? 0.3 : 1;
      const fx = st.x + (r('lx') - 0.5) * 2 * DOCK.stiltLean * lean, fz = st.z + (r('lz') - 0.5) * 2 * DOCK.stiltLean * lean;
      const radius = DOCK.stiltRadius * (0.92 + r('r') * 0.16);
      if (!st.proud) {
        tube(b, [[fx, foot, fz], [st.x, deck.yUnder, st.z]], radius, { seg: 7 });
        continue;
      }
      const top = CELL_H + DOCK.postRise + r('rise') * DOCK.postVary;
      const paint = 0.07;
      tube(b, [[fx, foot, fz], [st.x, top - paint, st.z]], radius, { seg: 7 });
      b.with({ color: PALETTE.white, pattern: PATTERN.none }, () => tube(b, [[st.x, top - paint, st.z], [st.x, top, st.z]], radius, { seg: 7, capEnd: true }));
    }
    if (DOCK.brace > 0) {
      // Raking struts: from the head of each stilt down into the water, toward the next stilt along the edge.
      const yHigh = yBeam + 0.03, yLow = SEA_Y - 0.12;
      const strut = (from: Stilt, to: Stilt): void => {
        const dx = to.x - from.x, dz = to.z - from.z;
        const dist = Math.hypot(dx, dz);
        const run = Math.min(DOCK.braceRun, dist / 2);
        tube(b, [[from.x, yHigh, from.z], [from.x + (dx / dist) * run, yLow, from.z + (dz / dist) * run]], DOCK.brace, { seg: 4 });
      };
      for (const [k, st] of stilts) {
        const vx = k % 64, vz = (k / 64) | 0;
        for (const alongX of [true, false]) {
          const side = openEdge(cells, vx, vz, alongX);
          if (side === null) continue;
          for (let step = 1; step <= 2; step++) {
            const far = stilts.get(alongX ? k + step : k + step * 64);
            if (far) {
              strut(st, far);
              strut(far, st);
              break;
            }
            // The edge must stay open, on the same side, to the next vertex.
            if (step === 2 || openEdge(cells, alongX ? vx + 1 : vx, alongX ? vz : vz + 1, alongX) !== side) break;
          }
        }
      }
    }
  });

  for (const f of features) if (f.type === 'ladder') drawLadder(b, f);
}

export default defineGenerator({
  kind: 'dock',
  build(s, plan, parts) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: s.id });
    drawDock(b, s, plan);
    // Ladders are drawn above; every other feature has a part.
    placeFeatures(b, anchors, s, plan, parts, (f) => (f.type === 'ladder' ? null : undefined));
    return { mesh: b.build(), anchors };
  },
});
