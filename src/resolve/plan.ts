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
//
// Reshaped by People (Stage 3); see docs/swarm/requests/people.md. Built by
// buildNav in src/resolve/nav.ts from the finished shape plan (design
// section 13). `nodes`, `links` and `nodeAt` are as Stage 0 sketched them;
// the rest is new: adjacency for routing, doors, connected parts and the
// single-file runs people queue at.

export type NavSurface = 'path' | 'plaza' | 'garden' | 'grass' | 'sand' | 'deck' | 'roof' | 'stairs' | 'trail';

export interface NavNode {
  /** The cell a person stands in (the cell above the walkable top, a stairs cell, a gate, a ground arch). */
  cell: CellKey;
  surface: NavSurface;
  /** Cost to cross this cell (catalogue L24: path or plaza 1, dock or deck 1.5, grass 3). */
  cost: number;
  /** A stairs cell: the direction its flight climbs toward. The floor rises one level across the cell. */
  rot?: Dir4;
  /** A gate cell or a ground arch: it can be crossed only along this direction and its opposite. */
  passage?: Dir4;
  /**
   * Something solid stands in the middle of the cell (a street tree, crates, a cart, a bench, a café
   * table). The cell stays on the graph, at NAV.clutter more cost, and whoever must cross it keeps to
   * one side. Nobody is sent to linger in one, except to sit at its seats.
   */
  clutter?: boolean;
}

export type NavVia = 'walk' | 'stairs' | 'steps' | 'gate' | 'interior';

export interface NavLink {
  /** Indices into NavGraph.nodes. Links are two-way. For 'stairs' and 'steps', `a` is the lower end. */
  a: number;
  b: number;
  /**
   * 'walk' side by side; 'stairs' from a stairs cell to the cell at its
   * head; 'steps' carved terrain steps (J17); 'gate' through a fence gate
   * or wall opening (J20); 'interior' through a building between two of
   * its doors or its roof hatch (the person is hidden for `seconds`).
   */
  via: NavVia;
  /** Extra cost of the link itself, on top of half of each end's node cost. */
  cost: number;
  /** interior links: the building, how long the walk through it takes, and its two doors (indices into NavGraph.doors, at `a` and at `b`). */
  structure?: StructureId;
  seconds?: number;
  doorA?: number;
  doorB?: number;
  /** A post stands in the middle of the boundary crossed (a lamp, a signpost): walkers cross well to one side of it. */
  post?: boolean;
}

/** A way into a building: a door feature, or the hatch of a roof terrace. */
export interface NavDoor {
  structure: StructureId;
  /** The building cell the door is in (for a hatch: the terrace cell above the roof). */
  cell: CellKey;
  /** The side of `cell` it opens on; undefined for a hatch. */
  dir?: Dir4;
  /** The node a person stands on just outside, or -1 when the door opens onto nothing walkable. */
  node: number;
  /** The door feature's id, or `hatch@<cell>` for a hatch the graph derived. */
  feature: string;
  /** The 'door' socket (its frame is the threshold), if the feature owns one. */
  socket?: string;
  main: boolean;
  hatch: boolean;
  /** Levels from the door's floor down to the node outside (a stoop, J08): 0 or 1. */
  drop: number;
}

/**
 * A stretch only one person wide: a narrow stairs flight, carved steps, a
 * gate, a ground arch. People queue at its ends while someone is coming the
 * other way (catalogue L24).
 */
export interface NavRun {
  id: number;
  /** The links that lie in it, ascending. */
  links: readonly number[];
  /** The nodes at its open ends (where people wait), ascending. */
  ends: readonly number[];
}

export interface NavGraph {
  nodes: readonly NavNode[];
  links: readonly NavLink[];
  nodeAt: ReadonlyMap<CellKey, number>;
  /** Adjacency: the links of node n are linkOf[linkStart[n] … linkStart[n + 1] − 1]. */
  linkStart: Int32Array;
  linkOf: Int32Array;
  doors: readonly NavDoor[];
  /** Door indices per building, ascending. */
  doorsOf: ReadonlyMap<StructureId, readonly number[]>;
  /** Connected part of each node (interior links count). Two nodes have a route exactly when these are equal. */
  part: Int32Array;
  /** Per connected part: how many of its nodes carry a floor (path, plaza or garden). */
  partFloors: Int32Array;
  runs: readonly NavRun[];
  /** The run each link lies in, or -1. */
  runOf: Int32Array;
}

export const EMPTY_NAV: NavGraph = {
  nodes: [],
  links: [],
  nodeAt: new Map(),
  linkStart: new Int32Array(1),
  linkOf: new Int32Array(0),
  doors: [],
  doorsOf: new Map(),
  part: new Int32Array(0),
  partFloors: new Int32Array(0),
  runs: [],
  runOf: new Int32Array(0),
};

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
