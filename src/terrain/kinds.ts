// Choosing what kind of island a new island is (design section 7, "New
// island"). Generator 2 rolls an island's character from its seed, and the
// world saves only the seed and the generator, so a kind is chosen by
// FINDING A SEED whose island is that kind: draw seeds, generate each island,
// keep the first whose real result (after any re-roll) matches. Nothing
// generated changes, and every saved town and link keeps its island.
//
// The kinds, in terms of what generateIsland2 returns:
//   plains    a gentle island with no river: one landmass, low (up to 4), wide flat ground;
//   hills     a hilly island reaching 5, no river right across;
//   mountain  a steep island (a peak or ridge of 7 to 10, rock);
//   valley    a gentle or hilly island with a river running coast to coast;
//   islands   an archipelago (two to five landmasses, or a ring round a lagoon).
// Over 500 random seeds they occur about 9 %, 18 %, 16 %, 26 % and 9 % of
// the time (the rest, gentle islands with a river that ends inland and
// low hilly ones, are only ever a surprise).
//
// The search reads the seed's first roll (rollCharacter, nearly free)
// before generating anything, and only generates seeds that set out to be
// the kind; the generated island is then checked. A search is a generator
// that yields after each island it generates, so the menu can spread it
// over frames (src/ui/menu.ts).

import { hash } from '@/core/rand';
import { generateTerrain } from './terrain';
import { generateIsland2, rollCharacter, type Island2, type IslandCharacter } from './terrain2';

export type IslandKind = 'plains' | 'hills' | 'mountain' | 'valley' | 'islands';
export const ISLAND_KINDS: readonly IslandKind[] = ['plains', 'hills', 'mountain', 'valley', 'islands'];
export const ISLAND_KIND_NAMES: Record<IslandKind, string> = {
  plains: 'Plains',
  hills: 'Hills',
  mountain: 'Mountain',
  valley: 'River valley',
  islands: 'Islands',
};

/** The highest ground of an island. */
export function highest(isl: Island2): number {
  let top = 0;
  for (let i = 0; i < isl.terrain.height.length; i++) top = Math.max(top, isl.terrain.height[i]!);
  return top;
}

/** The kind a generated island is, or null for one that is none of them. */
export function islandKindOf(isl: Island2): IslandKind | null {
  if (isl.fellBack) return null;
  // A steep island now and then tops out at 5 or 6, no higher than the hills: not a mountain.
  if (isl.character === 'steep') return highest(isl) >= 7 ? 'mountain' : null;
  if (isl.character === 'archipelago') return 'islands';
  if (isl.through > 0) return 'valley';
  if (isl.character === 'gentle') return isl.rivers === 0 ? 'plains' : null;
  return highest(isl) >= 5 ? 'hills' : null;
}

/** First rolls worth generating for a kind (the roll may still be eased; the island is checked). */
const LIKELY: Record<IslandKind, (r: { character: IslandCharacter; rivers: number; through: boolean }) => boolean> = {
  plains: (r) => r.character === 'gentle' && r.rivers === 0,
  hills: (r) => r.character === 'hilly' && !r.through,
  mountain: (r) => r.character === 'steep',
  valley: (r) => (r.character === 'gentle' || r.character === 'hilly') && r.through,
  islands: (r) => r.character === 'archipelago',
};

/** How many seeds a search may draw (cheap) and generate (a few ms each) before it settles for the closest. */
export const SEARCH_BUDGET = { draws: 4000, islands: 40 };

export interface Found {
  seed: number;
  island: Island2;
  /** False when nothing in the budget matched and this is the closest there was. */
  exact: boolean;
  /** Islands generated. */
  generated: number;
}

/** Generator 2's island for a seed, exactly as a new island gets it. */
export function island2(seed: number): Island2 {
  return generateIsland2(seed, (s) => generateTerrain(s, 1));
}

/** Seed number n of a search that starts at `start` (any number: the clock and Math.random in the game). */
export function candidate(start: number, salt: string, n: number): number {
  return hash(start, 'kind-search', salt, n) | 0;
}

/**
 * A search for a seed by what its island must be. `likely` filters first
 * rolls before generating; `score` rates a generated island, 1 being a match.
 * Yields after each island it generates; returns the first match, or the
 * best scored island when the budget runs out.
 */
export function* searchSeeds(
  start: number,
  salt: string,
  likely: (r: ReturnType<typeof rollCharacter>) => boolean,
  score: (isl: Island2, seed: number) => number,
  budget = SEARCH_BUDGET,
): Generator<void, Found> {
  let best: Found | null = null;
  let bestScore = -Infinity;
  let generated = 0;
  for (let n = 0; n < budget.draws && generated < budget.islands; n++) {
    const seed = candidate(start, salt, n);
    if (!likely(rollCharacter(seed))) continue;
    const island = island2(seed);
    generated++;
    const s = score(island, seed);
    if (s >= 1) return { seed, island, exact: true, generated };
    if (s > bestScore) {
      bestScore = s;
      best = { seed, island, exact: false, generated };
    }
    yield;
  }
  if (best) return { ...best, generated };
  // Nothing likely in all the draws (no kind is that rare): the first seed drawn.
  const seed = candidate(start, salt, 0);
  return { seed, island: island2(seed), exact: false, generated: generated + 1 };
}

/** How near an island is to a kind: 1 is the kind; less is the same character, then anything. */
function kindScore(kind: IslandKind, isl: Island2): number {
  if (islandKindOf(isl) === kind) return 1;
  const want: Record<IslandKind, IslandCharacter> = { plains: 'gentle', hills: 'hilly', mountain: 'steep', valley: 'gentle', islands: 'archipelago' };
  return isl.character === want[kind] ? 0.5 : 0;
}

/** A search for an island of a kind. If none turns up in the budget (not seen in 10,000 tries) the closest is taken. */
export function findIsland(kind: IslandKind, start: number, budget = SEARCH_BUDGET): Generator<void, Found> {
  return searchSeeds(start, kind, LIKELY[kind], (isl) => kindScore(kind, isl), budget);
}

/** Runs a search to the end at once (tests, tools). */
export function runSearch<T>(search: Generator<void, T>): T {
  for (;;) {
    const r = search.next();
    if (r.done) return r.value;
  }
}
