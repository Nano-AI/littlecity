// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// The town plan: everything derived from the saved world, as plain data.
//   resolveShape(world, terrain)  → ShapePlan     (src/resolve/index.ts)
//   resolveDressing(shape)        → DressingPlan
// Nothing here is saved, and nothing here is geometry.

import type { CellKey, Dir4, EdgeKey } from '@/core/grid';
import type { Kind, StructureKind } from '@/core/kinds';
import type {
  ActorParams,
  ActorType,
  ActorVariant,
  FeatureParams,
  FeatureType,
  FeatureVariant,
  PropParams,
  PropType,
  PropVariant,
  Role,
  SocketType,
  Tag,
} from '@/core/vocab';
import type { Terrain, World } from '@/core/world';
import type { Facts } from './facts/api';

// ─────────────────────────────────────────────────────────── structures ──

/**
 * Identifies a structure, stably across edits:
 *  - a structure with block members: the `seq` of its lowest-seq block
 *    (so extending a building never re-rolls it);
 *  - a floor region: FLOOR_ID_BASE + its lowest floor cell key;
 *  - a fence or wall run made only of edge pieces: EDGE_ID_BASE + its lowest edge key.
 */
export type StructureId = number;
export const FLOOR_ID_BASE = 1 << 24;
export const EDGE_ID_BASE = 1 << 25;

/**
 * A group of merged pieces treated as one thing: one house, one marble mass,
 * one pillar shaft, one path region, one fence run.
 */
export interface Structure {
  id: StructureId;
  kind: StructureKind;
  /** Palette index 0–7 (0 for floors). */
  color: number;
  /** hash(world.seed, 'structure', id): the structure's personality. */
  seed: number;
  /** Member cells, ascending. For a floor region: the cells the floor lies in. */
  cells: readonly CellKey[];
  /** Edge pieces in a fence or wall run, ascending; empty for everything else. */
  edges: readonly EdgeKey[];
  /**
   * Content hash, set by the engine after the shape rules ran. Covers
   * everything a generator may read (see CONTRACTS.md, "What a generator may
   * read"). Equal hash ⇒ identical geometry.
   */
  hash: number;
}

/** A generated support under a block that is not carried (design section 9). Never a block. */
export interface Support {
  type: 'bracket' | 'pillar' | 'stilts' | 'platform';
  /** The cell being held up. */
  carries: CellKey;
  /** The level its foot stands on: the first solid top below, or 0 over water. */
  bottomY: number;
  /** bracket: the side neighbour it is fixed to. */
  against?: Dir4;
  /** pillar: joined at the top by a generated arch to the pillar on these sides (S4). */
  arcadeTo?: Dir4[];
}

// ─────────────────────────────────────── features, sockets, props, actors ──

/** Param values are numbers or strings; the typed shape per type comes from the vocabulary. */
export type LooseParams = object;

/**
 * Something built into a structure: a door, a window, a roof type for a
 * region, a chimney. Emitted by role and joinery rules; drawn by a part,
 * baked into the structure's mesh; part of the structure's content hash.
 * Placed by logical position, never raw coordinates.
 *
 * `Feature` is the loose form stored in plans. `FeatureOf<'door'>` is the
 * same record with `variant` and `params` typed from the vocabulary; narrow
 * with `isFeature(f, 'door')`.
 */
export interface Feature {
  /** Assigned by the engine: `<type>@<cell>:<dir>` and similar. Unique within a plan. */
  id: string;
  type: FeatureType;
  structure: StructureId;
  cell?: CellKey;
  dir?: Dir4;
  /** For features of an edge piece in a fence or wall run. */
  edge?: EdgeKey;
  /** Roof region index (the roofRegions fact) for per-region features. */
  region?: number;
  variant?: string;
  params?: LooseParams;
  /** The rule that emitted it. */
  rule: string;
}
export type FeatureOf<T extends FeatureType> = Omit<Feature, 'type' | 'variant' | 'params'> & {
  type: T;
  variant?: FeatureVariant<T>;
  params?: FeatureParams<T>;
};

/**
 * A typed attachment point. Declared by a rule; its exact frame comes from
 * the part that draws its owner (`anchors[name]`), or, with no owner, from
 * the cell and dir (src/gen/frames.ts, socketFallbackFrame).
 */
export interface Socket {
  /** `<owner id>/<name>` when owned, else `<type>@<cell>:<dir>`. Stable across unrelated edits. */
  id: string;
  type: SocketType;
  cell: CellKey;
  dir?: Dir4;
  structure?: StructureId;
  /** Id of the feature or prop whose part supplies the frame. */
  owner?: string;
  /** The key in the owner part's `anchors`. Defaults to the socket type. */
  name?: string;
  rule: string;
}

/**
 * A place one thing can occupy; claims are over slots. Build them with the
 * `slot` helpers in src/resolve/engine/api.ts:
 *   'floor:<cell>:<c|n|e|s|w|ne|se|sw|nw>'  'socket:<id>'  'line:<a>|<b>'  'role:<structure>'
 * Any other string is a rule-defined slot.
 */
export type Slot = string;

export type CellPos = 'c' | 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw';
export const CELL_POSITIONS: readonly CellPos[] = ['c', 'n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'];

/** Where a prop or actor is, logically. */
export type Anchor =
  | { socket: string }
  | { cell: CellKey; pos: CellPos; /** Which way it faces; default: toward the cell centre. */ face?: Dir4 }
  | { from: string; to: string }; // a line between two sockets

/** A free-standing or attached object from a decoration or urban rule. `PropOf<'lamp'>` is the typed form. */
export interface Prop {
  /** Assigned by the engine: `<rule>@<anchor cell>[:<key>][#n]`. Stable across unrelated edits. */
  id: string;
  type: PropType;
  at: Anchor;
  variant?: string;
  params?: LooseParams;
  rule: string;
  /** Content hash (type, anchor, variant, params). */
  hash: number;
}
export type PropOf<T extends PropType> = Omit<Prop, 'type' | 'variant' | 'params'> & {
  type: T;
  variant?: PropVariant<T>;
  params?: PropParams<T>;
};

/** A moving thing from a life rule. `ActorOf<'gull'>` is the typed form. */
export interface Actor {
  id: string;
  type: ActorType;
  /** null for free-roaming actors (gulls, sailboats). */
  at: Anchor | null;
  home?: StructureId;
  variant?: string;
  params?: LooseParams;
  rule: string;
  hash: number;
}
export type ActorOf<T extends ActorType> = Omit<Actor, 'type' | 'variant' | 'params'> & {
  type: T;
  variant?: ActorVariant<T>;
  params?: ActorParams<T>;
};

export function isFeature<T extends FeatureType>(f: Feature, type: T): f is FeatureOf<T> {
  return f.type === type;
}
export function isProp<T extends PropType>(p: Prop, type: T): p is PropOf<T> {
  return p.type === type;
}
export function isActor<T extends ActorType>(a: Actor, type: T): a is ActorOf<T> {
  return a.type === type;
}

// ──────────────────────────────────────────────────────── walking graph ──

export type NavSurface = 'path' | 'plaza' | 'garden' | 'grass' | 'sand' | 'deck' | 'stairs' | 'steps' | 'roof';

export interface NavNode {
  /** The cell a person stands in (the cell above the walkable top, or a stairs cell). */
  cell: CellKey;
  surface: NavSurface;
  /** Cost to cross this cell (catalogue L24: path or plaza 1, deck 1.5, grass 3). */
  cost: number;
}

export interface NavLink {
  /** Indices into NavGraph.nodes. Links are two-way. */
  a: number;
  b: number;
  /**
   * 'walk' side by side; 'stairs' up a stairs block; 'steps' carved terrain
   * steps (J17); 'gate' through a fence gate or wall opening (J20);
   * 'interior' through a building between two of its doors or its roof
   * hatch (the person is hidden for `seconds`).
   */
  via: 'walk' | 'stairs' | 'steps' | 'gate' | 'interior';
  /** Extra cost of the link itself, on top of the nodes' costs. */
  cost: number;
  /** interior links: the building, and how long the walk through it takes. */
  structure?: StructureId;
  seconds?: number;
}

export interface NavGraph {
  nodes: readonly NavNode[];
  links: readonly NavLink[];
  nodeAt: ReadonlyMap<CellKey, number>;
}

export const EMPTY_NAV: NavGraph = { nodes: [], links: [], nodeAt: new Map() };

// ──────────────────────────────────────────────────────────────── plans ──

/** What one rule did in one resolve. Printed by `npm run inspect`. */
export interface RuleTrace {
  rule: string;
  part: string;
  candidates: number;
  /** Candidates dropped by the seeded chance roll. */
  chanceSkipped: number;
  /** Candidates dropped because a slot they claim was taken. */
  claimSkipped: number;
  applied: number;
  /** Only when the caller passed a clock (bench); town logic never reads time. */
  ms?: number;
}

/** Stage 1 of town logic: everything that decides geometry. */
export interface ShapePlan {
  world: World;
  terrain: Terrain;
  /** Resolved kind of every block (Auto resolved by K1–K5). */
  kinds: ReadonlyMap<CellKey, Kind>;
  structures: ReadonlyMap<StructureId, Structure>;
  /** The block structure occupying a cell. */
  structureAt: ReadonlyMap<CellKey, StructureId>;
  /** The floor-region structure lying in a cell (a cell can hold a floor and a block). */
  floorAt: ReadonlyMap<CellKey, StructureId>;
  /** The fence or wall run an edge piece belongs to. */
  edgeAt: ReadonlyMap<EdgeKey, StructureId>;
  supports: readonly Support[];
  facts: Facts;
  roles: ReadonlyMap<StructureId, { role: Role; rule: string }>;
  tags: ReadonlyMap<StructureId, ReadonlySet<Tag>>;
  features: readonly Feature[];
  featuresByStructure: ReadonlyMap<StructureId, readonly Feature[]>;
  sockets: readonly Socket[];
  /** Sockets by the id of the feature that owns them. */
  socketsByOwner: ReadonlyMap<string, readonly Socket[]>;
  /** Slot → the rule that claimed it, for the shape stage. */
  claims: ReadonlyMap<Slot, string>;
  trace: readonly RuleTrace[];
  /** Hash of every structure hash and every support. */
  hash: number;
}

/** Stage 2 of town logic: props, actors and the walking graph. */
export interface DressingPlan {
  props: readonly Prop[];
  actors: readonly Actor[];
  /** Sockets declared by dressing-stage rules (lamp heads, perches, seats). */
  sockets: readonly Socket[];
  nav: NavGraph;
  claims: ReadonlyMap<Slot, string>;
  trace: readonly RuleTrace[];
  hash: number;
}

export interface TownPlan {
  shape: ShapePlan;
  dressing: DressingPlan;
}
