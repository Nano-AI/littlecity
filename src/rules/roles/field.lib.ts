// The playing field's shape table (design section 7, "Field"). Pure; read by
// R-G03 (which pins the answer on the region as a role and a `field-court`
// feature), by the field generator, by the court furniture rule (D40), by
// the games in src/life/field and by the field guide.
//
// HOW A PATCH OF FIELD IS READ
//
// 1. The playing rectangle: the largest rectangle of the region's cells
//    with nothing standing in them (a tree, a fountain, a stall). Ties go to
//    the one nearest the north-west. It must hold at least three cells and
//    three quarters of the region; otherwise there is no court and the patch
//    is a kickabout green. So a cell or two more or less round a court (a
//    notch, a bump, a tree in a corner) leaves the court as it was, standing
//    in a little grass apron.
// 2. The court, from the rectangle's short side a and long side b (cells):
//
//      a \ b   1–2        3          4          5          6          7+
//      1       green      boules     boules     track      track      track
//      2       green      basketball tennis     tennis     tennis     track (two lanes)
//      3                  basketball basketball tennis     tennis     football
//      4                             bowls      croquet    football   football
//      5+                                       football   football   football
//
//    (green = kickabout green; bowls = bowling green; track = running track.)
//    Growing a court a row at a time walks along a row or down a column of
//    the table, so it only ever turns into the next size of game: a strip
//    becomes a track, a basketball court a tennis court, a tennis court a
//    pitch.
// 3. The court runs along the rectangle's long side (along x for a square).
// 4. A field never climbs a terrain step: each level is a region of its own
//    (src/resolve/structures.ts), so every court is flat.
//
// Surfaces: basketball is a hard court; tennis is clay, or grass beside a
// garden (else grass one time in three, by the region's seed); football,
// bowls, croquet and greens are grass; boules is gravel; the track is red
// cinder. In winter (life's season signal) a basketball court or a bowling
// green floods into a skating rink: that is drawn by life, not the plan.

import { key, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import type { FeatureVariant, RolesOf } from '@/core/vocab';
import type { ShapePlan, Structure } from '@/resolve/plan';

export type FieldRole = RolesOf<'field'>;

export const FIELD_ROLES: readonly FieldRole[] = ['basketball-court', 'tennis-court', 'football-pitch', 'bowling-green', 'croquet-lawn', 'boules-court', 'running-track', 'kickabout-green'];

/** A rectangle of cells: x0, z0 its lowest corner, w cells along x, d along z. */
export interface CellRect {
  x0: number;
  z0: number;
  w: number;
  d: number;
}

/** The fewest cells a court can have, and the share of the region it must cover. */
export const COURT_MIN_CELLS = 3;
export const COURT_MIN_SHARE = 0.75;

/** The court for a playing rectangle of short side a and long side b (cells), from the table above. */
export function courtFor(a: number, b: number): FieldRole {
  if (a > b) [a, b] = [b, a];
  if (a <= 0) return 'kickabout-green';
  if (a === 1) return b <= 2 ? 'kickabout-green' : b <= 4 ? 'boules-court' : 'running-track';
  if (a === 2) return b === 2 ? 'kickabout-green' : b === 3 ? 'basketball-court' : b <= 6 ? 'tennis-court' : 'running-track';
  if (a === 3) return b <= 4 ? 'basketball-court' : b <= 6 ? 'tennis-court' : 'football-pitch';
  if (a === 4) return b === 4 ? 'bowling-green' : b === 5 ? 'croquet-lawn' : 'football-pitch';
  return 'football-pitch';
}

/**
 * The largest rectangle of usable cells (all at the region's level), or null if there are none. `usable`
 * says whether a region cell is clear to play on. Ties: the larger short side (a squarer court), then the
 * lowest z0, then the lowest x0.
 */
export function largestRect(cells: readonly CellKey[], usable: (c: CellKey) => boolean = () => true): CellRect | null {
  if (cells.length === 0) return null;
  const y = keyY(cells[0]!);
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, keyX(c));
    maxX = Math.max(maxX, keyX(c));
    minZ = Math.min(minZ, keyZ(c));
    maxZ = Math.max(maxZ, keyZ(c));
  }
  const W = maxX - minX + 1, D = maxZ - minZ + 1;
  const ok = new Uint8Array(W * D);
  const set = new Set(cells);
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const c = key(minX + x, y, minZ + z);
      ok[z * W + x] = set.has(c) && usable(c) ? 1 : 0;
    }
  }
  // Histogram method, row by row: heights of usable runs upward, then every rectangle ending on this row.
  const h = new Int32Array(W);
  let best: CellRect | null = null;
  let bestArea = 0, bestShort = 0;
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) h[x] = ok[z * W + x] ? h[x]! + 1 : 0;
    for (let x0 = 0; x0 < W; x0++) {
      let height = Infinity;
      for (let x1 = x0; x1 < W; x1++) {
        height = Math.min(height, h[x1]!);
        if (height === 0) break;
        // Every height up to the run's: a shorter, wider rectangle can be the squarer one.
        for (let hh = height; hh >= 1; hh--) {
          const w = x1 - x0 + 1, area = w * hh, short = Math.min(w, hh);
          const z0 = minZ + z - hh + 1, X0 = minX + x0;
          const better =
            area > bestArea ||
            (area === bestArea && (short > bestShort || (short === bestShort && best !== null && (z0 < best.z0 || (z0 === best.z0 && X0 < best.x0)))));
          if (better) {
            best = { x0: X0, z0, w, d: hh };
            bestArea = area;
            bestShort = short;
          }
          if (area < bestArea && w * height < bestArea) break;
        }
      }
    }
  }
  return best;
}

export interface FieldReading {
  role: FieldRole;
  /**
   * The playing rectangle: the court's for a court; for a plain green, the largest clear rectangle in it
   * (where its games are played). Null only when no cell is clear.
   */
  rect: CellRect | null;
  /** The court runs along x (0) or z (1). */
  along: 0 | 1;
}

/** What a field region is (steps 1 to 3 above). */
export function readField(cells: readonly CellKey[], usable: (c: CellKey) => boolean = () => true): FieldReading {
  const rect = largestRect(cells, usable);
  if (!rect) return { role: 'kickabout-green', rect: null, along: 0 };
  const along = rect.w >= rect.d ? 0 : 1;
  const area = rect.w * rect.d;
  if (area < COURT_MIN_CELLS || area < cells.length * COURT_MIN_SHARE) return { role: 'kickabout-green', rect, along };
  return { role: courtFor(rect.w, rect.d), rect, along };
}

/** The court a field region was given (R-G03's role and field-court feature), or null. */
export function fieldCourtOf(plan: Pick<ShapePlan, 'roles' | 'featuresByStructure'>, s: Pick<Structure, 'id'>, cellH: number): Court | null {
  const role = plan.roles.get(s.id)?.role as FieldRole | undefined;
  const f = (plan.featuresByStructure.get(s.id) ?? []).find((x) => x.type === 'field-court');
  if (!role || !f || f.cell === undefined) return null;
  const p = f.params as { x0: number; z0: number; w: number; d: number; along: number };
  return courtOf(role, { x0: p.x0, z0: p.z0, w: p.w, d: p.d }, p.along === 1 ? 1 : 0, keyY(f.cell), cellH, f.variant);
}

// ─────────────────────────────────────────────────────────── geometry ──

/**
 * A court in the world: its middle, the unit vector along it (u) and across it (v), and its half length
 * and half width (to the drawn outer line). Everything about a court (lines, furniture, where players
 * stand) is measured in (u, v) from the middle.
 */
export interface Court {
  role: FieldRole;
  cx: number;
  cz: number;
  /** World height of the playing surface. */
  y: number;
  ux: number;
  uz: number;
  /** Half length and half width of the outer lines. */
  hl: number;
  hw: number;
  /** Half length and half width of the playing rectangle (to the cell edges). */
  rl: number;
  rw: number;
  rect: CellRect;
  along: 0 | 1;
  /** The playing surface (R-G03). */
  surface: FeatureVariant<'field-court'>;
}

/** How far the outer lines stand in from the edge of the playing rectangle, world units. */
export const COURT_INSET = 0.13;
/** How high the playing surface stands above its cell's floor. */
export const FIELD_LIFT = 0.015;

export function courtOf(role: FieldRole, rect: CellRect, along: 0 | 1, level: number, cellH: number, surface?: string): Court {
  const L = along === 0 ? rect.w : rect.d, W = along === 0 ? rect.d : rect.w;
  return {
    role,
    cx: rect.x0 + rect.w / 2,
    cz: rect.z0 + rect.d / 2,
    y: level * cellH + FIELD_LIFT,
    ux: along === 0 ? 1 : 0,
    uz: along === 0 ? 0 : 1,
    hl: L / 2 - COURT_INSET,
    hw: W / 2 - COURT_INSET,
    rl: L / 2,
    rw: W / 2,
    rect,
    along,
    surface: (surface ?? 'grass') as FeatureVariant<'field-court'>,
  };
}

/** World x, z of a court point (u along, v across). v runs to the court's left looking along +u. */
export function courtPoint(c: Court, u: number, v: number): [number, number] {
  return [c.cx + c.ux * u + c.uz * v, c.cz + c.uz * u - c.ux * v];
}
/** Court (u, v) of a world point. */
export function courtLocal(c: Court, x: number, z: number): [number, number] {
  const dx = x - c.cx, dz = z - c.cz;
  return [dx * c.ux + dz * c.uz, dx * c.uz - dz * c.ux];
}
/** The heading (0 faces +z) of a direction given in court terms. */
export function courtHeading(c: Court, du: number, dv: number): number {
  const dx = c.ux * du + c.uz * dv, dz = c.uz * du - c.ux * dv;
  return Math.atan2(dx, dz);
}
/** The cell under a world point at the court's level. */
export function cellUnder(c: Court, level: number, x: number, z: number): CellKey {
  return key(Math.floor(x), level, Math.floor(z));
}

/** Where a basketball hoop's rim is: u of its centre (±), its height above the court. */
export function hoopOf(c: Court): { u: number; height: number; post: number } {
  return { u: c.hl - 0.22, height: 0.74, post: c.hl + 0.05 };
}
/** A football goal: u of its line (±), half its width and its height. */
export function goalOf(c: Court): { u: number; half: number; height: number } {
  const small = c.hw < 1.4;
  return { u: c.hl, half: small ? 0.32 : 0.48, height: small ? 0.26 : 0.32 };
}
/** A tennis court: the singles half width, the net's height at the posts. */
export function tennisOf(c: Court): { singles: number; net: number; service: number } {
  const doubles = c.hw > 1.1;
  return { singles: doubles ? c.hw * 0.78 : c.hw, net: 0.15, service: c.hl * 0.54 };
}
