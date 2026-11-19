// Assertions for a scenario's expect() (Stage 0, real; treat as frozen).
// They throw plain Errors, so scenario files never import a test framework
// and load in the browser too.

import { key } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import type { ActorType, FeatureType, PropType, Role, SocketType, Tag } from '@/core/vocab';
import type { Actor, DressingPlan, Feature, Prop, ShapePlan, Socket, Structure } from '@/resolve/plan';

type XYZ = readonly [x: number, y: number, z: number];

export interface FeatureQuery {
  type?: FeatureType;
  variant?: string;
  /** The feature's cell. */
  at?: XYZ;
  /** Any cell of the structure the feature belongs to. */
  on?: XYZ;
  dir?: number;
  rule?: string;
}
export interface ItemQuery<T extends string> {
  type?: T;
  variant?: string;
  rule?: string;
  /** For cell anchors: the anchor's cell. */
  at?: XYZ;
}
export interface SocketQuery {
  type?: SocketType;
  at?: XYZ;
  dir?: number;
  rule?: string;
}

export interface Check {
  /** Fails with `message` unless `condition` is truthy. */
  ok(condition: unknown, message: string): void;
  equal<T>(actual: T, expected: T, what?: string): void;

  /** The resolved kind of the block at a cell. */
  kind(x: number, y: number, z: number, kind: Kind): void;
  /** The block structure at a cell (fails if there is none). */
  structure(x: number, y: number, z: number): Structure;
  /** The floor-region structure in a cell (fails if there is none). */
  floorStructure(x: number, y: number, z: number): Structure;
  /** Two cells belong to the same block structure. */
  sameStructure(a: XYZ, b: XYZ): void;
  differentStructures(a: XYZ, b: XYZ): void;
  /** The role of the block structure at a cell. */
  role(x: number, y: number, z: number, role: Role): void;
  hasTag(x: number, y: number, z: number, tag: Tag): void;

  /** Matching features (may be empty). */
  features(q?: FeatureQuery): Feature[];
  /** Fails unless at least `min` (default 1) features match; returns them. */
  hasFeature(q: FeatureQuery, min?: number): Feature[];
  noFeature(q: FeatureQuery): void;

  sockets(q?: SocketQuery): Socket[];
  hasSocket(q: SocketQuery, min?: number): Socket[];

  props(q?: ItemQuery<PropType>): Prop[];
  hasProp(q: ItemQuery<PropType>, min?: number): Prop[];
  noProp(q: ItemQuery<PropType>): void;

  actors(q?: ItemQuery<ActorType>): Actor[];
  hasActor(q: ItemQuery<ActorType>, min?: number): Actor[];
  noActor(q: ItemQuery<ActorType>): void;

  /** How many candidates the rule applied to, across both stages. */
  applied(ruleId: string): number;
}

export function createCheck(plan: ShapePlan, dressing: DressingPlan, name = 'scenario'): Check {
  const fail = (message: string): never => {
    throw new Error(`[${name}] ${message}`);
  };
  const show = (q: object): string => JSON.stringify(q);
  const cellOf = (c: XYZ): number => key(c[0], c[1], c[2]);

  const structure = (x: number, y: number, z: number): Structure => {
    const id = plan.structureAt.get(key(x, y, z));
    const s = id !== undefined ? plan.structures.get(id) : undefined;
    return s ?? fail(`no block structure at (${x}, ${y}, ${z})`);
  };

  const features = (q: FeatureQuery = {}): Feature[] => {
    const onId = q.on ? plan.structureAt.get(cellOf(q.on)) ?? plan.floorAt.get(cellOf(q.on)) ?? -1 : undefined;
    return plan.features.filter(
      (f) =>
        (q.type === undefined || f.type === q.type) &&
        (q.variant === undefined || f.variant === q.variant) &&
        (q.at === undefined || f.cell === cellOf(q.at)) &&
        (onId === undefined || f.structure === onId) &&
        (q.dir === undefined || f.dir === q.dir) &&
        (q.rule === undefined || f.rule === q.rule),
    );
  };
  const sockets = (q: SocketQuery = {}): Socket[] =>
    [...plan.sockets, ...dressing.sockets].filter(
      (s) =>
        (q.type === undefined || s.type === q.type) &&
        (q.at === undefined || s.cell === cellOf(q.at)) &&
        (q.dir === undefined || s.dir === q.dir) &&
        (q.rule === undefined || s.rule === q.rule),
    );
  const matchItem = <I extends Prop | Actor>(list: readonly I[], q: ItemQuery<string>): I[] =>
    list.filter(
      (i) =>
        (q.type === undefined || i.type === q.type) &&
        (q.variant === undefined || i.variant === q.variant) &&
        (q.rule === undefined || i.rule === q.rule) &&
        (q.at === undefined || (i.at !== null && 'cell' in i.at && i.at.cell === cellOf(q.at))),
    );
  const atLeast = <T>(found: T[], min: number, what: string, q: object): T[] => {
    if (found.length < min) fail(`expected at least ${min} ${what} matching ${show(q)}, found ${found.length}`);
    return found;
  };
  const none = <T>(found: T[], what: string, q: object): void => {
    if (found.length > 0) fail(`expected no ${what} matching ${show(q)}, found ${found.length}`);
  };

  return {
    ok(condition, message) {
      if (!condition) fail(message);
    },
    equal(actual, expected, what = 'value') {
      if (actual !== expected) fail(`${what}: expected ${String(expected)}, got ${String(actual)}`);
    },
    kind(x, y, z, kind) {
      const actual = plan.kinds.get(key(x, y, z));
      if (actual !== kind) fail(`kind at (${x}, ${y}, ${z}): expected ${kind}, got ${actual ?? 'nothing'}`);
    },
    structure,
    floorStructure(x, y, z) {
      const id = plan.floorAt.get(key(x, y, z));
      const s = id !== undefined ? plan.structures.get(id) : undefined;
      return s ?? fail(`no floor at (${x}, ${y}, ${z})`);
    },
    sameStructure(a, b) {
      if (structure(...a).id !== structure(...b).id) fail(`(${a}) and (${b}) should be one structure`);
    },
    differentStructures(a, b) {
      if (structure(...a).id === structure(...b).id) fail(`(${a}) and (${b}) should be different structures`);
    },
    role(x, y, z, role) {
      const actual = plan.roles.get(structure(x, y, z).id);
      if (actual?.role !== role) {
        fail(`role at (${x}, ${y}, ${z}): expected ${role}, got ${actual ? `${actual.role} (from ${actual.rule})` : 'none'}`);
      }
    },
    hasTag(x, y, z, tag) {
      if (!plan.tags.get(structure(x, y, z).id)?.has(tag)) fail(`structure at (${x}, ${y}, ${z}) lacks tag '${tag}'`);
    },
    features,
    hasFeature: (q, min = 1) => atLeast(features(q), min, 'feature(s)', q),
    noFeature: (q) => none(features(q), 'feature', q),
    sockets,
    hasSocket: (q, min = 1) => atLeast(sockets(q), min, 'socket(s)', q),
    props: (q = {}) => matchItem(dressing.props, q),
    hasProp: (q, min = 1) => atLeast(matchItem(dressing.props, q), min, 'prop(s)', q),
    noProp: (q) => none(matchItem(dressing.props, q), 'prop', q),
    actors: (q = {}) => matchItem(dressing.actors, q),
    hasActor: (q, min = 1) => atLeast(matchItem(dressing.actors, q), min, 'actor(s)', q),
    noActor: (q) => none(matchItem(dressing.actors, q), 'actor', q),
    applied(ruleId) {
      let n = 0;
      for (const t of [...plan.trace, ...dressing.trace]) if (t.rule === ruleId) n += t.applied;
      return n;
    },
  };
}
