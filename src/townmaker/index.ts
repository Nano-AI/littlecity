// Grow a town (design section 15a): growTown(terrain, seed) returns an
// ordered list of ordinary edits that fills the island with a complete town
// showing off every building combination the rules know.
//
// How it plans:
//   1. read the island (site.ts): water distance, exposure, the hill, flat ground;
//   2. lay districts as stamps, each searching the whole island for the
//      place that suits it (the square on the flattest ground near the
//      middle, the castle on the highest flat ground, the harbour where the
//      shore is straight, the lighthouse on the most exposed point, …);
//      every stamp checks its footprint and skips what does not fit;
//   3. join every district's ways in to the streets already joined to the
//      square, nearest district first (route.ts);
//   4. fill the free ground along the streets with cottages, densely near
//      the square and thinning outward, then plant trees;
//   5. order the edits for watching: district by district outward from the
//      square, each district's ground first, then its buildings bottom-up.
//
// Pure and seeded: it uses only rand(seed, …), and every edit passed
// canApply against the town as grown so far, so the result is exactly a
// town a player could have built (on an empty island of this terrain).

import { columnIndex, key, type CellKey } from '@/core/grid';
import type { Edit, Terrain } from '@/core/world';
import { buildCastle } from './districts/castle';
import { buildFlowerBed, buildGreenhouse, buildManor, buildMill, buildPaddock, buildStairs, buildTrees, buildWalledGarden, buildWillow } from './districts/country';
import { buildFarmstead, reserveFarmstead } from './districts/farmstead';
import { buildHarbour } from './districts/harbour';
import { buildCourtyard, buildHousing } from './districts/housing';
import { buildInfill } from './districts/infill';
import { buildAcropolis, buildChapel, buildCliffHouse, buildFolly, buildHilltop, buildLighthouse, buildWatchtower } from './districts/monuments';
import { buildSquare } from './districts/square';
import { buildBoardwalk, buildBridge, buildJetty, buildViaduct } from './districts/water';
import { Grower, type Made } from './grower';
import { joinedStreets, route } from './route';
import { readSite } from './site';
import { fromSquare, type District, type Town } from './town';

export interface GrownTown {
  edits: Edit[];
  /** Each district, with a column near its middle and how many edits it made. */
  districts: readonly { name: string; x: number; z: number; edits: number }[];
  /** Edits the generator tried that were not legal (it adapted round them). */
  refused: number;
  /** Districts that could not be joined to the square by a street. */
  unjoined: string[];
  /** True if the watching order had to fall back to the order the town was made in. */
  fellBack: boolean;
  /** The middle of the market square (its plaza), if one was laid. */
  square: { x: number; z: number; h: number } | null;
  /** What each column was claimed for (CLAIM bits), for tools and tests. */
  claims: Uint8Array;
}

export function growTown(terrain: Terrain, seed: number): Edit[] {
  return planTown(terrain, seed).edits;
}

export function planTown(terrain: Terrain, seed: number): GrownTown {
  const g = new Grower(terrain, seed);
  // One town in five has no fountain anywhere, so the hand pump (D33, which needs a town without one) shows too.
  const town: Town = { g, site: readSite(terrain), square: null, districts: [], pumps: ((seed % 5) + 5) % 5 === 3 };

  buildSquare(town);
  buildWillow(town);
  buildHilltop(town);
  buildCliffHouse(town);
  buildCastle(town);
  buildAcropolis(town);
  buildFolly(town);
  buildHarbour(town);
  buildLighthouse(town);
  buildHousing(town, 0, 9);
  buildCourtyard(town, 0, 8);
  reserveFarmstead(town);
  buildManor(town);
  buildHousing(town, 1, 11);
  buildChapel(town);
  buildMill(town);
  buildGreenhouse(town);
  buildWalledGarden(town);
  buildBoardwalk(town);
  buildBridge(town);
  buildJetty(town);
  buildWatchtower(town);
  buildPaddock(town);
  buildStairs(town);
  buildViaduct(town);
  for (let n = 2; n < 6; n++) buildHousing(town, n, 8 + n * 2);
  const unjoined = joinStreets(town);
  buildFlowerBed(town, 0);
  buildFlowerBed(town, 1);
  for (let ring = 0; ring < 4; ring++) buildInfill(town, ring);
  buildTrees(town);
  buildFarmstead(town);

  const { edits, fellBack } = watchingOrder(town);
  const counts = new Map<number, number>();
  for (const m of g.made) counts.set(m.district, (counts.get(m.district) ?? 0) + 1);
  return {
    edits,
    districts: town.districts.map((d) => ({ name: d.name, x: d.x, z: d.z, edits: counts.get(d.id) ?? 0 })),
    refused: g.refused,
    unjoined,
    fellBack,
    square: town.square,
    claims: g.claim,
  };
}

/**
 * Streets from every district's ways to the streets joined to the square,
 * nearest district first. "Joined" is worked out by walking the laid
 * streets (route.ts, joinedStreets), so a district whose two streets meet
 * nothing else is joined at both ends. Returns the districts left unjoined.
 */
function joinStreets(town: Town): string[] {
  const { g } = town;
  const sq = town.districts.find((d) => d.name === 'square') ?? town.districts[0];
  if (!sq) return [];
  const roots = (): CellKey[] => {
    const out: CellKey[] = [];
    for (let i = 0; i < g.streetOf.length; i++) {
      if (g.streetOf[i] !== sq.id) continue;
      const x = i % 48, z = Math.floor(i / 48);
      out.push(key(x, g.h(x, z), z));
    }
    return out;
  };
  let net = joinedStreets(g, roots());
  const reached = (x: number, z: number): boolean => net.has(key(x, g.h(x, z), z));
  const done = (d: District): boolean => (d.anyWay ? d.ways.some(([x, z]) => reached(x, z)) : d.ways.every(([x, z]) => reached(x, z)));
  const todo = town.districts
    .filter((d) => d !== sq && d.ways.length > 0)
    .sort((a, b) => fromSquare(town, a.x, a.z) - fromSquare(town, b.x, b.z));
  for (let pass = 0; pass < 3; pass++) {
    for (const d of todo) {
      if (done(d)) continue;
      g.district = d.id;
      const allow = new Set(d.ways.map(([x, z]) => columnIndex(x, z)));
      for (const way of d.ways) {
        if (reached(way[0], way[1])) continue;
        if (route(g, way, { reached, allow, relaxed: pass === 2 }) === null) continue;
        net = joinedStreets(g, roots());
        if (d.anyWay) break;
      }
    }
  }
  return todo.filter((d) => !done(d)).map((d) => d.name);
}

/**
 * District by district outward from the square (trees last); in each, the
 * floors on the ground first, then everything else from the bottom up.
 * The order is checked by replaying it; if it were ever illegal or built a
 * different town, the order the town was made in is used instead.
 */
function watchingOrder(town: Town): { edits: Edit[]; fellBack: boolean } {
  const { g } = town;
  const rank = new Map<number, number>();
  const byDistance = (d: District): number => {
    if (d.name === 'square') return -1;
    if (d.name === 'trees') return 1000;
    const ring = /^infill(\d)$/.exec(d.name);
    if (ring) return Number(ring[1]) * 7 + 4.5;
    return fromSquare(town, d.x, d.z);
  };
  [...town.districts].sort((a, b) => byDistance(a) - byDistance(b) || a.id - b.id).forEach((d, i) => rank.set(d.id, i));
  const indexed = g.made.map((m, i) => ({ m, i }));
  const key = (x: { m: Made; i: number }): number[] => [rank.get(x.m.district) ?? 0, x.m.ground ? 0 : 1, x.m.ground ? 0 : x.m.y, x.i];
  indexed.sort((a, b) => {
    const ka = key(a), kb = key(b);
    for (let j = 0; j < ka.length; j++) if (ka[j] !== kb[j]) return ka[j]! - kb[j]!;
    return 0;
  });
  const ordered = indexed.map((x) => x.m.edit);
  if (sameTown(g, ordered)) return { edits: ordered, fellBack: false };
  return { edits: g.made.map((m) => m.edit), fellBack: true };
}

/** Replays edits on an empty island: all legal, and the same blocks, floors and edges as the grower holds. */
function sameTown(g: Grower, edits: readonly Edit[]): boolean {
  const replay = new Grower(g.terrain, g.seed);
  for (const e of edits) if (!replay.edit(e)) return false;
  const a = g.world, b = replay.world;
  if (a.blocks.size !== b.blocks.size || a.floors.size !== b.floors.size || a.edges.size !== b.edges.size) return false;
  for (const [k, blk] of a.blocks) {
    const o = b.blocks.get(k);
    if (!o || o.kind !== blk.kind || o.color !== blk.color || o.rot !== blk.rot) return false;
  }
  for (const [k, f] of a.floors) if (b.floors.get(k) !== f) return false;
  for (const [k, e] of a.edges) if (b.edges.get(k) !== e) return false;
  return true;
}
