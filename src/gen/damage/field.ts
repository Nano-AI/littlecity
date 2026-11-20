// Where a damaged structure is broken (Mischief). Owner: Mischief. Pure.
//
// Damage is drawn per column of a structure (one x, z of its cells): the
// worst block in the column decides how that column looks. A column is cut
// by a "field": the ground plan is divided into small square tiles, and each
// tile has a tilted plane; everything above it is gone. Tiles that differ in
// height and tilt give a wall a jagged, stepped top, like broken masonry.
// All of it is seeded by the structure, so the same ruin always breaks the
// same way.

import { CELL_H, columnIndex, inColumnBounds, key, keyX, keyY, keyZ, SEA_Y, type CellKey } from '@/core/grid';
import type { StructureKind } from '@/core/kinds';
import { rand } from '@/core/rand';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { RUIN } from '@/style/damage';
import { MEND_STEPS, unpackRuin, type DamageCause, type DamageStage } from '@/world/damage';

/**
 * Where mending has got, phase by phase (each 0 not begun to 1 done): rubble cleared, scaffolding up,
 * the timber frame, the walls course by course, rafters, tiles row by row, glazing, paint, and the
 * scaffolding coming down. Which phases there are depends on the damage being mended.
 */
export interface MendPhases {
  clear: number;
  scaffold: number;
  frame: number;
  walls: number;
  rafters: number;
  tiles: number;
  glass: number;
  paint: number;
  down: number;
}
export const DONE: MendPhases = Object.freeze({ clear: 1, scaffold: 1, frame: 1, walls: 1, rafters: 1, tiles: 1, glass: 1, paint: 1, down: 0 });

const SPANS: Record<number, Partial<Record<keyof MendPhases, [number, number]>>> = {
  3: { clear: [0, 0.1], scaffold: [0.06, 0.14], frame: [0.12, 0.22], walls: [0.2, 0.5], rafters: [0.5, 0.6], tiles: [0.6, 0.8], glass: [0.8, 0.86], paint: [0.86, 0.95], down: [0.95, 1] },
  2: { clear: [0, 0.05], scaffold: [0, 0.08], walls: [0.08, 0.3], rafters: [0.3, 0.42], tiles: [0.42, 0.72], glass: [0.72, 0.82], paint: [0.82, 0.94], down: [0.94, 1] },
  1: { scaffold: [0, 0.12], glass: [0.12, 0.4], paint: [0.4, 0.88], down: [0.88, 1] },
  0: { scaffold: [0, 0.1], paint: [0, 0.8], down: [0.8, 1] },
};

export function mendPhases(stage: number, q: number): MendPhases {
  const spans = SPANS[stage] ?? SPANS[0]!;
  const out = { ...DONE };
  for (const k of Object.keys(DONE) as (keyof MendPhases)[]) {
    const span = spans[k];
    if (!span) continue;
    out[k] = Math.max(0, Math.min(1, (q - span[0]) / (span[1] - span[0])));
  }
  return out;
}

/** Kinds that hardly burn: fire only soots them (stone cracks and tumbles instead). */
export const STONE_KINDS: ReadonlySet<StructureKind> = new Set<StructureKind>([
  'tower', 'lighthouse', 'arch', 'marble', 'pillar', 'stairs', 'wall', 'fountain',
]);

/** Kinds that fall over in one piece when blown down, rather than breaking into a heap. */
export const TOPPLE_KINDS: ReadonlySet<StructureKind> = new Set<StructureKind>(['tree', 'pillar']);

export interface Column {
  x: number;
  z: number;
  /** World y of the bottom of its lowest cell, and the top of its highest. */
  base: number;
  top: number;
  /** World y of the bottom of the lowest destroyed (stage 3) cell, or the top when there is none. */
  wreckBase: number;
  /** The worst damage in the column, as drawn (stone never shows more than scorching from fire). */
  stage: DamageStage;
  cause: DamageCause;
  mending: boolean;
  settling: boolean;
  /** How far mending has got, 0–1, and its phases (all 1 when not mending). */
  progress: number;
  phases: MendPhases;
  /** Any damage at all (stage ≥ 1, or mending). */
  damaged: boolean;
}

export interface Plane {
  h: number;
  gx: number;
  gz: number;
  /** Tile centre. */
  cx: number;
  cz: number;
}

/** A tile's plane at a point. */
export function planeAt(p: Plane, x: number, z: number): number {
  return p.h + p.gx * (x - p.cx) + p.gz * (z - p.cz);
}

export interface Profile {
  s: Structure;
  plan: ShapePlan;
  columns: Map<number, Column>;
  /** Column key: x | z << 6. */
  colKey(x: number, z: number): number;
  /** The structure's column nearest to a point (eaves reach past the walls), or null if none is close. */
  columnNear(x: number, z: number): Column | null;
  /** Any column with damage. */
  damaged: boolean;
  /** Ground height (world y) of the open ground in a column beside the structure, or null if it is built on or higher than `level`. */
  openGround(x: number, z: number, level: number): number | null;
}

export function profileOf(s: Structure, plan: ShapePlan): Profile {
  const columns = new Map<number, Column>();
  const colKey = (x: number, z: number): number => x | (z << 6);
  const stone = STONE_KINDS.has(s.kind);
  for (const c of s.cells as CellKey[]) {
    const x = keyX(c);
    const z = keyZ(c);
    const y = keyY(c);
    const k = colKey(x, z);
    let col = columns.get(k);
    if (!col) {
      col = { x, z, base: y * CELL_H, top: (y + 1) * CELL_H, wreckBase: Infinity, stage: 0, cause: 'fire', mending: false, settling: false, progress: 0, phases: DONE, damaged: false };
      columns.set(k, col);
    }
    col.base = Math.min(col.base, y * CELL_H);
    col.top = Math.max(col.top, (y + 1) * CELL_H);
    const d = unpackRuin(plan.world.blocks.get(c)?.ruin);
    let stage = d.stage;
    if (stone && d.cause === 'fire') stage = Math.min(stage, 1) as DamageStage;
    if (stage > col.stage || (stage === col.stage && d.cause === 'blast')) {
      col.stage = stage;
      col.cause = d.cause;
    }
    if (stage === 3) col.wreckBase = Math.min(col.wreckBase, y * CELL_H);
    if (d.mending) col.progress = col.mending ? Math.min(col.progress, d.progress / MEND_STEPS) : d.progress / MEND_STEPS;
    col.mending ||= d.mending;
    col.settling ||= d.settling;
    col.damaged ||= d.stage > 0 || d.mending;
  }
  let damaged = false;
  for (const col of columns.values()) {
    if (!Number.isFinite(col.wreckBase)) col.wreckBase = col.top;
    if (col.mending) col.phases = mendPhases(col.stage, col.progress);
    damaged ||= col.damaged;
  }
  const columnNear = (x: number, z: number): Column | null => {
    const fx = Math.floor(x);
    const fz = Math.floor(z);
    const own = columns.get(colKey(fx, fz));
    if (own) return own;
    let best: Column | null = null;
    let bestD = 0.45;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const col = columns.get(colKey(fx + dx, fz + dz));
        if (!col) continue;
        const ex = Math.max(col.x - x, 0, x - (col.x + 1));
        const ez = Math.max(col.z - z, 0, z - (col.z + 1));
        const d = Math.hypot(ex, ez);
        if (d < bestD) {
          bestD = d;
          best = col;
        }
      }
    }
    return best;
  };
  const openGround = (x: number, z: number, level: number): number | null => {
    if (!inColumnBounds(x, z)) return null;
    const h = plan.terrain.height[columnIndex(x, z)]!;
    const ground = h === 0 ? SEA_Y : h * CELL_H;
    if (ground > level + 1e-6) return null;
    const y = Math.max(h, 0);
    // Anything built in the cell at the ground (or just above it) blocks the spill.
    const cy = Math.round(level / CELL_H);
    for (let yy = Math.min(y, cy); yy <= cy; yy++) {
      if (plan.kinds.has(key(x, yy, z))) return null;
    }
    return ground;
  };
  return { s, plan, columns, colKey, columnNear, damaged, openGround };
}

/** Which tiles of a stage-2 column lose their roof: a seeded half of the structure, or a bite out of one corner. */
interface HoleShape {
  /** 0 = half (a straight-ish break across), 1 = bite (a round bite from one side). */
  variant: number;
  dirX: number;
  dirZ: number;
  offset: number;
  biteX: number;
  biteZ: number;
  biteR: number;
}

function holeShape(prof: Profile): HoleShape {
  const seed = prof.s.seed;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const c of prof.columns.values()) {
    if (c.stage < 2) continue;
    x0 = Math.min(x0, c.x);
    x1 = Math.max(x1, c.x + 1);
    z0 = Math.min(z0, c.z);
    z1 = Math.max(z1, c.z + 1);
  }
  if (!Number.isFinite(x0)) x0 = x1 = z0 = z1 = 0;
  const a = rand(seed, 'hole-dir') * Math.PI * 2;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const variant = rand(seed, 'hole-variant') < 0.5 ? 0 : 1;
  // The bite is centred on the edge of the damaged area, in the hole direction.
  const hw = (x1 - x0) / 2;
  const hd = (z1 - z0) / 2;
  const reach = Math.min(Math.abs(Math.cos(a)) > 1e-6 ? hw / Math.abs(Math.cos(a)) : Infinity, Math.abs(Math.sin(a)) > 1e-6 ? hd / Math.abs(Math.sin(a)) : Infinity);
  return {
    variant,
    dirX: Math.cos(a),
    dirZ: Math.sin(a),
    offset: (cx * Math.cos(a) + cz * Math.sin(a)) + (rand(seed, 'hole-offset') - 0.6) * 0.5,
    biteX: cx + Math.cos(a) * reach,
    biteZ: cz + Math.sin(a) * reach,
    biteR: 0.75 + rand(seed, 'bite-r') * 0.6 + Math.min(hw, hd) * 0.3,
  };
}

export type FieldMode =
  /** The ruin as it is now. */
  | 'now'
  /** Where the damage being mended cut it (what mending has put back above it is fresh). */
  | 'damage';

/**
 * The cut field of a structure: for a tile (by its integer tile indices), the
 * plane above which nothing is left, or null where it is whole.
 */
export function cutField(prof: Profile, mode: FieldMode = 'now'): (ix: number, iz: number) => Plane | null {
  const T = RUIN.tile;
  const seed = prof.s.seed;
  const hole = holeShape(prof);
  const stoneish = STONE_KINDS.has(prof.s.kind);
  const memo = new Map<number, Plane | null>();
  return (ix, iz) => {
    const k = (ix + 1000) * 4096 + (iz + 1000);
    if (memo.has(k)) return memo.get(k)!;
    const cx = (ix + 0.5) * T;
    const cz = (iz + 0.5) * T;
    const col = prof.columnNear(cx, cz);
    let plane: Plane | null = null;
    if (col && col.damaged) plane = tilePlane(col, ix, iz, cx, cz);
    memo.set(k, plane);
    return plane;
  };

  function tilePlane(col: Column, ix: number, iz: number, cx: number, cz: number): Plane | null {
    const r1 = rand(seed, 'tile', ix, iz);
    const r2 = rand(seed, 'tile-gx', ix, iz) - 0.5;
    const r3 = rand(seed, 'tile-gz', ix, iz) - 0.5;
    // Tiles at the corners of a column stand a little higher (corners are the strongest part of a wall).
    const fx = cx - col.x;
    const fz = cz - col.z;
    const corner = (fx < 0.3 || fx > 0.7) && (fz < 0.3 || fz > 0.7) ? 1 : 0;
    const shell = (cause: DamageCause): Plane | null => {
      if (prof.s.kind === 'dock') return r1 < 0.8 ? { h: SEA_Y + 0.04 + r1 * 0.15, gx: r2, gz: r3, cx, cz } : null;
      if (cause === 'fire' && !stoneish) {
        const h = col.wreckBase + CELL_H * (RUIN.shellMin + (RUIN.shellMax - RUIN.shellMin) * r1 + corner * 0.25);
        return { h: Math.min(h, col.top - 0.04), gx: r2 * 0.9, gz: r3 * 0.9, cx, cz };
      }
      const h = col.wreckBase + CELL_H * (RUIN.stubMin + (RUIN.stubMax - RUIN.stubMin) * r1 + corner * 0.12);
      return { h: Math.min(h, col.top - 0.04), gx: r2 * 1.4, gz: r3 * 1.4, cx, cz };
    };
    const roofOff = (deep: number): Plane | null => {
      // Is this tile in the hole?
      let depth: number;
      if (hole.variant === 0) {
        const along = cx * hole.dirX + cz * hole.dirZ - hole.offset;
        if (along < 0) return null;
        depth = Math.min(1, along / 0.9);
      } else {
        const d = Math.hypot(cx - hole.biteX, cz - hole.biteZ);
        if (d > hole.biteR) return null;
        depth = 1 - d / hole.biteR;
      }
      const h = col.top - CELL_H * (deep * (0.25 + 0.75 * depth) * (0.55 + 0.45 * r1));
      return { h: Math.max(h, col.base + 0.08), gx: r2 * 1.1, gz: r3 * 1.1, cx, cz };
    };
    const damageCut = (): Plane | null => {
      if (col.stage === 3) return shell(col.cause);
      if (col.stage === 2) {
        if (prof.s.kind === 'dock') return r1 < 0.45 ? { h: SEA_Y + 0.06 + r1 * 0.1, gx: r2, gz: r3, cx, cz } : null;
        return roofOff(col.cause === 'fire' ? 0.9 : 1.15);
      }
      return null;
    };
    if (mode === 'damage') return col.mending ? damageCut() : null;
    if (col.mending) {
      // Rebuilding: the walls rise course by course (a level line over the broken tops), then the roof
      // goes back on row by row from the eaves.
      const was = damageCut();
      if (!was) return null;
      const ph = col.phases;
      if (prof.s.kind === 'dock') return ph.walls < 1 ? was : null;
      if (ph.walls < 1) {
        const from = col.stage === 3 ? col.wreckBase : col.top - CELL_H * 1.2;
        const level = from + (col.top - from) * ph.walls;
        return level > was.h ? { h: level, gx: 0, gz: 0, cx, cz } : was;
      }
      if (ph.tiles < 1) return { h: col.top + 1.25 * ph.tiles, gx: 0, gz: 0, cx, cz };
      return null;
    }
    if (col.stage === 3) return shell(col.cause);
    if (col.stage === 2) {
      if (prof.s.kind === 'dock') return r1 < 0.45 ? { h: SEA_Y + 0.06 + r1 * 0.1, gx: r2, gz: r3, cx, cz } : null;
      const deep = col.cause === 'fire' ? 0.9 : 1.15;
      return roofOff(deep);
    }
    if (col.stage === 1 && prof.s.kind === 'dock' && col.cause === 'blast' && r1 < 0.12) {
      return { h: SEA_Y + 0.1, gx: r2, gz: r3, cx, cz };
    }
    return null;
  }
}
