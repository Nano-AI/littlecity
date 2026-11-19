// The second island generator (design section 6, "Terrain, second
// generation"). Owner: Terrain 2. Generator 1 (terrain.ts) stays as it was;
// towns saved on it keep their island (World.terrainGen).
//
// One island, step by step, all pure and seeded:
//
//   1. a character, rolled from the seed: gentle, hilly, steep, or an
//      archipelago (two or three landmasses, or a ring round a lagoon);
//      and a number of rivers, 0, 1 or 2 (shares in src/style/island2.ts);
//   2. the land: wobbly blobs sized to the character's share of the map,
//      never nearer the map border than ISLAND2.border;
//   3. the ground: a height field per character (rolling terraces; several
//      hills; a mountain or ridge up to 10 with a plain on one side; low
//      islands), rounded to levels, the shore kept low except where a steep
//      island drops straight into the sea;
//   4. rivers: a walker leaves the sea and heads for a source inland (or for
//      the far coast), swinging either side of its line so the river
//      meanders; the channel is every column within a radius of its path,
//      wider at the mouth, sometimes ending in a pool or holding a small
//      island. Low ground beside it is cut into a valley; high ground is cut
//      sheer (a gorge). No two water columns meet only at a corner, so every
//      channel is one you could row along and the mesh never pinches it;
//   5. materials: sand on the sea shore and the river mouths, grass, and rock
//      on summits, cliff rims and gorge walls (rock is only a look);
//   6. the check (checkTerrain2): the border, no lakes, a beach, a sheltered
//      landing, 60+ columns of flat low ground, heights up to 10. A failure
//      re-rolls with a derived seed, keeping the character and rivers; after
//      ISLAND2.attempts it eases the rivers, then the character, and last of
//      all takes generator 1's island, so no seed ever loops.

import { columnIndex, inColumnBounds, SIZE_X, SIZE_Z } from '@/core/grid';
import { hash, pick, rand, randInt, randRange } from '@/core/rand';
import { MAT, type Terrain } from '@/core/world';
import { ISLAND2 } from '@/style/island2';
import { components, D4, distanceFrom, fbm, hAt, N, valueNoise } from './noise';

export type IslandCharacter = 'gentle' | 'hilly' | 'steep' | 'archipelago';
export const CHARACTERS: readonly IslandCharacter[] = ['gentle', 'hilly', 'steep', 'archipelago'];
/** The highest terrain generator 2 makes. */
export const MAX_HEIGHT_2 = 10;

export interface Island2 {
  terrain: Terrain;
  character: IslandCharacter;
  /** Rivers carved. */
  rivers: number;
  /** Of them, how many run coast to coast. */
  through: number;
  /** River columns (open water that belongs to a river, mouth included). */
  river: Uint8Array;
  /** Rolls it took (1 = the first passed). */
  attempts: number;
  /** True if every roll failed and generator 1's island was used. */
  fellBack: boolean;
}

const cx0 = (SIZE_X - 1) / 2;
const cz0 = (SIZE_Z - 1) / 2;
const xOf = (i: number): number => i % SIZE_X;
const zOf = (i: number): number => (i / SIZE_X) | 0;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

// ───────────────────────────────────────────────────────────── checking ──

export interface TerrainReport2 {
  landFraction: number;
  borderWater: number;
  /** Landmasses (4-connected). */
  islands: number;
  /** Water columns cut off from the sea. */
  lakes: number;
  /** Sand columns beside water. */
  beach: number;
  /** Water columns that make a sheltered landing (land on three sides, or on two opposite sides, beside low ground). */
  landings: number;
  /** Columns at height 1 or 2 inside flat 3 × 3 patches. */
  flatLow: number;
  highest: number;
  /** Neighbour pairs with a height jump of 2 or more. */
  cliffs: number;
  rock: number;
  problems: string[];
}

/** Measures an island against the hard requirements of design section 6 (second generation). */
export function checkTerrain2(t: Terrain): TerrainReport2 {
  const h = t.height;
  let land = 0;
  let borderWater = Infinity;
  let beach = 0;
  let landings = 0;
  let highest = 0;
  let cliffs = 0;
  let rock = 0;
  const flat = new Uint8Array(N);
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const i = columnIndex(x, z);
      const here = h[i]!;
      if (here > 0) {
        land++;
        borderWater = Math.min(borderWater, x, z, SIZE_X - 1 - x, SIZE_Z - 1 - z);
        highest = Math.max(highest, here);
        if (t.material[i] === MAT.rock) rock++;
        let wet = false;
        for (const [dx, dz] of D4) {
          const n = hAt(h, x + dx, z + dz);
          if (n === 0) wet = true;
          if ((dx > 0 || dz > 0) && n > 0 && Math.abs(n - here) >= 2) cliffs++;
        }
        if (wet && t.material[i] === MAT.sand) beach++;
        if ((here === 1 || here === 2) && x + 2 < SIZE_X && z + 2 < SIZE_Z) {
          let same = true;
          for (let dz = 0; dz < 3 && same; dz++) for (let dx = 0; dx < 3 && same; dx++) same = hAt(h, x + dx, z + dz) === here;
          if (same) for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) flat[columnIndex(x + dx, z + dz)] = 1;
        }
      } else {
        const l = D4.map(([dx, dz]) => hAt(h, x + dx, z + dz));
        const sides = l.filter((v) => v > 0).length;
        const opposite = (l[0]! > 0 && l[1]! > 0) || (l[2]! > 0 && l[3]! > 0);
        if ((sides >= 3 || (sides === 2 && opposite)) && l.some((v) => v === 1)) landings++;
      }
    }
  }
  let flatLow = 0;
  for (let i = 0; i < N; i++) flatLow += flat[i]!;
  const islands = components((i) => h[i]! > 0).sizes.length;
  const water = components((i) => h[i] === 0);
  const sea = water.label[0]!;
  let lakes = 0;
  for (let i = 0; i < N; i++) if (h[i] === 0 && water.label[i] !== sea) lakes++;
  const landFraction = land / N;
  const problems: string[] = [];
  if (landFraction < 0.2 || landFraction > 0.56) problems.push(`land ${(landFraction * 100).toFixed(1)}%`);
  if (borderWater < ISLAND2.border) problems.push(`only ${borderWater} columns of water at the border`);
  if (lakes) problems.push(`${lakes} lake columns`);
  if (highest > MAX_HEIGHT_2) problems.push(`height ${highest}`);
  if (beach < ISLAND2.beachMin) problems.push(`beach of ${beach} columns`);
  if (landings < 1) problems.push('no sheltered landing');
  if (flatLow < ISLAND2.flatMin) problems.push(`flat low ground ${flatLow} columns`);
  return { landFraction, borderWater, islands, lakes, beach, landings, flatLow, highest, cliffs, rock, problems };
}

// ─────────────────────────────────────────────────────────────── land ──

interface Blob {
  cx: number;
  cz: number;
  /** Radii along and across `angle`. */
  ra: number;
  rb: number;
  angle: number;
  harm: { k: number; a: number; p: number }[];
}

function makeBlob(s: number, tag: string, cx: number, cz: number, r: number, stretch: number): Blob {
  const harm = [2, 3, 4, 5].map((k) => ({ k, a: randRange(0.03, 0.15, s, tag, 'amp', k) / Math.sqrt(k - 1), p: randRange(0, Math.PI * 2, s, tag, 'phase', k) }));
  return { cx, cz, ra: r * stretch, rb: r / stretch, angle: randRange(0, Math.PI, s, tag, 'angle'), harm };
}

/** < 1 inside the blob. */
function blobD(b: Blob, x: number, z: number, scale: number): number {
  const dx = x - b.cx;
  const dz = z - b.cz;
  const c = Math.cos(b.angle);
  const sn = Math.sin(b.angle);
  const u = (dx * c + dz * sn) / b.ra;
  const v = (-dx * sn + dz * c) / b.rb;
  const theta = Math.atan2(dz, dx);
  let r = 1;
  for (const { k, a, p } of b.harm) r += a * Math.sin(k * theta + p);
  return Math.hypot(u, v) / (scale * r);
}

interface LandPlan {
  blobs: Blob[];
  /** A ring: land only beyond this fraction of the blob, and a gap to the sea. */
  ring: { inner: number; gap: number; gapWidth: number } | null;
  share: [number, number];
}

function planLand(s: number, ch: IslandCharacter): LandPlan {
  const jx = randRange(-1.5, 1.5, s, 'cx');
  const jz = randRange(-1.5, 1.5, s, 'cz');
  if (ch === 'archipelago') {
    if (rand(s, 'lagoon') < 0.4) {
      return {
        blobs: [makeBlob(s, 'ring', cx0 + jx, cz0 + jz, 16.5, randRange(1, 1.15, s, 'stretch'))],
        ring: { inner: randRange(0.42, 0.55, s, 'inner'), gap: randRange(0, Math.PI * 2, s, 'gap'), gapWidth: randRange(1.6, 2.6, s, 'gapw') },
        share: [0.24, 0.36],
      };
    }
    const n = randInt(2, 3, s, 'pieces');
    const a0 = randRange(0, Math.PI * 2, s, 'a0');
    const blobs: Blob[] = [];
    for (let k = 0; k < n; k++) {
      const a = a0 + (k * Math.PI * 2) / n + randRange(-0.3, 0.3, s, 'aj', k);
      const d = n === 2 ? randRange(8, 9.5, s, 'ad', k) : randRange(9, 10.5, s, 'ad', k);
      const r = (n === 2 ? 10 : 8.4) * randRange(0.8, 1.15, s, 'ar', k);
      blobs.push(makeBlob(s, `p${k}`, cx0 + jx + Math.cos(a) * d, cz0 + jz + Math.sin(a) * d, r, randRange(1, 1.3, s, 'as', k)));
    }
    return { blobs, ring: null, share: [0.28, 0.4] };
  }
  const stretch = ch === 'steep' ? randRange(1.05, 1.35, s, 'stretch') : randRange(1, 1.2, s, 'stretch');
  const share: [number, number] = ch === 'steep' ? [0.34, 0.45] : ch === 'hilly' ? [0.37, 0.48] : [0.38, 0.5];
  return { blobs: [makeBlob(s, 'main', cx0 + jx, cz0 + jz, 16.5, stretch)], ring: null, share };
}

function rasterLand(s: number, plan: LandPlan, scale: number): Uint8Array {
  const m = ISLAND2.border;
  const land = new Uint8Array(N);
  for (let z = m; z < SIZE_Z - m; z++) {
    for (let x = m; x < SIZE_X - m; x++) {
      let d = Infinity;
      for (const b of plan.blobs) d = Math.min(d, blobD(b, x, z, scale));
      d += (fbm(s, 'coast2', x, z, 5) - 0.5) * 0.38;
      let inside = d < 1;
      if (inside && plan.ring) {
        const b = plan.blobs[0]!;
        const inner = plan.ring.inner + (fbm(s, 'lagoon', x, z, 4) - 0.5) * 0.18;
        if (d < inner) inside = false;
        const a = Math.atan2(z - b.cz, x - b.cx);
        const off = Math.abs(Math.atan2(Math.sin(a - plan.ring.gap), Math.cos(a - plan.ring.gap)));
        if (off * Math.hypot(x - b.cx, z - b.cz) < plan.ring.gapWidth) inside = false;
      }
      if (inside) land[columnIndex(x, z)] = 1;
    }
  }
  return land;
}

function share(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < N; i++) if (mask[i]! > 0) n++;
  return n / N;
}

/** Drops specks of land smaller than `min`, then fills water cut off from the sea. */
function tidy(h: Uint8Array, min: number, keep?: Uint8Array): void {
  const land = components((i) => h[i]! > 0);
  for (let i = 0; i < N; i++) if (h[i]! > 0 && land.sizes[land.label[i]!]! < min && !keep?.[i]) h[i] = 0;
  const water = components((i) => h[i] === 0);
  const sea = water.label[0]!;
  for (let i = 0; i < N; i++) if (h[i] === 0 && water.label[i] !== sea) h[i] = 1;
}

/** No two water columns (and so no two land columns) meet only at a corner: such a pinch is drawn shut. */
function unpinch(h: Uint8Array, river: Uint8Array): void {
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (let z = 0; z + 1 < SIZE_Z; z++) {
      for (let x = 0; x + 1 < SIZE_X; x++) {
        const a = columnIndex(x, z), b = columnIndex(x + 1, z), c = columnIndex(x, z + 1), d = columnIndex(x + 1, z + 1);
        const wa = h[a] === 0, wb = h[b] === 0, wc = h[c] === 0, wd = h[d] === 0;
        let fix = -1;
        if (wa && wd && !wb && !wc) fix = h[b]! <= h[c]! ? b : c;
        else if (wb && wc && !wa && !wd) fix = h[a]! <= h[d]! ? a : d;
        if (fix < 0) continue;
        // Join the two waters through the lower of the two land columns.
        const isRiver = river[a] || river[b] || river[c] || river[d];
        h[fix] = 0;
        if (isRiver) river[fix] = 1;
        changed = true;
      }
    }
    if (!changed) return;
  }
}

// ────────────────────────────────────────────────────────────── ground ──

/** Levels for the land: a height field by character, rounded to whole levels. */
function sculpt2(s: number, ch: IslandCharacter, land: Uint8Array): { h: Uint8Array; peak: number; lowDir: number } {
  const h = new Uint8Array(N);
  const cd = distanceFrom((i) => land[i] === 0);
  let far = 0;
  let sx = 0, sz = 0, n = 0;
  for (let i = 0; i < N; i++) {
    if (!land[i]) continue;
    far = Math.max(far, cd[i]!);
    sx += xOf(i);
    sz += zOf(i);
    n++;
  }
  const mx = sx / Math.max(1, n), mz = sz / Math.max(1, n);
  const inland = (min: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < N; i++) if (land[i] && cd[i]! >= Math.min(far, min)) out.push(i);
    return out;
  };
  const E = new Float32Array(N);
  interface Hill { x: number; z: number; peak: number; r: number; steepDir: number; steep: number }
  const hillAt = (hl: Hill, x: number, z: number): number => {
    const dx = x - hl.x, dz = z - hl.z;
    const d = Math.hypot(dx, dz) * (1 + (fbm(s, 'hedge', x, z, 4) - 0.5) * 0.5);
    const k = 1 + hl.steep * Math.max(0, Math.cos(Math.atan2(dz, dx) - hl.steepDir));
    return hl.peak * (1 - (d * k) / hl.r);
  };
  const rollHills = (count: number, peak: [number, number], radius: [number, number], minInland: number, spread: number): Hill[] => {
    const spots = inland(minInland);
    const hills: Hill[] = [];
    for (let k = 0; k < count && spots.length; k++) {
      // Keep hills apart: take the best of a few tries.
      let best = spots[0]!, bestScore = -Infinity;
      for (let tr = 0; tr < 6; tr++) {
        const c = spots[Math.floor(rand(s, 'hill', k, tr) * spots.length)]!;
        let near = Infinity;
        for (const o of hills) near = Math.min(near, Math.hypot(xOf(c) - o.x, zOf(c) - o.z));
        const score = Math.min(near, spread) + rand(s, 'hillj', k, tr);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      hills.push({ x: xOf(best), z: zOf(best), peak: randInt(peak[0], peak[1], s, 'peak', k), r: randRange(radius[0], radius[1], s, 'hr', k), steepDir: randRange(0, Math.PI * 2, s, 'sd', k), steep: randRange(0.6, 2.4, s, 'st', k) });
    }
    return hills;
  };

  let peakH: number;
  let lowDir = randRange(0, Math.PI * 2, s, 'lowDir');
  if (ch === 'gentle') {
    const hills = rollHills(randInt(1, 2, s, 'hills'), [3, 5], [4.5, 8], 6, 9);
    for (let i = 0; i < N; i++) {
      if (!land[i]) continue;
      const x = xOf(i), z = zOf(i);
      let e = 1;
      if (cd[i]! >= 3 && fbm(s, 'terr', x, z, 9) > 0.56) e = 2;
      if (cd[i]! >= 5 && fbm(s, 'terr3', x, z, 7) > 0.7) e = 3;
      for (const hl of hills) e = Math.max(e, hillAt(hl, x, z));
      E[i] = Math.min(e, cd[i]! + 1);
    }
    peakH = 5;
  } else if (ch === 'hilly') {
    const hills = rollHills(randInt(3, 5, s, 'hills'), [5, 6], [4.5, 7.5], 4, 11);
    for (let i = 0; i < N; i++) {
      if (!land[i]) continue;
      const x = xOf(i), z = zOf(i);
      // Rolling ground with broad terraces, low by the shore.
      let e = 1 + Math.max(0, fbm(s, 'roll', x, z, 10) - 0.38) * 6 * clamp01((cd[i]! - 1) / 4);
      for (const hl of hills) e = Math.max(e, hillAt(hl, x, z));
      E[i] = Math.min(e, Math.floor(cd[i]! * 1.5) + 1);
    }
    peakH = 6;
  } else if (ch === 'steep') {
    peakH = randInt(ISLAND2.steepPeak[0], ISLAND2.steepPeak[1], s, 'peak');
    // The plain lies on the low side; the mountain stands back from it.
    const ux = Math.cos(lowDir), uz = Math.sin(lowDir);
    let pMax = -Infinity;
    for (let i = 0; i < N; i++) if (land[i]) pMax = Math.max(pMax, (xOf(i) - mx) * ux + (zOf(i) - mz) * uz);
    const back = randRange(0.5, 3, s, 'back');
    const ax = mx - ux * back, az = mz - uz * back;
    const ridge = rand(s, 'ridge') < 0.55;
    const ra = lowDir + Math.PI / 2 + randRange(-0.5, 0.5, s, 'ridgeA');
    const half = ridge ? randRange(3, 6.5, s, 'ridgeL') : 0;
    const R = randRange(12, 15.5, s, 'R');
    const plainDepth = randRange(4.5, 6.5, s, 'plain');
    // One side is sheer: the mountain falls there in a few tall faces.
    const sheer = lowDir + Math.PI + randRange(-0.9, 0.9, s, 'sheer');
    const sheerK = randRange(0.8, 1.6, s, 'sheerK');
    // Tiers: the levels the mountain's shelves stand at, two or three apart, so its faces are tall.
    const tiers = [1, 2];
    for (let t = 2, k = 0; t < peakH; k++) {
      t = Math.min(peakH, t + randInt(2, 3, s, 'tier', k));
      if (peakH - t === 1) t = peakH;
      tiers.push(t);
    }
    for (let i = 0; i < N; i++) {
      if (!land[i]) continue;
      const x = xOf(i), z = zOf(i);
      // Distance to the ridge line (a point when there is no ridge).
      const px = x - ax, pz = z - az;
      const along = Math.max(-half, Math.min(half, px * Math.cos(ra) + pz * Math.sin(ra)));
      const qx = px - Math.cos(ra) * along, qz = pz - Math.sin(ra) * along;
      const steepen = 1 + sheerK * Math.max(0, Math.cos(Math.atan2(qz, qx) - sheer));
      const d = Math.hypot(qx, qz) * steepen * (1 + (fbm(s, 'medge', x, z, 4) - 0.5) * 0.45);
      let e = (peakH + 0.8) * Math.pow(clamp01(1 - d / R), 0.55) + (fbm(s, 'crag', x, z, 3) - 0.5) * 1.2;
      // Snap to the nearest tier, with a wandering threshold so the shelves are not rings.
      if (e > 2.5) {
        const j = e + (fbm(s, 'tierEdge', x, z, 4) - 0.5) * 1.4;
        let lv = 2;
        for (const t of tiers) if (Math.abs(t - j) < Math.abs(lv - j)) lv = t;
        e = lv;
      }
      e = Math.max(1, e);
      // The plain: low ground on the low side, with a rise or two of height 2.
      const p = (x - mx) * ux + (z - mz) * uz + (fbm(s, 'plainEdge', x, z, 5) - 0.5) * 3;
      if (p > pMax - plainDepth) e = Math.min(e, cd[i]! >= 3 && fbm(s, 'pterr', x, z, 6) > 0.6 ? 2 : 1);
      // The shore: beaches here and there, else the mountain drops into the sea.
      const seaCliff = fbm(s, 'seacliff', x, z, 7) > 0.45;
      E[i] = Math.min(e, seaCliff ? cd[i]! * 3 + 1 : cd[i]! + 1);
    }
  } else {
    // Archipelago or lagoon: low islands, each big one with a knoll.
    const comps = components((i) => land[i]! > 0);
    const hills: Hill[] = [];
    for (let c = 0; c < comps.sizes.length; c++) {
      if (comps.sizes[c]! < 70) continue;
      let best = -1;
      for (let i = 0; i < N; i++) if (comps.label[i] === c && (best < 0 || cd[i]! > cd[best]! || (cd[i] === cd[best] && rand(s, 'knoll', i) > 0.7))) best = i;
      hills.push({ x: xOf(best), z: zOf(best), peak: randInt(3, comps.sizes[c]! > 200 ? 5 : 4, s, 'kpeak', c), r: randRange(3.5, 6, s, 'kr', c), steepDir: randRange(0, Math.PI * 2, s, 'ksd', c), steep: randRange(0.5, 2, s, 'kst', c) });
    }
    for (let i = 0; i < N; i++) {
      if (!land[i]) continue;
      const x = xOf(i), z = zOf(i);
      let e = cd[i]! >= 3 && fbm(s, 'terr', x, z, 8) > 0.55 ? 2 : 1;
      for (const hl of hills) e = Math.max(e, hillAt(hl, x, z));
      E[i] = Math.min(e, cd[i]! + 1);
    }
    peakH = 5;
  }
  for (let i = 0; i < N; i++) if (land[i]) h[i] = Math.max(1, Math.min(peakH, MAX_HEIGHT_2, Math.round(E[i]!)));
  // Smooth single-column spikes and pits.
  for (let i = 0; i < N; i++) {
    if (!h[i]) continue;
    const x = xOf(i), z = zOf(i);
    let lo = 99, hi = 0;
    for (const [dx, dz] of D4) {
      const v = hAt(h, x + dx, z + dz);
      if (v === 0) {
        lo = 0;
        continue;
      }
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    if (lo > 0 && h[i]! > hi) h[i] = hi;
    else if (lo > 0 && h[i]! < lo) h[i] = lo;
  }
  // No lone pillars: a column standing 2 or more above three of its sides comes down to the highest of them.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < N; i++) {
      if (!h[i]) continue;
      const x = xOf(i), z = zOf(i);
      const ns = D4.map(([dx, dz]) => hAt(h, x + dx, z + dz));
      const below = ns.filter((v) => h[i]! - v >= 2);
      if (below.length >= 3) h[i] = Math.max(1, ...below);
    }
  }
  if (ch !== 'steep') lowDir = Math.atan2(mz - cz0, mx - cx0);
  let top = 0;
  for (let i = 0; i < N; i++) top = Math.max(top, h[i]!);
  return { h, peak: top, lowDir };
}

// ────────────────────────────────────────────────────────────── rivers ──

interface Sample {
  x: number;
  z: number;
  /** Distance travelled from the mouth. */
  t: number;
  heading: number;
}

/** The last land column (and the first sea point beyond it) walking from the island's middle out along an angle. */
function coastAlong(h: Uint8Array, mx: number, mz: number, a: number): { landX: number; landZ: number; seaX: number; seaZ: number } | null {
  let lastLand: [number, number] | null = null;
  for (let r = 0; r < 40; r += 0.25) {
    const x = mx + Math.cos(a) * r, z = mz + Math.sin(a) * r;
    const ix = Math.round(x), iz = Math.round(z);
    if (hAt(h, ix, iz) > 0) lastLand = [x, z];
    else if (lastLand && r > 2) {
      // Past the coast once 2 columns of water follow.
      const x2 = mx + Math.cos(a) * (r + 1.5), z2 = mz + Math.sin(a) * (r + 1.5);
      if (hAt(h, Math.round(x2), Math.round(z2)) === 0) return { landX: lastLand[0], landZ: lastLand[1], seaX: x + Math.cos(a) * 0.8, seaZ: z + Math.sin(a) * 0.8 };
    }
  }
  return null;
}

/** Walks from (x, z) toward the target, swinging either side of the line. Null if it never arrives. */
function walk(s: number, tag: string, x: number, z: number, tx: number, tz: number, through: boolean, h: Uint8Array): Sample[] | null {
  const step = 0.3;
  const wl = randRange(ISLAND2.meanderLength[0], ISLAND2.meanderLength[1], s, tag, 'wl');
  const phase = randRange(0, Math.PI * 2, s, tag, 'phase');
  const amp = ISLAND2.meander * randRange(0.75, 1.2, s, tag, 'amp');
  const out: Sample[] = [];
  let t = 0;
  let onLand = false;
  for (let k = 0; k < 500; k++) {
    const toT = Math.atan2(tz - z, tx - x);
    const dist = Math.hypot(tx - x, tz - z);
    // Swing less as the source nears, so the river does not circle it.
    const fade = through ? 1 : clamp01((dist - 1) / 4);
    const heading = toT + (amp * Math.sin(phase + (t * Math.PI * 2) / wl) + (valueNoise(s, tag + 'n', t, 0, 3) - 0.5) * 0.5) * fade;
    out.push({ x, z, t, heading });
    if (!through && dist < 0.6) return out;
    x += Math.cos(heading) * step;
    z += Math.sin(heading) * step;
    t += step;
    const land = hAt(h, Math.round(x), Math.round(z)) > 0;
    if (land) onLand = true;
    if (through && onLand && t > 8 && !land && hAt(h, Math.round(x + Math.cos(heading) * 1.5), Math.round(z + Math.sin(heading) * 1.5)) === 0) {
      out.push({ x, z, t, heading });
      return out;
    }
  }
  return null;
}

interface RiverResult {
  ok: boolean;
  through: boolean;
}

/**
 * Carves one river into h (marking `river`). `a` is the angle from the island's middle to the mouth.
 * `low` is the ground before any river, for telling valleys from gorges.
 */
function carveRiver(s: number, k: number, h: Uint8Array, low: Uint8Array, river: Uint8Array, mx: number, mz: number, a: number, through: boolean, gorgeAbove: number, keep: Uint8Array): RiverResult {
  const tag = `river${k}`;
  const mouth = coastAlong(h, mx, mz, a);
  if (!mouth) return { ok: false, through };
  let tx: number, tz: number;
  if (through) {
    const exit = coastAlong(h, mx, mz, a + Math.PI + randRange(-0.45, 0.45, s, tag, 'exit'));
    if (!exit) return { ok: false, through };
    tx = exit.seaX + (exit.seaX - mx) * 0.3;
    tz = exit.seaZ + (exit.seaZ - mz) * 0.3;
  } else {
    // A source inland: past the middle a little, or short of it.
    const f = randRange(-0.1, 0.45, s, tag, 'reach');
    tx = mx + (mx - mouth.landX) * f + randRange(-2, 2, s, tag, 'sx');
    tz = mz + (mz - mouth.landZ) * f + randRange(-2, 2, s, tag, 'sz');
  }
  const path = walk(s, tag, mouth.seaX, mouth.seaZ, tx, tz, through, h);
  if (!path || path.length < 10) return { ok: false, through };
  const total = path[path.length - 1]!.t;
  const wide = rand(s, tag, 'wide') < ISLAND2.wideShare;
  const pool = !through && rand(s, tag, 'pool') < ISLAND2.poolChance;
  // Wider downstream: a one-wide river is two wide at the bends (r > 0.71 takes both cells of a diagonal step).
  const mouthR = wide ? 1.4 : 1.15;
  const sourceR = wide ? 0.95 : 0.7;
  const mine = new Uint8Array(N);
  const radiusAt = (p: Sample): number => {
    const down = through ? Math.min(p.t, total - p.t) / (total / 2) : p.t / total;
    let r = mouthR + (sourceR - mouthR) * clamp01(down) + (valueNoise(s, tag + 'w', p.t, 0, 4) - 0.5) * 0.16;
    r += 0.62 * clamp01(1 - p.t / 3.5);
    if (through) r += 0.62 * clamp01(1 - (total - p.t) / 3.5);
    if (pool) r = Math.max(r, 1.55 * clamp01(1 - (total - p.t) / 1.6) + 0.3);
    return r;
  };
  for (const p of path) {
    const r = radiusAt(p);
    for (let z = Math.floor(p.z - r - 1); z <= Math.ceil(p.z + r + 1); z++) {
      for (let x = Math.floor(p.x - r - 1); x <= Math.ceil(p.x + r + 1); x++) {
        if (!inColumnBounds(x, z) || Math.hypot(x - p.x, z - p.z) > r) continue;
        mine[columnIndex(x, z)] = 1;
      }
    }
  }
  // A small island in the stream, on low ground in the middle stretch.
  const islandCells: number[] = [];
  if (rand(s, tag, 'islet') < ISLAND2.riverIslandChance) {
    const mid = path.filter((p) => p.t > total * 0.35 && p.t < total * 0.7 && low[columnIndex(Math.round(p.x), Math.round(p.z))]! > 0 && low[columnIndex(Math.round(p.x), Math.round(p.z))]! < gorgeAbove);
    if (mid.length) {
      const p = mid[Math.floor(rand(s, tag, 'isletAt') * mid.length)]!;
      const ux = Math.cos(p.heading), uz = Math.sin(p.heading);
      const seg = (x: number, z: number, half: number): number => {
        const along = Math.max(-half, Math.min(half, (x - p.x) * ux + (z - p.z) * uz));
        return Math.hypot(x - p.x - ux * along, z - p.z - uz * along);
      };
      for (let z = Math.floor(p.z - 4); z <= Math.ceil(p.z + 4); z++) {
        for (let x = Math.floor(p.x - 4); x <= Math.ceil(p.x + 4); x++) {
          if (!inColumnBounds(x, z)) continue;
          const d = seg(x, z, 1.1);
          if (d < 0.75) islandCells.push(columnIndex(x, z));
          else if (d < 2.05) mine[columnIndex(x, z)] = 1;
        }
      }
    }
  }
  // Rivers do not run into each other, except where both meet the sea.
  const ds = distanceFrom((i) => h[i] === 0 && !river[i]);
  let land = 0;
  for (let i = 0; i < N; i++) {
    if (!mine[i]) continue;
    if (river[i] && ds[i]! > 2) return { ok: false, through };
    if (h[i]! > 0) land++;
  }
  if (land < 8) return { ok: false, through };
  for (let i = 0; i < N; i++) {
    if (!mine[i]) continue;
    // Water of the sea stays sea; the river is the land it cut.
    if (h[i]! > 0) river[i] = 1;
    h[i] = 0;
  }
  for (const i of islandCells) {
    h[i] = 1;
    river[i] = 0;
    keep[i] = 1;
  }
  return { ok: true, through };
}

/** Cuts low ground beside the rivers into a valley; high ground stays, so the river runs in a gorge there. */
function valleys(s: number, h: Uint8Array, low: Uint8Array, river: Uint8Array, gorgeAbove: number, keep: Uint8Array): void {
  const dr = distanceFrom((i) => river[i] === 1);
  for (let i = 0; i < N; i++) {
    if (!h[i] || keep[i] || dr[i]! < 1) continue;
    if (low[i]! < gorgeAbove) {
      const cap = 1 + Math.floor((dr[i]! - 1) * 0.75);
      h[i] = Math.max(1, Math.min(h[i]!, cap));
      continue;
    }
    // A gorge: mostly a narrow shelf a little above the water and tall walls behind it, so the river
    // shows from above; here and there the wall drops sheer into the water.
    if (fbm(s, 'sheerWall', xOf(i), zOf(i), 5) > 0.62) continue;
    const cap = 2 + (dr[i]! - 1) * 3;
    h[i] = Math.max(1, Math.min(h[i]!, cap));
  }
}

// ──────────────────────────────────────────────────────────── materials ──

function materials(s: number, ch: IslandCharacter, h: Uint8Array, river: Uint8Array, peak: number): Uint8Array {
  const mat = new Uint8Array(N);
  const sea = (i: number): boolean => h[i] === 0 && !river[i];
  const ds = distanceFrom(sea);
  const nb = (x: number, z: number, f: (j: number) => boolean): boolean => {
    for (const [dx, dz] of D4) {
      const nx = x + dx, nz = z + dz;
      if (inColumnBounds(nx, nz) && f(columnIndex(nx, nz))) return true;
    }
    return false;
  };
  const rockTop = peak - ISLAND2.rockBelowPeak;
  for (let i = 0; i < N; i++) {
    const x = xOf(i), z = zOf(i);
    const here = h[i]!;
    if (here === 0) {
      mat[i] = MAT.water;
      continue;
    }
    mat[i] = MAT.grass;
    if (here === 1) {
      // Sand on the sea shore and round river mouths; a sand bar here and there on a river bend.
      if (nb(x, z, sea)) mat[i] = MAT.sand;
      else if (nb(x, z, (j) => river[j] === 1) && (ds[i]! <= 3 || fbm(s, 'bar', x, z, 4) > 0.72)) mat[i] = MAT.sand;
      continue;
    }
    if (here < 3) continue;
    let drop = 0;
    let gorge = false;
    for (const [dx, dz] of D4) {
      const v = hAt(h, x + dx, z + dz);
      drop = Math.max(drop, here - v);
      if (v === 0 && inColumnBounds(x + dx, z + dz) && river[columnIndex(x + dx, z + dz)]) gorge = true;
    }
    const n = fbm(s, 'rock', x, z, 4);
    // Summits of a steep island; the very tops of hills.
    if (ch === 'steep' && here >= rockTop + (n - 0.5) * 2.4) mat[i] = MAT.rock;
    else if (ch !== 'steep' && here >= 5 && here === peak && n > 0.42) mat[i] = MAT.rock;
    // Rims of tall cliffs and gorge walls.
    if (drop >= ISLAND2.rockRimDrop + (ch === 'steep' ? 0 : 1) && n > 0.28) mat[i] = MAT.rock;
    if (gorge && here >= 3) mat[i] = MAT.rock;
  }
  // Soften: a lone grass column in rock goes to rock, a lone rock column in grass back to grass.
  const next = mat.slice();
  for (let i = 0; i < N; i++) {
    if (h[i]! < 3) continue;
    const x = xOf(i), z = zOf(i);
    let rocky = 0, sides = 0;
    for (const [dx, dz] of D4) {
      const nx = x + dx, nz = z + dz;
      if (!inColumnBounds(nx, nz) || h[columnIndex(nx, nz)]! === 0) continue;
      sides++;
      if (mat[columnIndex(nx, nz)] === MAT.rock) rocky++;
    }
    if (mat[i] === MAT.grass && sides >= 3 && rocky >= sides - 0) next[i] = MAT.rock;
    else if (mat[i] === MAT.rock && rocky === 0 && sides === 4) next[i] = MAT.grass;
  }
  return next;
}

// ──────────────────────────────────────────────────────────── the roll ──

function rollIsland(s: number, ch: IslandCharacter, wantRivers: number, throughWanted: boolean): Island2 | null {
  const plan = planLand(s, ch);
  let scale = 1;
  let land = rasterLand(s, plan, scale);
  const target = (plan.share[0] + plan.share[1]) / 2;
  for (let k = 0; k < 4; k++) {
    const sh = share(land);
    if (sh >= plan.share[0] && sh <= plan.share[1]) break;
    scale *= Math.sqrt(target / Math.max(sh, 0.01));
    land = rasterLand(s, plan, scale);
  }
  tidy(land, ch === 'archipelago' ? 30 : 12);
  const sc = sculpt2(s, ch, land);
  const h = sc.h;
  const low = h.slice();
  const river = new Uint8Array(N);
  const keep = new Uint8Array(N);
  const gorgeAbove = ch === 'gentle' ? 99 : ch === 'steep' ? Math.min(ISLAND2.gorgeAbove, 3) : ISLAND2.gorgeAbove;
  // The island's middle: the centroid of its land.
  let mx = 0, mz = 0, n = 0;
  for (let i = 0; i < N; i++) {
    if (!h[i]) continue;
    mx += xOf(i);
    mz += zOf(i);
    n++;
  }
  mx /= Math.max(1, n);
  mz /= Math.max(1, n);
  let rivers = 0, through = 0;
  // Mouths face the low side where there is one (a steep island's plain), spread round otherwise.
  const a0 = sc.lowDir + randRange(-0.9, 0.9, s, 'mouth');
  for (let k = 0; k < wantRivers; k++) {
    const a = k === 0 ? a0 : a0 + randRange(Math.PI * 0.55, Math.PI * 1.45, s, 'mouth2');
    const r = carveRiver(s, k, h, low, river, mx, mz, a, throughWanted && k === 0, gorgeAbove, keep);
    if (!r.ok) return null;
    rivers++;
    if (r.through) through++;
  }
  if (rivers) valleys(s, h, low, river, gorgeAbove, keep);
  unpinch(h, river);
  tidy(h, 3, keep);
  // A river that split the land must leave pieces worth building on.
  const comps = components((i) => h[i]! > 0);
  for (let c = 0; c < comps.sizes.length; c++) {
    const size = comps.sizes[c]!;
    if (size >= 30) continue;
    let kept = false;
    for (let i = 0; i < N && !kept; i++) if (comps.label[i] === c && keep[i]) kept = true;
    if (!kept) return null;
  }
  for (let i = 0; i < N; i++) if (h[i]! > 0) river[i] = 0;
  let top = 0;
  for (let i = 0; i < N; i++) top = Math.max(top, h[i]!);
  const material = materials(s, ch, h, river, top);
  const terrain: Terrain = { seed: s, height: h, material };
  return { terrain, character: ch, rivers, through, river, attempts: 1, fellBack: false };
}

/** The character and river count a seed rolls (before any re-roll). */
export function rollCharacter(seed: number): { character: IslandCharacter; rivers: number; through: boolean } {
  const character = pick(CHARACTERS, ISLAND2.characters, seed, 'character');
  const rivers = pick([0, 1, 2], ISLAND2.rivers, seed, 'rivers');
  return { character, rivers, through: rivers > 0 && rand(seed, 'through') < ISLAND2.throughShare };
}

/** Generator 2's island for a seed, with what it rolled. Pure and deterministic. */
export function generateIsland2(seed: number, fallback: (seed: number) => Terrain): Island2 {
  const want = rollCharacter(seed);
  // Easing: the rivers asked for, then one through-river fewer, then fewer rivers, then a gentle island.
  const tries: [IslandCharacter, number, boolean][] = [[want.character, want.rivers, want.through]];
  if (want.through) tries.push([want.character, want.rivers, false]);
  for (let r = want.rivers - 1; r >= 0; r--) tries.push([want.character, r, false]);
  if (want.character !== 'gentle') tries.push(['gentle', 0, false]);
  let attempts = 0;
  for (let stage = 0; stage < tries.length; stage++) {
    const [ch, rivers, through] = tries[stage]!;
    const budget = stage === 0 ? ISLAND2.attempts : Math.ceil(ISLAND2.attempts / 3);
    for (let a = 0; a < budget; a++) {
      attempts++;
      const s = stage === 0 && a === 0 ? seed : hash(seed, 'reroll2', stage, a) | 0;
      const isl = rollIsland(s, ch, rivers, through);
      if (!isl) continue;
      if (checkTerrain2(isl.terrain).problems.length) continue;
      return { ...isl, terrain: { ...isl.terrain, seed }, attempts };
    }
  }
  // Nothing passed: generator 1's island, which always has a beach, a cove and flat ground.
  const t = fallback(seed);
  return { terrain: t, character: 'gentle', rivers: 0, through: 0, river: new Uint8Array(N), attempts, fellBack: true };
}
