// Reusing work from earlier resolves (Polish). Two things live here:
//
//  - OutputLanes: a running 64-bit digest of everything the shape rules have
//    emitted onto each structure so far (role, tags, features with their
//    owned sockets, the structure's own sockets), updated as they emit.
//  - LocalMemo: for a rule marked `local` (see RuleDef.local), the output of
//    apply() for each candidate, keyed by everything apply may read: the
//    content of the columns around the candidate's structure and its block
//    neighbours, their outputs so far, the candidate itself and the style
//    version. A candidate whose key is unchanged replays the recorded output
//    instead of calling apply(); the plan comes out identical (ids included).
//
// Both keys are content hashes in two independent 32-bit lanes. The
// equivalence test (src/resolve/incremental.test.ts) plays hundreds of random
// edits and compares every plan with a from-scratch resolve.

import { columnIndex, keyX, keyZ, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { styleVersion } from '@/core/style';
import type { Role, Tag } from '@/core/vocab';
import { contentKeys, memosOn, regionKey, type RegionKey } from '../facts/content-keys.fact';
import type { Facts } from '../facts/api';
import type { Feature, Socket, StructureId } from '../plan';
import type { Candidate, Rule, RuleContext, RuleOut } from './api';

function mix(h: number, k: number): number {
  k = Math.imul(k | 0, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  h ^= k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}
function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h | 0;
}
function mixString(h: number, s: string): number {
  h = mix(h, s.length);
  for (let i = 0; i < s.length; i++) h = mix(h, s.charCodeAt(i));
  return h;
}
/** Folds any plain value (number, string, boolean, undefined, array, plain object) into a lane. */
function mixValue(h: number, v: unknown): number {
  switch (typeof v) {
    case 'number':
      if (Number.isInteger(v) && v >= -0x80000000 && v <= 0x7fffffff) return mix(mix(h, 1), v);
      return mixString(mix(h, 2), String(v));
    case 'string':
      return mixString(mix(h, 3), v);
    case 'boolean':
      return mix(mix(h, 4), v ? 1 : 0);
    case 'undefined':
      return mix(h, 5);
    case 'object': {
      if (v === null) return mix(h, 6);
      if (Array.isArray(v)) {
        h = mix(mix(h, 7), v.length);
        for (const x of v) h = mixValue(h, x);
        return h;
      }
      const rec = v as Record<string, unknown>;
      const keys = Object.keys(rec).sort();
      h = mix(mix(h, 8), keys.length);
      for (const k of keys) h = mixValue(mixString(h, k), rec[k]);
      return h;
    }
    default:
      return mixString(mix(h, 9), String(v));
  }
}

const SEED_A = 0x1f83d9ab;
const SEED_B = 0x5be0cd19;

export interface Lane {
  a: number;
  b: number;
}

const codes = new Map<string, Lane>();
/** Two-lane code of a string that recurs (types, variants, rule ids), remembered. */
function codeOf(str: string | undefined): Lane {
  if (str === undefined) return NO_CODE;
  let c = codes.get(str);
  if (!c) {
    if (codes.size > 1 << 16) codes.clear();
    codes.set(str, (c = { a: fmix(mixString(SEED_A, str)), b: fmix(mixString(SEED_B ^ 0x3a, str)) }));
  }
  return c;
}
const NO_CODE: Lane = { a: 0x51ed270b, b: 0x2c1b3c6d };
const EMPTY_LANE: Lane = { a: SEED_A, b: SEED_B };

/** Running digests of what the shape rules emitted onto each structure. */
export class OutputLanes {
  private lanes = new Map<StructureId, Lane>();
  /** Feature id → its structure, so an owned socket counts for that structure. */
  private owner = new Map<string, StructureId>();
  /** Sockets with neither a structure nor an owning feature: they count for everyone. */
  private orphan: Lane = { a: SEED_A, b: SEED_B };

  private lane(s: StructureId): Lane {
    let l = this.lanes.get(s);
    if (!l) this.lanes.set(s, (l = { a: SEED_A, b: SEED_B }));
    return l;
  }
  private str(l: Lane, str: string | undefined, fresh: boolean): void {
    if (str === undefined) {
      l.a = mix(l.a, 0x7f);
      l.b = mix(l.b, 0x7e);
    } else if (fresh) {
      // Ids are new strings every resolve: hash them in place.
      let a = mix(l.a, str.length);
      let b = mix(l.b, str.length ^ 0x99);
      for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        a = mix(a, ch);
        b = mix(b, ch ^ 0x5a5a);
      }
      l.a = a;
      l.b = b;
    } else {
      const c = codeOf(str);
      l.a = mix(l.a, c.a);
      l.b = mix(l.b, c.b);
    }
  }
  private num(l: Lane, n: number | undefined): void {
    const v = n === undefined ? -0x7ffffff1 : n | 0;
    if (n !== undefined && v !== n) {
      this.str(l, String(n), true);
      return;
    }
    l.a = mix(l.a, v);
    l.b = mix(l.b, v ^ 0x6b43a9b5);
  }
  private obj(l: Lane, o: object | undefined): void {
    if (o === undefined) return this.num(l, undefined);
    l.a = mixValue(mix(l.a, 0x0b), o);
    l.b = mixValue(mix(l.b, 0x0c), o);
  }

  role(s: StructureId, role: Role, rule: string): void {
    const l = this.lane(s);
    this.num(l, 1);
    this.str(l, role, false);
    this.str(l, rule, false);
  }
  tag(s: StructureId, tag: Tag): void {
    const l = this.lane(s);
    this.num(l, 2);
    this.str(l, tag, false);
  }
  /** A feature's contribution to its structure's lanes, worked out from scratch. */
  featureHash(f: Feature): Lane {
    const l = { a: SEED_A, b: SEED_B };
    this.num(l, 3);
    this.str(l, f.id, true);
    this.str(l, f.type, false);
    this.num(l, f.cell);
    this.num(l, f.dir);
    this.num(l, f.edge);
    this.num(l, f.region);
    this.str(l, f.variant, false);
    this.obj(l, f.params);
    this.str(l, f.rule, false);
    return l;
  }
  /** Folds a feature into its structure's lanes (`h` from featureHash, maybe remembered). */
  feature(f: Feature, h: Lane): void {
    this.owner.set(f.id, f.structure);
    const l = this.lane(f.structure);
    l.a = mix(l.a, h.a);
    l.b = mix(l.b, h.b);
  }
  socketHash(s: Socket): Lane {
    const l = { a: SEED_A, b: SEED_B };
    this.num(l, 4);
    this.str(l, s.id, true);
    this.str(l, s.type, false);
    this.num(l, s.cell);
    this.num(l, s.dir);
    this.num(l, s.structure);
    this.str(l, s.owner, true);
    this.str(l, s.name, false);
    this.str(l, s.rule, false);
    return l;
  }
  socket(s: Socket, h: Lane): void {
    const at = (s.owner !== undefined ? this.owner.get(s.owner) : undefined) ?? s.structure;
    const l = at === undefined ? this.orphan : this.lane(at);
    l.a = mix(l.a, h.a);
    l.b = mix(l.b, h.b);
  }
  get orphanA(): number {
    return this.orphan.a;
  }
  get orphanB(): number {
    return this.orphan.b;
  }
  /** A structure's lanes now (do not keep: they change as rules emit). */
  of(s: StructureId): Lane {
    return this.lanes.get(s) ?? EMPTY_LANE;
  }
  laneA(s: StructureId): number {
    return this.lanes.get(s)?.a ?? SEED_A;
  }
  laneB(s: StructureId): number {
    return this.lanes.get(s)?.b ?? SEED_B;
  }
}

// ─────────────────────────────────────────────────────────── local rules ──

type Call =
  | { m: 'role'; s: StructureId; role: Role }
  | { m: 'tag'; s: StructureId; tag: Tag }
  | { m: 'feature'; f: Feature; base: string; h: Lane }
  | { m: 'socket'; s: Socket; base: string; h: Lane };

interface Entry {
  a: number;
  b: number;
  calls: Call[];
  /** Some id was renamed (`~2`) when recorded. */
  renamed: boolean;
}

/** What the engine gives the reuse: its id set and a way to put a remembered item back in the plan. */
export interface ShapeEmitter {
  hasId(id: string): boolean;
  /** Adds an item recorded earlier, as is: its id is free (checked), its lanes contribution is `h`. */
  putFeature(f: Feature, h: Lane): void;
  putSocket(s: Socket, h: Lane): void;
}

/** Per rule: the last two resolves' recorded outputs, by candidate. */
class RuleMemo {
  cur = new Map<string, Entry>();
  prev = new Map<string, Entry>();
  prev2 = new Map<string, Entry>();
  begin(): void {
    this.prev2 = this.prev;
    this.prev = this.cur;
    this.cur = new Map();
  }
  get(k: string, a: number, b: number): Entry | undefined {
    let e = this.prev.get(k);
    if (!e || e.a !== a || e.b !== b) e = this.prev2.get(k);
    if (!e || e.a !== a || e.b !== b) return undefined;
    this.cur.set(k, e);
    return e;
  }
}

const memos = new WeakMap<Rule, RuleMemo>();

interface FindEntry {
  a: number;
  b: number;
  found: Candidate<unknown>[];
}
/** Per rule with findEach: the last two resolves' candidates, by structure. */
class FindMemo {
  cur = new Map<string, FindEntry>();
  prev = new Map<string, FindEntry>();
  prev2 = new Map<string, FindEntry>();
  begin(): void {
    this.prev2 = this.prev;
    this.prev = this.cur;
    this.cur = new Map();
  }
  get(k: string, a: number, b: number): Candidate<unknown>[] | undefined {
    let e = this.prev.get(k);
    if (!e || e.a !== a || e.b !== b) e = this.prev2.get(k);
    if (!e || e.a !== a || e.b !== b) return undefined;
    this.cur.set(k, e);
    return e.found;
  }
}
const findMemos = new WeakMap<Rule, FindMemo>();
interface Box {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
function growBox(box: Box, c: CellKey): void {
  const x = keyX(c), z = keyZ(c);
  if (x < box.x0) box.x0 = x;
  if (x > box.x1) box.x1 = x;
  if (z < box.z0) box.z0 = z;
  if (z > box.z1) box.z1 = z;
}

interface Scope {
  a: number;
  b: number;
  /** Block structures with a cell within reach (in column scan order), without the structure itself. */
  near: StructureId[];
}

/**
 * One shape resolve's reuse state: output lanes, the column index of block
 * structures, and scopes per structure and reach.
 */
export class ShapeReuse {
  private byColumn: (StructureId[] | undefined)[] | null = null;
  private scopes = new Map<number, Scope>();
  private boxes = new Map<StructureId, Box>();
  private readonly k: RegionKey = regionKey();
  private readonly style = styleVersion();
  /** Set while a local rule's candidate runs: the engine reports each item it emits here. */
  private recording: Call[] | null = null;

  constructor(
    private readonly facts: Facts,
    readonly lanes: OutputLanes,
    private readonly emitter: ShapeEmitter,
  ) {}

  /** The engine emitted an item (base = its id before any `~2` renaming). */
  emitted(call: Call): void {
    this.recording?.push(call);
  }

  private columns(): (StructureId[] | undefined)[] {
    if (this.byColumn) return this.byColumn;
    const cols: (StructureId[] | undefined)[] = new Array(SIZE_X * SIZE_Z);
    for (const [c, id] of this.facts.structureAt) {
      const i = columnIndex(keyX(c), keyZ(c));
      const list = cols[i];
      if (!list) cols[i] = [id];
      else if (!list.includes(id)) list.push(id);
    }
    return (this.byColumn = cols);
  }

  /** A structure's bounding columns (cells, and both sides of its edge pieces). */
  private boxOf(s: StructureId): Box {
    let box = this.boxes.get(s);
    if (box) return box;
    box = { x0: 99, z0: 99, x1: -1, z1: -1 };
    const st = this.facts.structures.get(s)!;
    for (const c of st.cells) growBox(box, c);
    for (const e of st.edges) {
      growBox(box, e >> 1);
      growBox(box, (e >> 1) + (e & 1 ? 64 : 1));
    }
    this.boxes.set(s, box);
    return box;
  }

  private scope(s: StructureId, reach: number): Scope {
    const sk = s * 16 + reach;
    let sc = this.scopes.get(sk);
    if (sc) return sc;
    const own = this.boxOf(s);
    const box = { ...own };
    const cols = this.columns();
    // In column scan order: the same content gives the same order.
    const near: StructureId[] = [];
    for (let z = Math.max(0, own.z0 - reach); z <= Math.min(SIZE_Z - 1, own.z1 + reach); z++) {
      for (let x = Math.max(0, own.x0 - reach); x <= Math.min(SIZE_X - 1, own.x1 + reach); x++) {
        const list = cols[columnIndex(x, z)];
        if (!list) continue;
        for (const id of list) {
          if (id === s || near.includes(id)) continue;
          near.push(id);
          // The key covers every near structure whole (its facts read all of it).
          const nb = this.boxOf(id);
          if (nb.x0 < box.x0) box.x0 = nb.x0;
          if (nb.x1 > box.x1) box.x1 = nb.x1;
          if (nb.z0 < box.z0) box.z0 = nb.z0;
          if (nb.z1 > box.z1) box.z1 = nb.z1;
        }
      }
    }
    const k = contentKeys(this.facts).region(box.x0 - reach, box.z0 - reach, box.x1 + reach, box.z1 + reach, this.k);
    sc = { a: k.a, b: k.b, near };
    this.scopes.set(sk, sc);
    return sc;
  }

  /** Everything a local rule may read about structure `s` now, as two lanes (RuleDef.local). */
  private keyFor(rule: Rule, s: StructureId, ctx: RuleContext, salt: number): { a: number; b: number } {
    const sc = this.scope(s, rule.local!);
    const L = this.lanes;
    const own = L.of(s);
    let a = mix(mix(mix(mix(sc.a, salt), this.style), s), own.a);
    let b = mix(mix(mix(mix(sc.b, salt), this.style), s), own.b);
    for (const id of sc.near) {
      const l = L.of(id);
      a = mix(a, l.a);
      b = mix(b, l.b);
    }
    if (rule.localAlso) {
      const also = rule.localAlso(ctx, s);
      a = mix(a, also);
      b = mix(b, also ^ 0x3c6ef372);
    }
    return { a: fmix(mix(a, L.orphanA)), b: fmix(mix(b, L.orphanB)) };
  }

  /**
   * find() for a rule with `findEach`: each structure's candidates are kept
   * across resolves like apply's output, and found again only when
   * something they may depend on changed.
   */
  find(rule: Rule, ctx: RuleContext): Candidate<unknown>[] {
    const each = rule.findEach!;
    let memo = findMemos.get(rule);
    if (!memo) findMemos.set(rule, (memo = new FindMemo()));
    memo.begin();
    const out: Candidate<unknown>[] = [];
    for (const st of each.over(ctx)) {
      const { a, b } = this.keyFor(rule, st.id, ctx, 0x0f1d);
      const key = String(st.id);
      let found = memo.get(key, a, b);
      if (!found) {
        found = each.find(ctx, st) as Candidate<unknown>[];
        memo.cur.set(key, { a, b, found });
      }
      for (const c of found) out.push(c);
    }
    return out;
  }

  /**
   * Applies a local rule's candidate: replays its recorded output if every
   * input it may read is unchanged, else calls apply and records it.
   */
  apply(rule: Rule, c: Candidate<unknown>, ctx: RuleContext, out: RuleOut, run: (out: RuleOut) => void): void {
    if (!memosOn() || rule.local === undefined || c.structure === undefined) return run(out);
    let memo = memos.get(rule);
    if (!memo) memos.set(rule, (memo = new RuleMemo()));
    const { a, b } = this.keyFor(rule, c.structure, ctx, 0x0a99);
    const key = c.key === undefined ? `${c.anchor}` : `${c.anchor}:${typeof c.key}:${c.key}`;
    const hit = memo.get(key, a, b);
    if (hit && this.canReplay(hit)) {
      for (const call of hit.calls) {
        if (call.m === 'role') out.role(call.s, call.role);
        else if (call.m === 'tag') out.tag(call.s, call.tag);
        else if (call.m === 'feature') this.emitter.putFeature(call.f, call.h);
        else this.emitter.putSocket(call.s, call.h);
      }
      return;
    }
    const calls: Call[] = [];
    this.recording = calls;
    try {
      run(out);
    } finally {
      this.recording = null;
    }
    const renamed = calls.some((x) => (x.m === 'feature' ? x.f.id !== x.base : x.m === 'socket' && x.s.id !== x.base));
    memo.cur.set(key, { a, b, calls, renamed });
  }

  /** A replay hands out the very ids recorded (the engine's `~2` renaming included). */
  private canReplay(entry: Entry): boolean {
    const calls = entry.calls;
    if (!entry.renamed) {
      // Recorded ids are their bases and distinct: they come back as long as none is taken.
      for (const call of calls) {
        if (call.m === 'feature' ? this.emitter.hasId(call.f.id) : call.m === 'socket' && this.emitter.hasId(call.s.id)) return false;
      }
      return true;
    }
    let taken: Set<string> | null = null;
    for (const call of calls) {
      if (call.m !== 'feature' && call.m !== 'socket') continue;
      const want = call.m === 'feature' ? call.f.id : call.s.id;
      let id = call.base;
      for (let n = 2; this.emitter.hasId(id) || taken?.has(id); n++) id = `${call.base}~${n}`;
      if (id !== want) return false;
      (taken ??= new Set()).add(id);
    }
    return true;
  }

  /** Starts a rule's run: rotates its memo generations. */
  beginRule(rule: Rule): void {
    if (!memosOn() || rule.local === undefined) return;
    let memo = memos.get(rule);
    if (!memo) memos.set(rule, (memo = new RuleMemo()));
    memo.begin();
  }
}
