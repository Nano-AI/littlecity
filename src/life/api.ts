// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// Life: the only part of the game that reads the clock. Three things:
//
//   Signals     time of day, wind and events, read by anything that moves.
//               Implemented in src/life/signals.ts.
//   Behaviours  per-item motion for one prop or actor type.
//               src/life/**/*.behaviour.ts, discovered by glob.
//   Systems     town-wide motion that is not one item's business: landing
//               bounces, pop-in, the crowd. src/life/**/*.system.ts.
//
// Life never touches Three.js. It moves things through a LifeStage, which
// the renderer implements (src/render/api.ts, TownView.stage).

import type { CellKey } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import type { ActorType, PropType } from '@/core/vocab';
import type { MeshData } from '@/gen/mesh';
import type { Actor, ActorOf, DressingPlan, Prop, PropOf, ShapePlan, StructureId } from '@/resolve/plan';

// ────────────────────────────────────────────────────────────── signals ──

export type DayPart = 'day' | 'dusk' | 'night' | 'dawn';

export interface TimeSignal {
  /** Position in the dusk cycle, 0 ≤ phase < 1; 0 is the start of day. */
  phase: number;
  part: DayPart;
  isDay: boolean;
  isDusk: boolean;
  isNight: boolean;
  isDawn: boolean;
  /** Daylight, 1 by day to 0 at night, easing through dusk and dawn. */
  light: number;
  /** Life time in seconds since the town opened. Advances by clamped steps, so it never jumps. */
  seconds: number;
}

export interface Wind {
  /** Unit direction the wind blows toward. */
  dirX: number;
  dirZ: number;
  /** 0 calm to about 1 in a gust. */
  strength: number;
}

/**
 * Events anything may listen for. To add one: augment this interface from
 * your own file (`declare module '@/life/api' { interface SignalEvents {
 * bellRang: StructureId } }`) and emit it through the SignalsDriver.
 */
export interface SignalEvents {
  blockLanded: CellKey;
  blockRemoved: CellKey;
  personPassed: CellKey;
}
export type SignalEvent = keyof SignalEvents;

export interface Signals {
  readonly time: TimeSignal;
  /** Wind at a column, now. One town-wide direction that drifts; gusts cross the map as a front. */
  wind(x: number, z: number): Wind;
  /** Subscribes; returns the function that unsubscribes. */
  on<E extends SignalEvent>(event: E, fn: (payload: SignalEvents[E]) => void): () => void;
}

/** 'run' lets the cycle play; the others hold it at the middle of that part of the day. */
export type TimeHold = 'run' | DayPart;

/** The side of Signals the app drives. `createSignals(seed)` in src/life/signals.ts returns one. */
export interface SignalsDriver extends Signals {
  /**
   * Advances life time by `dt` seconds, clamped to TIME.maxStep (100 ms) so a
   * sleeping tab or a slow frame never teleports anything. Returns the step taken.
   */
  advance(dt: number): number;
  hold(mode: TimeHold): void;
  readonly holding: TimeHold;
  /** Jumps the cycle to a phase (screenshots, the time button). */
  setPhase(phase: number): void;
  emit<E extends SignalEvent>(event: E, payload: SignalEvents[E]): void;
}

// ──────────────────────────────────────────────────────────── the stage ──

/** One drawn thing life can move. */
export interface InstanceHandle {
  /** Its resting world frame (where the plan put it). */
  readonly base: Mat4Like;
  /** Sets its world matrix; it stays there until set again. */
  setMatrix(m: Mat4Like): void;
  setVisible(visible: boolean): void;
  /**
   * Four free numbers the shader gets per instance. By convention a = glow
   * (0 dark to 1 lit), b = flutter or sway phase; c and d are the part's own.
   */
  setParams(a: number, b?: number, c?: number, d?: number): void;
  /** For handles from spawn, spawnMesh and liftStructure: remove it / bake the structure back. */
  release(): void;
}

export type SpawnSpec =
  | { prop: PropType; variant?: string; params?: Record<string, number | string> }
  | { actor: ActorType; variant?: string; params?: Record<string, number | string> };

/** What life can do to the picture. Implemented by the renderer. */
export interface LifeStage {
  /** The instance drawn for a prop or actor of the current dressing plan, by item id. */
  instance(itemId: string): InstanceHandle | null;
  /** Draws an extra instance of a part (a smoke puff, a flock member, a dust ring). */
  spawn(part: SpawnSpec, at: Mat4Like): InstanceHandle;
  /** Draws an arbitrary mesh (a removed structure puffing away). */
  spawnMesh(mesh: MeshData, at: Mat4Like): InstanceHandle;
  /**
   * Takes a structure out of its baked chunk so it can be moved (landing
   * bounce, wobble). release() bakes it back. Null if the structure is not drawn.
   */
  liftStructure(id: StructureId): InstanceHandle | null;
  /** World frame of a socket of the current plans. */
  socket(id: string): Mat4Like | null;
}

// ─────────────────────────────────────────────────────────── behaviours ──

export interface LifeContext<I extends Prop | Actor = Prop | Actor> {
  /** The item this behaviour instance animates (the newest version of it). */
  item: I;
  /** Stable per item: hash(world seed, item id). */
  seed: number;
  /** Seeded per item. */
  rand(...parts: (number | string)[]): number;
  shape: ShapePlan;
  dressing: DressingPlan;
  /** The item's own drawn instance. */
  instance: InstanceHandle;
  stage: LifeStage;
}

interface BehaviourHooks<I extends Prop | Actor, S> {
  /** Called when an item with this type first appears. Returns the behaviour's state. */
  create(item: I, ctx: LifeContext<I>): S;
  /** Called every frame. `dt` is in seconds and never more than TIME.maxStep. */
  update(state: S, dt: number, signals: Signals, ctx: LifeContext<I>): void;
  /**
   * Called when the town changed and the item's id survived but its content
   * (hash) did not. State is kept either way; ctx.item is the new item.
   */
  changed?(state: S, ctx: LifeContext<I>): void;
  /** Called when the item is gone. Release anything spawned. */
  dispose?(state: S, ctx: LifeContext<I>): void;
}
export type PropBehaviourDef<T extends PropType, S> = { prop: T } & BehaviourHooks<PropOf<T>, S>;
export type ActorBehaviourDef<T extends ActorType, S> = { actor: T } & BehaviourHooks<ActorOf<T>, S>;

export interface Behaviour {
  readonly $type: 'behaviour';
  readonly category: 'prop' | 'actor';
  readonly type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly hooks: BehaviourHooks<any, any>;
}

/**
 * Motion for one prop or actor type. `export default` the result from a
 * `*.behaviour.ts` file. State survives re-resolves for as long as the
 * item's id does.
 *
 *   export default defineBehaviour({ actor: 'smoke',
 *     create(item, ctx) { return { puffs: [], next: 0 }; },
 *     update(state, dt, signals, ctx) { ... } });
 */
export function defineBehaviour<T extends PropType, S>(b: PropBehaviourDef<T, S>): Behaviour;
export function defineBehaviour<T extends ActorType, S>(b: ActorBehaviourDef<T, S>): Behaviour;
export function defineBehaviour(
  b: { prop?: string; actor?: string } & BehaviourHooks<any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
): Behaviour {
  const category = b.prop !== undefined ? 'prop' : 'actor';
  const type = b.prop ?? b.actor;
  if (!type) throw new Error('defineBehaviour: give one of prop or actor');
  return Object.freeze({
    $type: 'behaviour' as const,
    category,
    type,
    hooks: { create: b.create, update: b.update, changed: b.changed, dispose: b.dispose },
  });
}
export function isBehaviour(x: unknown): x is Behaviour {
  return typeof x === 'object' && x !== null && (x as { $type?: unknown }).$type === 'behaviour';
}

// ────────────────────────────────────────────────────────────── systems ──

export interface Town {
  shape: ShapePlan;
  /** Null between an edit and its dressing arriving. */
  dressing: DressingPlan | null;
}

export interface SystemContext {
  stage: LifeStage;
  signals: Signals;
  /** world.seed */
  seed: number;
}

export interface SystemDef<S> {
  /** Unique name: 'feedback.landing', 'people'. */
  id: string;
  /** Systems update in ascending order (default 0), then by id; all before behaviours. */
  order?: number;
  create(ctx: SystemContext): S;
  /**
   * Called whenever the town changes (a new shape, or its dressing arriving).
   * `prev` is the town before, null the first time. Diff hashes and ids here.
   */
  sync?(state: S, next: Town, prev: Town | null, ctx: SystemContext): void;
  update(state: S, dt: number, signals: Signals, ctx: SystemContext): void;
  dispose?(state: S, ctx: SystemContext): void;
}
export interface System extends SystemDef<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  readonly $type: 'system';
}

/** Town-wide motion. `export default` the result from a `*.system.ts` file. */
export function defineSystem<S>(s: SystemDef<S>): System {
  if (!s.id) throw new Error('defineSystem: a system needs an id');
  return Object.freeze({ ...s, $type: 'system' as const });
}
export function isSystem(x: unknown): x is System {
  return typeof x === 'object' && x !== null && (x as { $type?: unknown }).$type === 'system';
}

/** The life runtime the app drives. `createLife` in src/life/runtime.ts returns one. */
export interface LifeRuntime {
  /** Tell life the town changed. */
  sync(town: Town): void;
  /** Advance every system and behaviour. Call once per frame after signals.advance(). */
  update(dt: number): void;
  dispose(): void;
}
