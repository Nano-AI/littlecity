// The rule engine (Stage 0, real). Semantics are pinned by run.test.ts and
// documented in api.ts and docs/swarm/CONTRACTS.md; keep them if you touch this.
//
//   runShapeStage(base, rules)        roles, joinery → ShapePlan with hashes
//   runDressingStage(shape, rules, …) decoration, urban, (nav), life → DressingPlan

import type { CellKey } from '@/core/grid';
import type { Role, Tag } from '@/core/vocab';
import { createFacts, type FactsBase } from '../facts/api';
import { contentKeys, memosOn, regionKey, RegionMemo, registerMemo } from '../facts/content-keys.fact';
import type {
  Actor,
  Anchor,
  DressingPlan,
  Feature,
  NavGraph,
  Prop,
  RuleTrace,
  ShapePlan,
  Slot,
  Socket,
  StructureId,
  Support,
} from '../plan';
import {
  candidateRandom,
  candidateRoll,
  DRESSING_PARTS,
  RULE_PARTS,
  SHAPE_PARTS,
  slot,
  type ApplyContext,
  type Candidate,
  type DressingDraft,
  type ResolveOptions,
  type Rule,
  type RuleContext,
  type RuleOut,
  type RulePart,
} from './api';
import { hashDressing, hashItem, hashShape, hashStructure } from './hash';
import { OutputLanes, ShapeReuse, type Lane } from './reuse';

const sortedCache = new WeakMap<readonly Rule[], Rule[]>();
/** sortRules, remembered per rules array (the discovered list is the same array every resolve). */
function sortedRules(rules: readonly Rule[]): Rule[] {
  let sorted = sortedCache.get(rules);
  if (!sorted) sortedCache.set(rules, (sorted = sortRules(rules)));
  return sorted;
}

/** Run order: part, then priority descending, then id. Throws on a duplicate id. */
export function sortRules(rules: readonly Rule[]): Rule[] {
  const seen = new Set<string>();
  for (const r of rules) {
    if (seen.has(r.id)) throw new Error(`two rules share the id '${r.id}'; rule ids are unique and never reused`);
    seen.add(r.id);
  }
  return [...rules].sort(
    (a, b) =>
      RULE_PARTS.indexOf(a.part) - RULE_PARTS.indexOf(b.part) ||
      b.priority - a.priority ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

type AnyCandidate = Candidate<unknown>;

class Ids {
  private used = new Set<string>();
  constructor(initial?: Iterable<string>) {
    if (initial) for (const id of initial) this.used.add(id);
  }
  has(id: string): boolean {
    return this.used.has(id);
  }
  /** Returns `base`, or `base~2`, `base~3`… if taken. */
  unique(base: string): string {
    let id = base;
    for (let n = 2; this.used.has(id); n++) id = `${base}~${n}`;
    this.used.add(id);
    return id;
  }
  /** Returns `id` or throws if taken. */
  exact(id: string, what: string): string {
    if (this.used.has(id)) throw new Error(`${what}: id '${id}' is already in use`);
    this.used.add(id);
    return id;
  }
}

interface StageEnv {
  parts: readonly RulePart[];
  ctx: RuleContext;
  /** Earlier claims this stage must respect (the shape stage's, during dressing). */
  inherited: ReadonlyMap<Slot, string> | null;
  claims: Map<Slot, string>;
  trace: RuleTrace[];
  opts: ResolveOptions;
  makeOut(rule: Rule, c: AnyCandidate): RuleOut;
  /** Called between parts (the dressing stage builds the walking graph before 'life'). */
  beforePart?(part: RulePart): void;
  /** Reuse of earlier resolves' work for rules marked `local` (shape stage). */
  reuse?: ShapeReuse;
  /** makeOut ignores the candidate: one emitter per rule will do. */
  outPerRule?: boolean;
}

function runParts(rules: readonly Rule[], env: StageEnv): void {
  const sorted = sortedRules(rules);
  const { ctx, claims, inherited, opts } = env;
  // One emitter per rule when it does not depend on the candidate (the shape stage).
  const outs = env.outPerRule ? new Map<Rule, RuleOut>() : null;
  const seed = ctx.seed;
  for (const part of env.parts) {
    env.beforePart?.(part);
    for (const rule of sorted) {
      if (rule.part !== part) continue;
      if (rule.townWide && opts.skipTownWide) continue;
      if (opts.maxTier !== undefined && rule.tier > opts.maxTier) continue;
      const t0 = opts.clock ? opts.clock() : 0;
      const tr: RuleTrace = { rule: rule.id, part, candidates: 0, chanceSkipped: 0, claimSkipped: 0, applied: 0 };
      env.reuse?.beginRule(rule);
      let found: AnyCandidate[];
      try {
        found = env.reuse && rule.findEach && rule.local !== undefined && memosOn() ? env.reuse.find(rule, ctx) : (rule.find(ctx) as AnyCandidate[]);
      } catch (err) {
        throw annotate(err, `rule ${rule.id} find()`);
      }
      // Cell-key order; Array.prototype.sort is stable, so ties keep find()'s order.
      const candidates = [...found].sort((a, b) => a.anchor - b.anchor);
      tr.candidates = candidates.length;
      for (const c of candidates) {
        if (rule.chance !== undefined && rule.chance < 1 && candidateRoll(seed, rule.id, c) >= rule.chance) {
          tr.chanceSkipped++;
          continue;
        }
        let wanted: Slot[];
        try {
          wanted = rule.claims ? [...rule.claims(c, ctx)] : [];
        } catch (err) {
          throw annotate(err, `rule ${rule.id} claims() at cell ${c.anchor}`);
        }
        if (part === 'roles' && c.structure !== undefined) wanted.push(slot.role(c.structure));
        let taken = false;
        for (const s of wanted) {
          if (claims.has(s) || inherited?.has(s)) {
            taken = true;
            break;
          }
        }
        if (taken) {
          tr.claimSkipped++;
          continue;
        }
        for (const s of wanted) claims.set(s, rule.id);
        const out = outs ? (outs.get(rule) ?? outs.set(rule, env.makeOut(rule, c)).get(rule)!) : env.makeOut(rule, c);
        try {
          if (env.reuse && rule.local !== undefined && rule.localReplay !== false) {
            env.reuse.apply(rule, c, ctx, out, (o) => rule.apply(c, o, { ...ctx, ...candidateRandom(seed, rule.id, c) }));
          } else rule.apply(c, out, { ...ctx, ...candidateRandom(seed, rule.id, c) } as ApplyContext);
        } catch (err) {
          throw annotate(err, `rule ${rule.id} apply() at cell ${c.anchor}`);
        }
        tr.applied++;
      }
      if (opts.clock) tr.ms = opts.clock() - t0;
      env.trace.push(tr);
    }
  }
}

function annotate(err: unknown, where: string): Error {
  const e = err instanceof Error ? err : new Error(String(err));
  if (!e.message.startsWith('[')) e.message = `[${where}] ${e.message}`;
  return e;
}

function itemBaseId(rule: Rule, c: AnyCandidate): string {
  return `${rule.id}@${c.anchor}${c.key !== undefined ? `:${c.key}` : ''}`;
}

function socketId(s: { id?: string; owner?: string; name?: string; type: string; cell: CellKey; dir?: number }): string {
  if (s.id) return s.id;
  if (s.owner) return `${s.owner}/${s.name ?? s.type}`;
  return `${s.type}@${s.cell}${s.dir !== undefined ? `:${s.dir}` : ''}${s.name ? `/${s.name}` : ''}`;
}

function featureId(f: {
  type: string;
  structure: StructureId;
  cell?: CellKey;
  dir?: number;
  edge?: number;
  region?: number;
}): string {
  let where: string;
  if (f.cell !== undefined) where = String(f.cell);
  else if (f.edge !== undefined) where = `e${f.edge}`;
  else where = `s${f.structure}`;
  if (f.region !== undefined) where += `r${f.region}`;
  return `${f.type}@${where}${f.dir !== undefined ? `:${f.dir}` : ''}`;
}

// Structure hashes kept across resolves (see the end of runShapeStage).
const hashMemo = registerMemo(new RegionMemo<number>());
const SUPPORT_CODES = new Map<string, number>();
function supportCode(type: string): number {
  let c = SUPPORT_CODES.get(type);
  if (c === undefined) SUPPORT_CODES.set(type, (c = SUPPORT_CODES.size + 1));
  return c;
}
function mix(h: number, k: number): number {
  k = Math.imul(k | 0, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  h ^= k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}

const SHAPE_ONLY = 'is only available to roles and joinery rules (the shape stage)';
const DRESSING_ONLY = 'is only available to decoration, urban and life rules (the dressing stage)';

// ──────────────────────────────────────────────────────────────── shape ──

export function runShapeStage(base: FactsBase, rules: readonly Rule[], opts: ResolveOptions = {}): ShapePlan {
  const facts = createFacts(base);
  const roles = new Map<StructureId, { role: Role; rule: string }>();
  const tags = new Map<StructureId, Set<Tag>>();
  const features: Feature[] = [];
  const featuresByStructure = new Map<StructureId, Feature[]>();
  const sockets: Socket[] = [];
  const socketsByOwner = new Map<string, Socket[]>();
  const claims = new Map<Slot, string>();
  const trace: RuleTrace[] = [];
  const ids = new Ids();
  const lanes = new OutputLanes();
  const putFeature = (f: Feature, h: Lane): void => {
    features.push(f);
    let list = featuresByStructure.get(f.structure);
    if (!list) featuresByStructure.set(f.structure, (list = []));
    list.push(f);
    lanes.feature(f, h);
  };
  const putSocket = (s: Socket, h: Lane): void => {
    sockets.push(s);
    if (s.owner !== undefined) {
      let list = socketsByOwner.get(s.owner);
      if (!list) socketsByOwner.set(s.owner, (list = []));
      list.push(s);
    }
    lanes.socket(s, h);
  };
  const reuse = new ShapeReuse(facts, lanes, {
    hasId: (id) => ids.has(id),
    putFeature(f, h) {
      ids.exact(f.id, 'replay');
      putFeature(f, h);
    },
    putSocket(s, h) {
      ids.exact(s.id, 'replay');
      putSocket(s, h);
    },
  });

  const plan: ShapePlan = {
    world: base.world,
    terrain: base.terrain,
    kinds: base.kinds,
    structures: base.structures,
    structureAt: base.structureAt,
    floorAt: base.floorAt,
    edgeAt: base.edgeAt,
    supports: base.supports,
    facts,
    roles,
    tags,
    features,
    featuresByStructure,
    sockets,
    socketsByOwner,
    claims,
    trace,
    hash: 0,
  };

  const needStructure = (s: StructureId, what: string): void => {
    if (!base.structures.has(s)) throw new Error(`${what}: no structure with id ${s}`);
  };

  const makeOut = (rule: Rule): RuleOut => ({
    role(s, role) {
      needStructure(s, 'out.role');
      const had = roles.get(s);
      if (had) {
        throw new Error(
          `out.role: structure ${s} already has the role '${had.role}' from ${had.rule}. ` +
            `Claim slot.role(${s}) so this candidate is skipped instead.`,
        );
      }
      const owner = claims.get(slot.role(s));
      if (owner !== undefined && owner !== rule.id) {
        throw new Error(`out.role: the role of structure ${s} is claimed by ${owner}`);
      }
      claims.set(slot.role(s), rule.id);
      roles.set(s, { role, rule: rule.id });
      lanes.role(s, role, rule.id);
      reuse.emitted({ m: 'role', s, role });
    },
    tag(s, tag) {
      needStructure(s, 'out.tag');
      let set = tags.get(s);
      if (!set) tags.set(s, (set = new Set()));
      set.add(tag);
      lanes.tag(s, tag);
      reuse.emitted({ m: 'tag', s, tag });
    },
    feature(input) {
      needStructure(input.structure, `out.feature('${input.type}')`);
      const base = featureId(input);
      const f = { ...input, id: ids.unique(base), rule: rule.id } as Feature;
      const h = lanes.featureHash(f);
      putFeature(f, h);
      reuse.emitted({ m: 'feature', f, base, h });
      return f.id;
    },
    socket(input) {
      const base = socketId(input);
      const s: Socket = { ...input, id: ids.unique(base), rule: rule.id };
      const h = lanes.socketHash(s);
      putSocket(s, h);
      reuse.emitted({ m: 'socket', s, base, h });
      return s.id;
    },
    prop() {
      throw new Error(`out.prop ${DRESSING_ONLY}`);
    },
    actor() {
      throw new Error(`out.actor ${DRESSING_ONLY}`);
    },
  });

  runParts(rules, {
    parts: SHAPE_PARTS,
    ctx: { facts, plan, dressing: null, seed: base.world.seed },
    inherited: null,
    claims,
    trace,
    opts,
    makeOut,
    reuse,
    outPerRule: true,
  });

  // A structure's hash reads its cells and their neighbours (the columns within 1), the supports
  // carrying it and its own outputs: unchanged, the hash from an earlier resolve stands.
  const keys = contentKeys(facts);
  const k = regionKey();
  let supportsByCell: Map<CellKey, Support[]> | null = null;
  hashMemo.begin();
  for (const s of base.structures.values()) {
    keys.around(s.cells, 1, k, s.edges);
    k.a = mix(mix(k.a, s.id), lanes.laneA(s.id));
    k.b = mix(mix(k.b, s.id ^ 0x2d), lanes.laneB(s.id));
    if (base.supports.length) {
      if (!supportsByCell) {
        supportsByCell = new Map();
        for (const sup of base.supports) {
          const list = supportsByCell.get(sup.carries);
          if (list) list.push(sup);
          else supportsByCell.set(sup.carries, [sup]);
        }
      }
      for (const c of s.cells) {
        for (const sup of supportsByCell.get(c) ?? []) {
          k.a = mix(mix(mix(mix(mix(k.a, sup.carries), sup.bottomY), sup.against ?? -1), supportCode(sup.type)), sup.arcadeTo?.length ?? -1);
          k.b = mix(mix(mix(mix(mix(k.b, supportCode(sup.type)), sup.carries ^ 0x55), sup.bottomY), (sup.against ?? -1) + 11), sup.arcadeTo?.length ?? -1);
          for (const d of sup.arcadeTo ?? []) {
            k.a = mix(k.a, d);
            k.b = mix(k.b, d + 7);
          }
        }
      }
    }
    let h = hashMemo.get(s.id, k);
    if (h === undefined) hashMemo.put(s.id, k, (h = hashStructure(s, plan)));
    (s as { hash: number }).hash = h;
  }
  (plan as { hash: number }).hash = hashShape(plan);
  facts.attachShape(plan);
  return plan;
}

// ───────────────────────────────────────────────────────────── dressing ──

export interface DressingHooks {
  /** Builds the walking graph from the shape and the props placed so far. Runs before the life rules. */
  buildNav(shape: ShapePlan, draft: DressingDraft): NavGraph;
}

export function runDressingStage(
  shape: ShapePlan,
  rules: readonly Rule[],
  hooks: DressingHooks,
  opts: ResolveOptions = {},
): DressingPlan {
  if (!shape.facts.shapeReady) throw new Error('runDressingStage: the shape plan is not finished');
  const props: Prop[] = [];
  const actors: Actor[] = [];
  const sockets: Socket[] = [];
  const claims = new Map<Slot, string>();
  const trace: RuleTrace[] = [];
  const draft: { props: Prop[]; actors: Actor[]; sockets: Socket[]; nav: NavGraph | null } = {
    props,
    actors,
    sockets,
    nav: null,
  };
  const socketIds = new Ids(shape.sockets.map((s) => s.id));
  const itemIds = new Ids();
  const counters = new Map<AnyCandidate, number>();

  const nextItemId = (rule: Rule, c: AnyCandidate): string => {
    const n = counters.get(c) ?? 0;
    counters.set(c, n + 1);
    const id = `${itemBaseId(rule, c)}${n > 0 ? `#${n}` : ''}`;
    return itemIds.exact(
      id,
      `rule ${rule.id}: two candidates share anchor ${c.anchor}${c.key !== undefined ? ` and key '${c.key}'` : ''}; ` +
        `give each candidate a distinct key`,
    );
  };
  const checkAnchor = (at: Anchor | null, what: string): void => {
    if (!at) return;
    const need = 'socket' in at ? [at.socket] : 'from' in at ? [at.from, at.to] : [];
    for (const id of need) {
      if (!socketIds.has(id)) throw new Error(`${what}: anchor names socket '${id}', which no rule declared`);
    }
  };

  const makeOut = (rule: Rule, c: AnyCandidate): RuleOut => ({
    role() {
      throw new Error(`out.role ${SHAPE_ONLY}`);
    },
    tag() {
      throw new Error(`out.tag ${SHAPE_ONLY}`);
    },
    feature() {
      throw new Error(`out.feature ${SHAPE_ONLY}`);
    },
    socket(input) {
      const s: Socket = { ...input, id: socketIds.unique(socketId(input)), rule: rule.id };
      sockets.push(s);
      return s.id;
    },
    prop(input) {
      checkAnchor(input.at, `out.prop('${input.type}')`);
      const p = { ...input, id: nextItemId(rule, c), rule: rule.id, hash: 0 } as Prop;
      p.hash = hashItem(p);
      props.push(p);
      return p.id;
    },
    actor(input) {
      checkAnchor(input.at, `out.actor('${input.type}')`);
      const a = { ...input, id: nextItemId(rule, c), rule: rule.id, hash: 0 } as Actor;
      a.hash = hashItem(a);
      actors.push(a);
      return a.id;
    },
  });

  runParts(rules, {
    parts: DRESSING_PARTS,
    ctx: { facts: shape.facts, plan: shape, dressing: draft, seed: shape.world.seed },
    inherited: shape.claims,
    claims,
    trace,
    opts,
    makeOut,
    beforePart(part) {
      if (part === 'life') draft.nav = hooks.buildNav(shape, draft);
    },
  });

  const nav = draft.nav ?? hooks.buildNav(shape, draft);
  const plan: DressingPlan = { props, actors, sockets, nav, claims, trace, hash: 0 };
  (plan as { hash: number }).hash = hashDressing(plan);
  return plan;
}
