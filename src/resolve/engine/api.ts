// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// The rule format. One rule per file, src/rules/<part>/<ID>.<name>.rule.ts,
// default-exported; the engine discovers it by file glob.
//
//   export default defineRule({
//     id: 'D05.laundry-line', part: 'decoration', tier: 1, priority: 50, chance: 0.6,
//     find({ facts, plan }) { return [...]; },          // pure: where could this apply?
//     claims(c) { return [slot.line(c.data.a, c.data.b)]; },
//     apply(c, out, { rand }) { out.prop({ type: 'laundry-line', at: { from: c.data.a, to: c.data.b } }); },
//   });
//
// How the engine runs rules (src/resolve/engine/run.ts):
//  - Parts run in the order roles, joinery (inside resolveShape), then
//    decoration, urban, life (inside resolveDressing).
//  - Within a part: priority descending, then id ascending.
//  - A rule's candidates run in ascending anchor cell-key order (ties keep
//    the order find() returned them in).
//  - Per candidate: the chance roll, then the claims check, then apply.
//  - A rule sees everything emitted by the rules that ran before it.

import { pick, rand } from '@/core/rand';
import type { CellKey } from '@/core/grid';
import type { ActorType, FeatureType, PropType, Role, Tag } from '@/core/vocab';
import type { Facts } from '../facts/api';
import type {
  Actor,
  ActorOf,
  CellPos,
  FeatureOf,
  NavGraph,
  Prop,
  PropOf,
  ShapePlan,
  Slot,
  Socket,
  StructureId,
} from '../plan';

export type RulePart = 'roles' | 'joinery' | 'decoration' | 'urban' | 'life';
/** Run order. */
export const RULE_PARTS: readonly RulePart[] = ['roles', 'joinery', 'decoration', 'urban', 'life'];
export const SHAPE_PARTS: readonly RulePart[] = ['roles', 'joinery'];
export const DRESSING_PARTS: readonly RulePart[] = ['decoration', 'urban', 'life'];

/**
 * One place a rule could apply.
 *  - `anchor` orders candidates and seeds the chance roll.
 *  - `structure` is the structure concerned; for a role rule it is the
 *    structure that gets the role, and its role slot is claimed for you.
 *  - `key` tells apart several candidates on one anchor (one per facade
 *    side, per facing pair): it joins the chance seed and the ids.
 *  - `data` is whatever find() wants to hand to claims() and apply().
 */
export type Candidate<D = undefined> = {
  anchor: CellKey;
  structure?: StructureId;
  key?: string | number;
} & (undefined extends D ? { data?: D } : { data: D });

/** What the dressing stage has produced so far; null fields are not built yet. */
export interface DressingDraft {
  readonly props: readonly Prop[];
  readonly actors: readonly Actor[];
  /** Sockets declared by dressing-stage rules so far. */
  readonly sockets: readonly Socket[];
  /** The walking graph: built after the urban part, so only life rules see it. */
  readonly nav: NavGraph | null;
}

export interface RuleContext {
  facts: Facts;
  /**
   * The shape plan. For roles and joinery rules it is still being filled in:
   * roles, tags, features and sockets from earlier rules are there, structure
   * hashes are not. For dressing-stage rules it is complete.
   */
  plan: ShapePlan;
  /** Null in the shape stage. */
  dressing: DressingDraft | null;
  /** world.seed */
  seed: number;
}

export interface ApplyContext extends RuleContext {
  /** Seeded per candidate: rand(seed, rule id, anchor, key, ...parts). */
  rand(...parts: (number | string)[]): number;
  /** Seeded per candidate weighted choice. */
  pick<T>(items: readonly T[], weights: readonly number[] | null, ...parts: (number | string)[]): T;
}

export type FeatureInput<T extends FeatureType> = Omit<FeatureOf<T>, 'id' | 'rule'>;
export type PropInput<T extends PropType> = Omit<PropOf<T>, 'id' | 'rule' | 'hash'>;
export type ActorInput<T extends ActorType> = Omit<ActorOf<T>, 'id' | 'rule' | 'hash'>;
export type SocketInput = Omit<Socket, 'id' | 'rule'> & { id?: string };

/** How a rule emits. Rules never change saved data and never emit geometry. */
export interface RuleOut {
  /** Shape stage only. A structure has one role; a second call for the same structure throws. */
  role(s: StructureId, role: Role): void;
  /** Shape stage only. */
  tag(s: StructureId, tag: Tag): void;
  /** Shape stage only. Returns the feature's id (use it as a socket's `owner`). */
  feature<T extends FeatureType>(f: FeatureInput<T>): string;
  /** Either stage. Returns the socket's id (use it in an Anchor or a claim). */
  socket(s: SocketInput): string;
  /** Dressing stage only. Returns the prop's id. */
  prop<T extends PropType>(p: PropInput<T>): string;
  /** Dressing stage only. Returns the actor's id. */
  actor<T extends ActorType>(a: ActorInput<T>): string;
}

export interface RuleDef<D = undefined> {
  /** Catalogue id plus a short name: 'R-H01.chapel', 'J09.windows', 'D05.laundry-line'. Never reused. */
  id: string;
  part: RulePart;
  /** 1 core, 2 rich, 3 delight. */
  tier: 1 | 2 | 3;
  /** Higher runs first within its part. */
  priority: number;
  /** Depends on the whole town (tallest, counts); skipped when ResolveOptions.skipTownWide is set. */
  townWide?: boolean;
  /** One line for `npm run inspect`: the facts it reads and what it claims. */
  about?: string;
  /** Pure. Where could this rule apply? */
  find(ctx: RuleContext): Candidate<D>[];
  /** Seeded chance per candidate, 0 < chance ≤ 1. Omitted means always. */
  chance?: number;
  /** The slots this candidate would occupy. If any is taken the candidate is skipped. */
  claims?(c: Candidate<D>, ctx: RuleContext): Slot[];
  apply(c: Candidate<D>, out: RuleOut, ctx: ApplyContext): void;
}

/** A validated rule, as returned by defineRule. */
export interface Rule extends RuleDef<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  readonly $type: 'rule';
}

const ID_PATTERN = /^[A-Z][A-Z0-9-]*\.[a-z0-9][a-z0-9-]*$/;

/** Validates a rule and returns it. `export default` the result from a `*.rule.ts` file. */
export function defineRule<D = undefined>(rule: RuleDef<D>): Rule {
  if (!ID_PATTERN.test(rule.id)) {
    throw new Error(`defineRule: id '${rule.id}' must look like 'D05.laundry-line' (catalogue id, dot, kebab name)`);
  }
  if (!RULE_PARTS.includes(rule.part)) throw new Error(`defineRule ${rule.id}: unknown part '${rule.part}'`);
  if (!Number.isFinite(rule.priority)) throw new Error(`defineRule ${rule.id}: priority must be a finite number`);
  if (rule.chance !== undefined && !(rule.chance > 0 && rule.chance <= 1)) {
    throw new Error(`defineRule ${rule.id}: chance must be in (0, 1]`);
  }
  return Object.freeze({ ...rule, $type: 'rule' as const }) as Rule;
}

export function isRule(x: unknown): x is Rule {
  return typeof x === 'object' && x !== null && (x as { $type?: unknown }).$type === 'rule';
}

/** Slot builders. A slot is a string, so equal slots collide whoever built them. */
export const slot = {
  /** One of the nine floor positions in a cell. */
  floor(cell: CellKey, pos: CellPos): Slot {
    return `floor:${cell}:${pos}`;
  },
  /** All nine floor positions of a cell (for something that fills it). */
  cell(cell: CellKey): Slot[] {
    return ['c', 'n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'].map((p) => `floor:${cell}:${p}`);
  },
  socket(id: string): Slot {
    return `socket:${id}`;
  },
  /** The air line between two sockets; the order of a and b does not matter. */
  line(a: string, b: string): Slot {
    return a < b ? `line:${a}|${b}` : `line:${b}|${a}`;
  },
  /** A structure's one role. Claimed automatically for role rules whose candidate names a structure. */
  role(s: StructureId): Slot {
    return `role:${s}`;
  },
  /** A rule-defined slot, e.g. slot.custom('street-lamps', streetId). */
  custom(namespace: string, ...parts: (number | string)[]): Slot {
    return `${namespace}:${parts.join(':')}`;
  },
};

/** The chance roll the engine makes for a candidate (exposed for tests and tools). */
export function candidateRoll(seed: number, ruleId: string, c: { anchor: CellKey; key?: string | number }): number {
  return c.key === undefined ? rand(seed, ruleId, c.anchor) : rand(seed, ruleId, c.anchor, c.key);
}

/** The per-candidate seeded helpers handed to apply(). */
export function candidateRandom(
  seed: number,
  ruleId: string,
  c: { anchor: CellKey; key?: string | number },
): Pick<ApplyContext, 'rand' | 'pick'> {
  const k = c.key === undefined ? '' : c.key;
  return {
    rand: (...parts) => rand(seed, ruleId, c.anchor, k, 'apply', ...parts),
    pick: (items, weights, ...parts) => pick(items, weights, seed, ruleId, c.anchor, k, 'apply', ...parts),
  };
}

export interface ResolveOptions {
  /** Run these rules instead of the discovered ones (unit tests, fixtures). */
  rules?: readonly Rule[];
  /** Skip rules marked townWide (the locality test). */
  skipTownWide?: boolean;
  /** Fill RuleTrace.ms using this clock. Only tools pass one; town logic never reads time. */
  clock?: () => number;
}
