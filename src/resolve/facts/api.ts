// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// Facts: the vocabulary rules query. A fact is a pure function of the Facts
// object, computed on first use and cached for the rest of that resolve.
//
//   // src/resolve/facts/streets.fact.ts
//   export const streets = defineFact('streets', (f) => findStreets(f.world, f.terrain));
//   // in a rule:
//   const all = streets(ctx.facts);          // same as ctx.facts.get(streets)
//
// A fact may read other facts. A fact must not read rule output (roles,
// features) through anything but `f.shape`, which is only available once the
// shape stage has finished, i.e. to decoration, urban and life rules.

import type { CellKey, EdgeKey } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import type { Terrain, World } from '@/core/world';
import type { ShapePlan, Structure, StructureId, Support } from '../plan';

export interface Facts {
  readonly world: World;
  readonly terrain: Terrain;
  /** world.seed */
  readonly seed: number;
  readonly kinds: ReadonlyMap<CellKey, Kind>;
  readonly structures: ReadonlyMap<StructureId, Structure>;
  readonly structureAt: ReadonlyMap<CellKey, StructureId>;
  readonly floorAt: ReadonlyMap<CellKey, StructureId>;
  readonly edgeAt: ReadonlyMap<EdgeKey, StructureId>;
  readonly supports: readonly Support[];
  /**
   * The finished shape plan (roles, tags, features, sockets). Throws if read
   * before the shape stage is complete: a fact that uses it can only serve
   * decoration, urban and life rules.
   */
  readonly shape: ShapePlan;
  /** True once `shape` can be read. */
  readonly shapeReady: boolean;
  /** Computes the fact on first use, then returns the cached value. */
  get<T>(fact: Fact<T>): T;
}

/** A fact is callable: `streets(facts)` is `facts.get(streets)`. */
export interface Fact<T> {
  (f: Facts): T;
  readonly factName: string;
  readonly compute: (f: Facts) => T;
  readonly $type: 'fact';
}

export function defineFact<T>(name: string, compute: (f: Facts) => T): Fact<T> {
  if (!name) throw new Error('defineFact: a fact needs a name');
  const fact = ((f: Facts) => f.get(fact)) as Fact<T>;
  Object.defineProperties(fact, {
    factName: { value: name, enumerable: true },
    compute: { value: compute },
    $type: { value: 'fact' },
  });
  return fact;
}

export function isFact(x: unknown): x is Fact<unknown> {
  return typeof x === 'function' && (x as { $type?: unknown }).$type === 'fact';
}

/** The data the facts object starts from: the output of passes 1 to 4. */
export interface FactsBase {
  world: World;
  terrain: Terrain;
  kinds: ReadonlyMap<CellKey, Kind>;
  structures: ReadonlyMap<StructureId, Structure>;
  structureAt: ReadonlyMap<CellKey, StructureId>;
  floorAt: ReadonlyMap<CellKey, StructureId>;
  edgeAt: ReadonlyMap<EdgeKey, StructureId>;
  supports: readonly Support[];
}

export interface FactsInternal extends Facts {
  /** Engine only: called once when the shape stage has finished. */
  attachShape(plan: ShapePlan): void;
}

const COMPUTING = Symbol('computing');

export function createFacts(base: FactsBase): FactsInternal {
  const cache = new Map<Fact<unknown>, unknown>();
  let shape: ShapePlan | null = null;
  const facts: FactsInternal = {
    world: base.world,
    terrain: base.terrain,
    seed: base.world.seed,
    kinds: base.kinds,
    structures: base.structures,
    structureAt: base.structureAt,
    floorAt: base.floorAt,
    edgeAt: base.edgeAt,
    supports: base.supports,
    get shape(): ShapePlan {
      if (!shape) {
        throw new Error(
          'facts.shape was read during the shape stage. Facts that use roles, features or sockets ' +
            'are only available to decoration, urban and life rules; shape-stage rules read ctx.plan.',
        );
      }
      return shape;
    },
    get shapeReady(): boolean {
      return shape !== null;
    },
    get<T>(fact: Fact<T>): T {
      const hit = cache.get(fact);
      if (hit === COMPUTING) throw new Error(`fact '${fact.factName}' depends on itself`);
      if (hit !== undefined || cache.has(fact)) return hit as T;
      cache.set(fact, COMPUTING);
      try {
        const value = fact.compute(facts);
        cache.set(fact, value);
        return value;
      } catch (err) {
        cache.delete(fact);
        throw err;
      }
    },
    attachShape(plan: ShapePlan): void {
      shape = plan;
    },
  };
  return facts;
}
