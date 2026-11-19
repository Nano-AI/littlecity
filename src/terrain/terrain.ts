// The island generator (design section 6). Owner: Logic.
//
// generateTerrain(seed) rolls an island, checks every required feature and
// re-rolls (with a derived seed) until all are present: one island with at
// least 5 columns of water on every side, 35–50% land, a beach of 8+
// columns, a hill of height 4+, a cliff, a cove, and 40%+ of the land at
// height 1 or 2 in flat 3 × 3 patches. Pure and deterministic per seed.
// The Look owner draws it; this file only makes the data.

import { columnIndex, inColumnBounds, key, SIZE_X, SIZE_Z } from '@/core/grid';
import { rand, randInt, randRange } from '@/core/rand';
import { MAT, type Terrain, type World } from '@/core/world';
import { ISLAND } from '@/style/island';
import { applyEdit, canApply, emptyWorld } from '@/world/world';

export type { Terrain, TerrainMaterial } from '@/core/world';
export { MAT } from '@/core/world';

const N = SIZE_X * SIZE_Z;
const D4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

// ──────────────────────────────────────────────────────────── noise ──

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1) on a lattice of the given cell size. */
function valueNoise(seed: number, layer: string, x: number, z: number, size: number): number {
  const fx = x / size;
  const fz = z / size;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = smooth(fx - ix);
  const tz = smooth(fz - iz);
  const v = (a: number, b: number): number => rand(seed, layer, a, b);
  const top = v(ix, iz) + (v(ix + 1, iz) - v(ix, iz)) * tx;
  const bot = v(ix, iz + 1) + (v(ix + 1, iz + 1) - v(ix, iz + 1)) * tx;
  return top + (bot - top) * tz;
}

/** Two octaves of value noise, in [0, 1). */
function fbm(seed: number, layer: string, x: number, z: number, size: number): number {
  return (valueNoise(seed, layer + '1', x, z, size) * 2 + valueNoise(seed, layer + '2', x, z, size / 2)) / 3;
}

// ───────────────────────────────────────────────────────── helpers ──

function hAt(h: Uint8Array, x: number, z: number): number {
  return inColumnBounds(x, z) ? h[columnIndex(x, z)]! : 0;
}

/** Labels 4-connected components of columns where `inSet` is true. Returns labels (−1 outside) and sizes. */
function components(inSet: (i: number) => boolean): { label: Int32Array; sizes: number[] } {
  const label = new Int32Array(N).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < N; start++) {
    if (label[start] !== -1 || !inSet(start)) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % SIZE_X;
      const z = (i / SIZE_X) | 0;
      for (const [dx, dz] of D4) {
        const nx = x + dx;
        const nz = z + dz;
        if (!inColumnBounds(nx, nz)) continue;
        const j = columnIndex(nx, nz);
        if (label[j] === -1 && inSet(j)) {
          label[j] = id;
          stack.push(j);
        }
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

/** Steps (4-connected) from each land column to the nearest water column. */
function coastDistance(h: Uint8Array): Int32Array {
  const dist = new Int32Array(N).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < N; i++) {
    if (h[i] === 0) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const x = i % SIZE_X;
    const z = (i / SIZE_X) | 0;
    for (const [dx, dz] of D4) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inColumnBounds(nx, nz)) continue;
      const j = columnIndex(nx, nz);
      if (dist[j] === -1) {
        dist[j] = dist[i]! + 1;
        queue.push(j);
      }
    }
  }
  return dist;
}

// ──────────────────────────────────────────────────────── checking ──

export interface TerrainReport {
  landFraction: number;
  /** Fewest water columns between the land and the map border. */
  borderWater: number;
  islands: number;
  beach: number;
  hill: number;
  cliffs: number;
  coves: number;
  /** Share of the land at height 1 or 2 inside a flat 3 × 3 patch. */
  flatShare: number;
  /** What is missing; empty when the island is acceptable. */
  problems: string[];
}

/** Measures an island against design section 6. */
export function checkTerrain(h: Uint8Array): TerrainReport {
  let land = 0;
  let borderWater = Infinity;
  let beach = 0;
  let hill = 0;
  let cliffs = 0;
  let coves = 0;
  const flat = new Uint8Array(N);
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const here = hAt(h, x, z);
      if (here > 0) {
        land++;
        borderWater = Math.min(borderWater, x, z, SIZE_X - 1 - x, SIZE_Z - 1 - z);
        hill = Math.max(hill, here);
        let waterSide = false;
        for (const [dx, dz] of D4) {
          const n = hAt(h, x + dx, z + dz);
          if (n === 0) waterSide = true;
          if (Math.abs(n - here) >= 2 && n > 0 && (dx > 0 || dz > 0)) cliffs++;
        }
        if (here === 1 && waterSide) beach++;
        if ((here === 1 || here === 2) && x + 2 < SIZE_X && z + 2 < SIZE_Z) {
          let same = true;
          for (let dz = 0; dz < 3 && same; dz++) for (let dx = 0; dx < 3 && same; dx++) same = hAt(h, x + dx, z + dz) === here;
          if (same) for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) flat[columnIndex(x + dx, z + dz)] = 1;
        }
      } else {
        let landSides = 0;
        for (const [dx, dz] of D4) if (hAt(h, x + dx, z + dz) > 0) landSides++;
        if (landSides === 3) coves++;
      }
    }
  }
  let flatCount = 0;
  for (let i = 0; i < N; i++) flatCount += flat[i]!;
  const islands = components((i) => h[i]! > 0).sizes.length;
  const landFraction = land / N;
  const flatShare = land ? flatCount / land : 0;
  const problems: string[] = [];
  if (landFraction < 0.35 || landFraction > 0.5) problems.push(`land ${(landFraction * 100).toFixed(1)}% (35–50%)`);
  if (borderWater < 5) problems.push(`only ${borderWater} columns of water at the border`);
  if (islands !== 1) problems.push(`${islands} islands`);
  if (beach < 8) problems.push(`beach of ${beach} columns`);
  if (hill < 4) problems.push(`highest ground ${hill}`);
  if (cliffs < 1) problems.push('no cliff');
  if (coves < 1) problems.push('no cove');
  if (flatShare < 0.4) problems.push(`flat share ${(flatShare * 100).toFixed(1)}%`);
  return { landFraction, borderWater, islands, beach, hill, cliffs, coves, flatShare, problems };
}

// ─────────────────────────────────────────────────────── generating ──

/** The island's outline: a wobbly disc scaled by `scale`. */
function outline(s: number, scale: number): Uint8Array {
  const h = new Uint8Array(N);
  const cx = (SIZE_X - 1) / 2 + randRange(-1.5, 1.5, s, 'cx');
  const cz = (SIZE_Z - 1) / 2 + randRange(-1.5, 1.5, s, 'cz');
  const harmonics = [2, 3, 4, 5].map((k) => ({ k, a: randRange(0.03, 0.16, s, 'amp', k) / Math.sqrt(k - 1), p: randRange(0, Math.PI * 2, s, 'phase', k) }));
  const m = ISLAND.border;
  for (let z = m; z < SIZE_Z - m; z++) {
    for (let x = m; x < SIZE_X - m; x++) {
      const dx = x - cx;
      const dz = z - cz;
      const theta = Math.atan2(dz, dx);
      let r = 1;
      for (const { k, a, p } of harmonics) r += a * Math.sin(k * theta + p);
      const d = Math.hypot(dx, dz) / (scale * r) + (fbm(s, 'coast', x, z, 5) - 0.5) * ISLAND.coastNoise;
      if (d < 1) h[columnIndex(x, z)] = 1;
    }
  }
  // One island: keep the biggest piece of land, and fill lakes (water cut off from the sea).
  const land = components((i) => h[i]! > 0);
  let biggest = 0;
  for (let c = 1; c < land.sizes.length; c++) if (land.sizes[c]! > land.sizes[biggest]!) biggest = c;
  for (let i = 0; i < N; i++) if (h[i]! > 0 && land.label[i] !== biggest) h[i] = 0;
  const water = components((i) => h[i] === 0);
  const sea = water.label[0]!;
  for (let i = 0; i < N; i++) if (h[i] === 0 && water.label[i] !== sea) h[i] = 1;
  return h;
}

function landShare(h: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < N; i++) if (h[i]! > 0) n++;
  return n / N;
}

/** Raises terraces and one hill (with a steep, cliffed side) on a flat island. */
function sculpt(s: number, h: Uint8Array): void {
  const coast = coastDistance(h);
  // The hill: an inland centre, a peak of 4–6, one side much steeper than the rest.
  const inland: number[] = [];
  let far = 0;
  for (let i = 0; i < N; i++) far = Math.max(far, coast[i]!);
  for (let i = 0; i < N; i++) if (h[i]! > 0 && coast[i]! >= Math.min(far, ISLAND.hillInland)) inland.push(i);
  const centre = inland[Math.floor(rand(s, 'hill') * inland.length)]!;
  const hx = centre % SIZE_X;
  const hz = (centre / SIZE_X) | 0;
  const peak = randInt(4, 6, s, 'peak');
  const radius = randRange(ISLAND.hillRadius[0], ISLAND.hillRadius[1], s, 'hillRadius');
  const steepDir = randRange(0, Math.PI * 2, s, 'steep');
  const raised = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (h[i] === 0) continue;
    const x = i % SIZE_X;
    const z = (i / SIZE_X) | 0;
    // Terraces at height 2: broad, smooth-edged plateaus away from the coast.
    let level = 1;
    if (coast[i]! >= 3 && fbm(s, 'terrace', x, z, 9) > ISLAND.terraceAbove) level = 2;
    // The hill.
    const dx = x - hx;
    const dz = z - hz;
    const d = Math.hypot(dx, dz) * (1 + (fbm(s, 'hillEdge', x, z, 4) - 0.5) * 0.5);
    const steep = 1 + ISLAND.cliffSteepness * Math.max(0, Math.cos(Math.atan2(dz, dx) - steepDir));
    const e = peak * (1 - (d * steep) / radius);
    level = Math.max(level, Math.round(e));
    // Keep the shore low so there is a beach to land on.
    level = Math.min(level, coast[i]! + 1, 6);
    raised[i] = Math.max(1, level);
  }
  // Smooth single-column spikes and pits.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < N; i++) {
      if (raised[i] === 0) continue;
      const x = i % SIZE_X;
      const z = (i / SIZE_X) | 0;
      let lo = 9;
      let hi = 0;
      for (const [dx, dz] of D4) {
        const n = hAt(raised, x + dx, z + dz);
        if (n === 0) {
          lo = 0;
          continue;
        }
        lo = Math.min(lo, n);
        hi = Math.max(hi, n);
      }
      if (lo > 0 && raised[i]! > hi) raised[i] = hi;
      else if (lo > 0 && raised[i]! < lo) raised[i] = lo;
    }
  }
  h.set(raised);
}

/** Makes sure there is a cove: carve one coastal column into a notch with land on three sides. */
function carveCove(s: number, h: Uint8Array): void {
  if (checkTerrain(h).coves > 0) return;
  const options: number[] = [];
  for (let z = 1; z < SIZE_Z - 1; z++) {
    for (let x = 1; x < SIZE_X - 1; x++) {
      if (hAt(h, x, z) !== 1) continue;
      let water = 0;
      let waterDir = -1;
      for (let d = 0; d < 4; d++) {
        if (hAt(h, x + D4[d]![0], z + D4[d]![1]) === 0) {
          water++;
          waterDir = d;
        }
      }
      if (water !== 1) continue;
      // The three land sides must stay land, and the island must stay in one piece.
      const [wx, wz] = D4[waterDir]!;
      const sideA = hAt(h, x + wz, z + wx) > 0 && hAt(h, x + wz - wx, z + wx - wz) > 0;
      const sideB = hAt(h, x - wz, z - wx) > 0 && hAt(h, x - wz - wx, z - wx - wz) > 0;
      if (sideA && sideB) options.push(columnIndex(x, z));
    }
  }
  if (!options.length) return;
  h[options[Math.floor(rand(s, 'cove') * options.length)]!] = 0;
}

function roll(s: number): Uint8Array {
  // Size the outline to land near the middle of the 35–50% band.
  let scale = randRange(15.5, 17.5, s, 'scale');
  let h = outline(s, scale);
  for (let i = 0; i < 3; i++) {
    const share = landShare(h);
    if (share >= 0.37 && share <= 0.48) break;
    scale *= Math.sqrt(0.425 / Math.max(share, 0.01));
    h = outline(s, scale);
  }
  sculpt(s, h);
  carveCove(s, h);
  return h;
}

/** The island for a seed. Pure and deterministic. */
export function generateTerrain(seed: number): Terrain {
  let fallback: Uint8Array | null = null;
  for (let attempt = 0; attempt < ISLAND.attempts; attempt++) {
    const h = roll(attempt === 0 ? seed : rand(seed, 'reroll', attempt) * 4294967296);
    if (checkTerrain(h).problems.length === 0) return terrainFromHeights(seed, h);
    fallback ??= h;
  }
  return terrainFromHeights(seed, fallback!);
}

/**
 * A Terrain from a height field, with materials derived: water at height 0,
 * sand on land at height 1 beside water, grass elsewhere. Scenarios with
 * hand-made terrain use this.
 */
export function terrainFromHeights(seed: number, height: Uint8Array): Terrain {
  if (height.length !== SIZE_X * SIZE_Z) throw new Error('terrainFromHeights: height must have 48 × 48 entries');
  const material = new Uint8Array(SIZE_X * SIZE_Z);
  const h = (x: number, z: number): number => (inColumnBounds(x, z) ? height[columnIndex(x, z)]! : 0);
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const here = h(x, z);
      let mat: number = MAT.grass;
      if (here === 0) mat = MAT.water;
      else if (here === 1 && (h(x - 1, z) === 0 || h(x + 1, z) === 0 || h(x, z - 1) === 0 || h(x, z + 1) === 0)) mat = MAT.sand;
      material[columnIndex(x, z)] = mat;
    }
  }
  return { seed, height, material };
}

/** The world a new island starts with: 6–14 starting trees (real, removable blocks) on grass, nothing else. */
export function initialWorld(seed: number, t: Terrain): World {
  let w = emptyWorld(seed);
  const want = randInt(ISLAND.trees[0], ISLAND.trees[1], seed, 'trees');
  const grass: number[] = [];
  for (let i = 0; i < N; i++) if (t.height[i]! > 0 && t.material[i] === MAT.grass) grass.push(i);
  if (!grass.length) return w;
  // A few clumps: each tree is near a clump centre, so they read as copses rather than confetti.
  const clumps = randInt(2, 4, seed, 'clumps');
  const centres = Array.from({ length: clumps }, (_, c) => grass[Math.floor(rand(seed, 'clump', c) * grass.length)]!);
  for (let i = 0, placed = 0; placed < want && i < 400; i++) {
    const c = centres[i % clumps]!;
    const x = (c % SIZE_X) + randInt(-3, 3, seed, 'tx', i);
    const z = ((c / SIZE_X) | 0) + randInt(-3, 3, seed, 'tz', i);
    if (!inColumnBounds(x, z) || t.material[columnIndex(x, z)] !== MAT.grass) continue;
    const cell = key(x, t.height[columnIndex(x, z)]!, z);
    const e = { type: 'placeBlock', cell, kind: 'tree', color: 'auto', from: null } as const;
    if (!canApply(w, t, e).ok) continue;
    w = applyEdit(w, t, e);
    placed++;
  }
  // Clumps landing on unlucky ground: top up anywhere on grass.
  for (let i = 0; w.blocks.size < ISLAND.trees[0] && i < 1000; i++) {
    const c = grass[Math.floor(rand(seed, 'spare', i) * grass.length)]!;
    const e = { type: 'placeBlock', cell: key(c % SIZE_X, t.height[c]!, (c / SIZE_X) | 0), kind: 'tree', color: 'auto', from: null } as const;
    if (canApply(w, t, e).ok) w = applyEdit(w, t, e);
  }
  return w;
}

/** Terrain height of a column; 0 (water) outside the map. */
export function heightAt(t: Terrain, x: number, z: number): number {
  return inColumnBounds(x, z) ? t.height[columnIndex(x, z)]! : 0;
}
