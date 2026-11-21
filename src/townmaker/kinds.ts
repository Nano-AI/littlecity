// Choosing what kind of town grows (design section 15a, "Grow a town").
//
// On this island: a kind is offered when the island can carry it and the
// planner would really grow it. It cannot when its weight is zero (a river
// town with no river long enough to be its spine, characterWeights) or when
// the planner itself would turn it into another kind: a marble city with no
// site for its forum, a castle town with no site for its castle
// (planTown's own fall-backs). Those two are found out by asking the
// planner with every other kind already shown, so its answer is the
// planner's, not a copy of it.
//
// On a new island: a seed is searched for (src/terrain/kinds.ts) whose island
// gives the kind its best weight (a castle town and a hill town get a
// mountain, a river town a long river, a marble city a broad flat site …)
// and on which the planner grows it; the plan comes back with the seed, so
// growing it is instant.

import type { Terrain } from '@/core/world';
import { candidate, island2 } from '@/terrain/kinds';
import { rollCharacter, type Island2, type IslandCharacter } from '@/terrain/terrain2';
import { CHARACTERS, characterWeights, islandTraits, type Character } from './character';
import { planTown, type GrownTown } from './index';
import { readSite } from './site';

/** The kinds whose plan the planner may give up on, growing another kind instead. */
export const MAY_FALL_BACK: readonly Character[] = ['marble', 'castle'];

/** How each kind's weight stands on an island: zero means it cannot be grown there. */
export function kindWeights(terrain: Terrain): Record<Character, number> {
  return characterWeights(islandTraits(readSite(terrain)));
}

/**
 * The town of this kind the planner grows here (with the seed's second
 * kind flavouring it), or null if it cannot: no weight, or the planner
 * would fall back to another kind. Takes one plan (50 to 130 ms).
 */
export function planKind(terrain: Terrain, seed: number, kind: Character, weights = kindWeights(terrain)): GrownTown | null {
  if (!(weights[kind] > 0)) return null;
  if (MAY_FALL_BACK.includes(kind)) {
    // Every other kind counts as shown, so the dice roll this one, and the planner falls back if it must.
    const plan = planTown(terrain, seed, { avoid: CHARACTERS.filter((c) => c !== kind) });
    return plan.character === kind ? plan : null;
  }
  return planTown(terrain, seed, { character: kind });
}

/** The best weight each kind can have (characterWeights on an island that offers everything). */
const BEST = characterWeights({ flat: 48, maxH: 10, river: 2304, land: 2304, coast: 2304 });

/** An island gives a kind its best weight: the ground the kind likes most. */
export function suits(weights: Record<Character, number>, kind: Character): boolean {
  return weights[kind] >= BEST[kind];
}

/** First rolls worth generating for a kind's island (the island is checked after). */
const LIKELY: Record<Character, (r: { character: IslandCharacter; rivers: number }) => boolean> = {
  harbour: () => true,
  marble: (r) => r.character === 'gentle',
  castle: (r) => r.character === 'steep',
  market: () => true,
  river: (r) => r.rivers > 0,
  farming: (r) => r.character === 'gentle',
  hill: (r) => r.character === 'steep',
  gardens: () => true,
};

export interface FoundTown {
  seed: number;
  island: Island2;
  /** The town to grow there: the kind asked for. */
  plan: GrownTown;
  /** False when nothing in the budget suited the kind and this is an island that merely carries it. */
  exact: boolean;
  /** Islands generated and towns planned. */
  generated: number;
  plans: number;
}

/** Islands generated and towns planned before settling for an island that merely carries the kind. */
export const TOWN_BUDGET = { islands: 60, plans: 4 };

/**
 * A search for a new island that suits a kind of town, and the town on it.
 * Yields after each island generated and before each plan (the slow
 * steps). Past the budget, any island the kind weighs on at all and the
 * planner grows it on is taken; past that too (never seen), the kind is
 * planned outright on the last island.
 */
export function* findIslandForTown(kind: Character, start: number, budget = TOWN_BUDGET): Generator<void, FoundTown> {
  let generated = 0;
  let plans = 0;
  for (let n = 0; ; n++) {
    const relaxed = generated >= budget.islands || plans >= budget.plans;
    const seed = candidate(start, `town-${kind}`, n);
    if (!relaxed && !LIKELY[kind](rollCharacter(seed))) continue;
    const island = island2(seed);
    generated++;
    yield;
    if (island.fellBack) continue;
    const weights = kindWeights(island.terrain);
    if (!(weights[kind] > 0) || (!relaxed && !suits(weights, kind))) continue;
    plans++;
    const plan = planKind(island.terrain, seed, kind, weights);
    if (plan) return { seed, island, plan, exact: !relaxed, generated, plans };
    if (plans >= budget.plans + 20) return { seed, island, plan: planTown(island.terrain, seed, { character: kind }), exact: false, generated, plans };
    yield;
  }
}
