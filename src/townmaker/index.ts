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
import { rollCharacter, type Character } from './character';
import { buildCastle } from './districts/castle';
import { buildForum } from './districts/forum';
import { buildBarn, buildFields, buildOrchard, buildPark, buildSchool, buildSmithy, buildVillageGreen } from './districts/village';
import { buildFlowerBed, buildGreenhouse, buildManor, buildMill, buildPaddock, buildStairs, buildTrees, buildWalledGarden, buildWillow } from './districts/country';
import { buildFarmstead, reserveFarmstead } from './districts/farmstead';
import { buildHarbour } from './districts/harbour';
import { buildRiverside } from './districts/riverside';
import { buildCourtyard, buildHousing } from './districts/housing';
import { buildInfill } from './districts/infill';
import { buildAcropolis, buildChapel, buildCliffHouse, buildFolly, buildHilltop, buildLighthouse, buildWatchtower } from './districts/monuments';
import { buildSmallSquare, buildSquare } from './districts/square';
import { buildBoardwalk, buildBridge, buildInhabitedBridge, buildJetty, buildViaduct } from './districts/water';
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
  /** The town's character, and the one that flavours it (character.ts, README.md). */
  character: Character;
  secondary: Character;
}

export interface GrowOptions {
  /** A character not to roll (the last one the dice showed), when the island allows another. */
  avoid?: Character;
  /** Grow this character whatever the island leans to (scenarios, tools). */
  character?: Character;
}

export function growTown(terrain: Terrain, seed: number, opts: GrowOptions = {}): Edit[] {
  return planTown(terrain, seed, opts).edits;
}

type Step = (town: Town) => unknown;

/** Every district the planner can ask for, by name. `name:n` asks again (a second barn, a second row). */
const STEPS: Record<string, Step> = {
  square: (t) => buildSquare(t) || buildSmallSquare(t),
  forum: (t) => buildForum(t) || buildSquare(t) || buildSmallSquare(t),
  willow: buildWillow,
  hilltop: buildHilltop,
  cliff: buildCliffHouse,
  castle: buildCastle,
  acropolis: buildAcropolis,
  folly: buildFolly,
  manor: buildManor,
  harbour: (t) => buildHarbour(t, false),
  greatHarbour: (t) => buildHarbour(t, true),
  lighthouse: buildLighthouse,
  riverside: buildRiverside,
  courtyard: (t) => buildCourtyard(t, 0, 8),
  chapel: buildChapel,
  mill: buildMill,
  greenhouse: buildGreenhouse,
  walledGarden: buildWalledGarden,
  boardwalk: buildBoardwalk,
  bridge: buildBridge,
  jetty: buildJetty,
  watchtower: buildWatchtower,
  paddock: buildPaddock,
  stairs: buildStairs,
  viaduct: buildViaduct,
  green: (t) => buildVillageGreen(t),
  barn: (t) => buildBarn(t, t.districts.length),
  orchard: (t) => buildOrchard(t, t.districts.length),
  smithy: (t) => buildSmithy(t),
  school: (t) => buildSchool(t),
  fields: (t) => buildFields(t),
  park: (t) => buildPark(t),
  inhabitedBridge: buildInhabitedBridge,
  farmstead: reserveFarmstead,
};

/**
 * The plans, in priority order: the first districts get the best ground,
 * the rest fit where they can or are left out. `housing:n:d` is a housing
 * block about d steps from the square. See README.md for what each town is.
 */
const PLANS: Record<Character, readonly string[]> = {
  harbour: ['square', 'greatHarbour', 'lighthouse', 'willow', 'housing:0:8', 'courtyard', 'chapel', 'smithy', 'boardwalk', 'bridge', 'jetty', 'riverside', 'housing:1:11', 'walledGarden', 'stairs', 'viaduct'],
  marble: ['forum', 'willow', 'acropolis', 'folly', 'housing:0:9', 'courtyard', 'viaduct', 'chapel', 'walledGarden', 'harbour', 'lighthouse', 'manor', 'courtyard:1', 'housing:1:12', 'bridge', 'boardwalk', 'stairs'],
  castle: ['square', 'castle', 'smithy', 'chapel', 'hilltop', 'housing:0:8', 'housing:1:11', 'walledGarden', 'watchtower', 'cliff', 'harbour', 'lighthouse', 'willow', 'stairs', 'bridge', 'courtyard'],
  market: ['square', 'housing:0:8', 'housing:1:10', 'courtyard', 'school', 'chapel', 'smithy', 'courtyard:1', 'inhabitedBridge', 'harbour', 'lighthouse', 'housing:2:13', 'greenhouse', 'willow', 'bridge', 'stairs'],
  river: ['square', 'riverside', 'inhabitedBridge', 'mill', 'willow', 'housing:0:9', 'chapel', 'harbour', 'lighthouse', 'park', 'greenhouse', 'boardwalk', 'bridge', 'courtyard', 'housing:1:12', 'walledGarden'],
  farming: ['square', 'green', 'chapel', 'farmstead', 'barn', 'orchard', 'mill', 'paddock', 'barn:1', 'orchard:1', 'smithy', 'greenhouse', 'manor', 'willow', 'harbour', 'lighthouse', 'paddock:1'],
  hill: ['square', 'hilltop', 'castle', 'cliff', 'cliff:1', 'chapel', 'acropolis', 'folly', 'viaduct', 'stairs', 'housing:0:9', 'harbour', 'lighthouse', 'willow', 'watchtower', 'bridge'],
  gardens: ['square', 'park', 'fields', 'school', 'manor', 'greenhouse', 'walledGarden', 'housing:0:9', 'chapel', 'harbour', 'lighthouse', 'willow', 'courtyard', 'boardwalk', 'bridge', 'paddock'],
};

/** What a secondary character adds: its showpieces, after the primary's first few districts. */
const FLAVOUR: Record<Character, readonly string[]> = {
  harbour: ['greatHarbour'],
  marble: ['acropolis', 'folly'],
  castle: ['castle', 'smithy'],
  market: ['school', 'courtyard:1'],
  river: ['riverside', 'inhabitedBridge'],
  farming: ['barn', 'orchard'],
  hill: ['hilltop', 'cliff'],
  gardens: ['park', 'fields'],
};

/** How thickly cottages fill the streets, by character. */
const INFILL: Record<Character, number> = { harbour: 1, marble: 1, castle: 1, market: 1.1, river: 1, farming: 0.45, hill: 0.9, gardens: 0.7 };

/** The plan for a primary and a secondary character. */
export function planFor(primary: Character, secondary: Character): string[] {
  const plan = [...PLANS[primary]];
  const family = (k: string): string => (k === 'greatHarbour' ? 'harbour' : k.split(':')[0]!);
  const extra = FLAVOUR[secondary].filter((k) => !plan.some((p) => p === k || (family(p) === family(k) && family(k) !== 'housing' && !k.includes(':'))));
  plan.splice(3, 0, ...extra);
  // A great harbour replaces the plain one.
  if (plan.includes('greatHarbour')) return plan.filter((k) => k !== 'harbour');
  return plan;
}

export function planTown(terrain: Terrain, seed: number, opts: GrowOptions = {}): GrownTown {
  const g = new Grower(terrain, seed);
  const site = readSite(terrain);
  const { primary, secondary } = rollCharacter(site, seed, opts.avoid, opts.character);
  // One town in five has no fountain anywhere, so the hand pump (D33, which needs a town without one) shows too.
  const town: Town = { g, site, square: null, districts: [], pumps: ((seed % 5) + 5) % 5 === 3 && primary !== 'marble', marketCross: primary === 'market' || secondary === 'market' };

  const plan = planFor(primary, secondary);
  for (const step of plan) {
    const [name, a, b] = step.split(':');
    if (name === 'housing') buildHousing(town, Number(a), Number(b));
    else STEPS[name!]?.(town);
  }
  for (let n = 2; n < 6; n++) if (primary !== 'farming') buildHousing(town, n, 8 + n * 2);
  const unjoined = joinStreets(town);
  buildFlowerBed(town, 0);
  buildFlowerBed(town, 1);
  for (let ring = 0; ring < 4; ring++) buildInfill(town, ring, INFILL[primary]);
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
    character: primary,
    secondary,
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
  // The square's streets, or (no square fitted) the first district that laid any.
  const sq = town.districts.find((d) => d.name === 'square') ?? town.districts.find((d) => g.streetOf.includes(d.id));
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
