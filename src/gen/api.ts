// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// Generators, layers and parts: how plans become geometry.
//
//   generator  one per structure kind; draws a whole structure (its shell and,
//              through the part registry, its features).   src/gen/<kind>/*.gen.ts
//   layer      draws things that are not structures, one mesh per 16 × 16
//              chunk: terrain and sea, generated supports. src/gen/<name>/*.gen.ts
//   part       draws one feature, prop or actor in its own local space.
//                                                           src/parts/**/*.part.ts
//
// All three are pure: plain data in, MeshData out, no DOM, no scene objects,
// no clock. All output is in WORLD space except part meshes, which are in
// the part's local frame (src/core/vocab.ts, "FRAMES").

import type { Chunk } from '@/core/grid';
import type { StructureKind } from '@/core/kinds';
import { multiply, type Mat4Like } from '@/core/mat4';
import { hash, rand } from '@/core/rand';
import type { ActorType, FeatureType, PropType } from '@/core/vocab';
import type { Actor, ActorOf, Feature, FeatureOf, Prop, PropOf, ShapePlan, Structure } from '@/resolve/plan';
import { featureFrame } from './frames';
import { MeshBuilder, type MeshData } from './mesh';

// ─────────────────────────────────────────────────────────────── parts ──

export type PartCategory = 'feature' | 'prop' | 'actor';

export interface PartOutput {
  mesh: MeshData;
  /**
   * Frames of the sockets this item owns, in the part's local space, keyed by
   * the socket's `name` (default: its type). Example: a chimney part returns
   * { 'chimney-top': translation(0, height, 0) }.
   */
  anchors?: Record<string, Mat4Like>;
  /** The mesh is posed every frame by a behaviour (a hint for the renderer's instancing). */
  animated?: boolean;
}

export interface PartContext {
  plan: ShapePlan;
  /** The structure a feature is built into. Undefined for props and actors. */
  structure?: Structure;
  /** Stable per item: hash(structure seed or world seed, item id). */
  seed: number;
  /** Seeded per item: rand(seed, ...parts). */
  rand(...parts: (number | string)[]): number;
  /** Length of the line for a prop anchored { from, to }; 0 otherwise. */
  span: number;
  /** A fresh builder whose ink groups belong to this item. */
  mesh(): MeshBuilder;
  /** To compose other parts into this one. */
  parts: PartRegistry;
}

export type FeaturePartDef<T extends FeatureType> = {
  feature: T;
  build(item: FeatureOf<T>, ctx: PartContext): PartOutput;
};
export type PropPartDef<T extends PropType> = {
  prop: T;
  build(item: PropOf<T>, ctx: PartContext): PartOutput;
};
export type ActorPartDef<T extends ActorType> = {
  actor: T;
  build(item: ActorOf<T>, ctx: PartContext): PartOutput;
};

export interface Part {
  readonly $type: 'part';
  readonly category: PartCategory;
  readonly type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build(item: any, ctx: PartContext): PartOutput;
}

/**
 * Declares the part that draws one feature, prop or actor type.
 * `export default` the result from a `*.part.ts` file.
 *
 *   export default definePart({ feature: 'chimney', build(item, ctx) { ... } });
 *   export default definePart({ prop: 'lamp', build(item, ctx) { ... } });
 *   export default definePart({ actor: 'gull', build(item, ctx) { ... } });
 */
export function definePart<T extends FeatureType>(p: FeaturePartDef<T>): Part;
export function definePart<T extends PropType>(p: PropPartDef<T>): Part;
export function definePart<T extends ActorType>(p: ActorPartDef<T>): Part;
export function definePart(p: { feature?: string; prop?: string; actor?: string; build: Part['build'] }): Part {
  const category: PartCategory = p.feature !== undefined ? 'feature' : p.prop !== undefined ? 'prop' : 'actor';
  const type = p.feature ?? p.prop ?? p.actor;
  if (!type) throw new Error('definePart: give one of feature, prop or actor');
  return Object.freeze({ $type: 'part' as const, category, type, build: p.build });
}

export function isPart(x: unknown): x is Part {
  return typeof x === 'object' && x !== null && (x as { $type?: unknown }).$type === 'part';
}

/** What the caller knows about where an item is being drawn. */
export interface PartEnv {
  plan: ShapePlan;
  structure?: Structure;
  span?: number;
}

export interface PartRegistry {
  has(category: PartCategory, type: string): boolean;
  list(): readonly Part[];
  /** Draws the item with its part, or with a small placeholder marker if no part exists yet. */
  feature(item: Feature, env: PartEnv): PartOutput;
  prop(item: Prop, env: PartEnv): PartOutput;
  actor(item: Actor, env: PartEnv): PartOutput;
}

/** Draws something visible for a type with no part yet. Receives the same context a part would. */
export type PartFallback = (category: PartCategory, item: Feature | Prop | Actor, ctx: PartContext) => PartOutput;

export function createPartRegistry(parts: readonly Part[], fallback: PartFallback): PartRegistry {
  const table = new Map<string, Part>();
  for (const p of parts) {
    const k = `${p.category}:${p.type}`;
    if (table.has(k)) throw new Error(`two parts draw the ${p.category} type '${p.type}'`);
    table.set(k, p);
  }
  const run = (category: PartCategory, item: Feature | Prop | Actor, env: PartEnv): PartOutput => {
    const base = env.structure ? env.structure.seed : env.plan.world.seed;
    const seed = hash(base, item.id);
    const ctx: PartContext = {
      plan: env.plan,
      structure: env.structure,
      seed,
      rand: (...p) => rand(seed, ...p),
      span: env.span ?? 0,
      mesh: () => new MeshBuilder({ ink: item.id }),
      parts: registry,
    };
    const part = table.get(`${category}:${item.type}`);
    return part ? part.build(item, ctx) : fallback(category, item, ctx);
  };
  const registry: PartRegistry = {
    has: (category, type) => table.has(`${category}:${type}`),
    list: () => [...table.values()],
    feature: (item, env) => run('feature', item, env),
    prop: (item, env) => run('prop', item, env),
    actor: (item, env) => run('actor', item, env),
  };
  return registry;
}

// ────────────────────────────────────────────────── generators and layers ──

export interface GenOutput {
  /** World space. */
  mesh: MeshData;
  /** World frames of sockets, keyed by socket id. Fill it with placeFeature / placeFeatures. */
  anchors: Record<string, Mat4Like>;
}

export interface GeneratorDef {
  kind: StructureKind;
  /**
   * Draws one structure. May read only what the structure's content hash
   * covers (CONTRACTS.md, "What a generator may read"): the structure, its
   * role, tags, features and sockets, and its immediate surroundings.
   */
  build(s: Structure, plan: ShapePlan, parts: PartRegistry): GenOutput;
}
export interface Generator extends GeneratorDef {
  readonly $type: 'generator';
}

/** `export default` the result from a `*.gen.ts` file. One generator per structure kind. */
export function defineGenerator(g: GeneratorDef): Generator {
  return Object.freeze({ ...g, $type: 'generator' as const });
}
export function isGenerator(x: unknown): x is Generator {
  return typeof x === 'object' && x !== null && (x as { $type?: unknown }).$type === 'generator';
}

export interface LayerDef {
  /** Unique name: 'terrain', 'sea', 'supports'. */
  layer: string;
  /** Draws this layer's geometry for the columns of one chunk. World space. */
  build(chunk: Chunk, plan: ShapePlan, parts: PartRegistry): GenOutput;
  /** Changes exactly when build() would return something different for this chunk. */
  hash(chunk: Chunk, plan: ShapePlan): number;
}
export interface Layer extends LayerDef {
  readonly $type: 'layer';
}

/** `export` the result from a `*.gen.ts` file. */
export function defineLayer(l: LayerDef): Layer {
  if (!l.layer) throw new Error('defineLayer: a layer needs a name');
  return Object.freeze({ ...l, $type: 'layer' as const });
}
export function isLayer(x: unknown): x is Layer {
  return typeof x === 'object' && x !== null && (x as { $type?: unknown }).$type === 'layer';
}

export interface GeneratorRegistry {
  /** True if a real generator is registered for the kind (not the fallback). */
  has(kind: StructureKind): boolean;
  /** The generator for a kind, or the fallback box generator. */
  forKind(kind: StructureKind): Generator;
  /** Shorthand: forKind(s.kind).build(s, plan, parts). */
  build(s: Structure, plan: ShapePlan, parts: PartRegistry): GenOutput;
  layers(): readonly Layer[];
}

export function createGeneratorRegistry(
  generators: readonly Generator[],
  layers: readonly Layer[],
  fallback: Generator['build'],
): GeneratorRegistry {
  const byKind = new Map<StructureKind, Generator>();
  for (const g of generators) {
    if (byKind.has(g.kind)) throw new Error(`two generators draw the kind '${g.kind}'`);
    byKind.set(g.kind, g);
  }
  const names = new Set<string>();
  for (const l of layers) {
    if (names.has(l.layer)) throw new Error(`two layers are named '${l.layer}'`);
    names.add(l.layer);
  }
  const sortedLayers = [...layers].sort((a, b) => (a.layer < b.layer ? -1 : a.layer > b.layer ? 1 : 0));
  const fallbacks = new Map<StructureKind, Generator>();
  const forKind = (kind: StructureKind): Generator => {
    const real = byKind.get(kind);
    if (real) return real;
    let fb = fallbacks.get(kind);
    if (!fb) fallbacks.set(kind, (fb = defineGenerator({ kind, build: fallback })));
    return fb;
  };
  return {
    has: (kind) => byKind.has(kind),
    forKind,
    build: (s, plan, parts) => forKind(s.kind).build(s, plan, parts),
    layers: () => sortedLayers,
  };
}

// ───────────────────────────────────────────────── helpers for generators ──

/**
 * Draws one feature into a structure's builder at world frame `at`, and
 * records the world frame of every socket the feature owns in `anchors`.
 */
export function placeFeature(
  b: MeshBuilder,
  anchors: Record<string, Mat4Like>,
  f: Feature,
  at: Mat4Like,
  env: { plan: ShapePlan; structure: Structure; parts: PartRegistry },
): void {
  const out = env.parts.feature(f, { plan: env.plan, structure: env.structure });
  b.add(out.mesh, at);
  for (const s of env.plan.socketsByOwner.get(f.id) ?? []) {
    const local = out.anchors?.[s.name ?? s.type];
    if (local) anchors[s.id] = multiply(at, local);
  }
}

/**
 * Draws every feature of a structure at its standard frame (featureFrame).
 * `frame` may return a different frame for a feature, `null` to skip it, or
 * `undefined` to use the standard frame. Features with no standard frame
 * (region features such as roofs) are skipped unless `frame` places them.
 */
export function placeFeatures(
  b: MeshBuilder,
  anchors: Record<string, Mat4Like>,
  s: Structure,
  plan: ShapePlan,
  parts: PartRegistry,
  frame?: (f: Feature) => Mat4Like | null | undefined,
): void {
  for (const f of plan.featuresByStructure.get(s.id) ?? []) {
    const custom = frame?.(f);
    if (custom === null) continue;
    const at = custom ?? featureFrame(f);
    if (at) placeFeature(b, anchors, f, at, { plan, structure: s, parts });
  }
}
