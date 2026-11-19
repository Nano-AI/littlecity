// The town being played: the world, its terrain, undo history and the
// staged resolver, behind one small object. Owner: Interface.
//
// It has no DOM and no renderer in it. Whoever creates it says what
// "showing a town" means (main.ts: view.setTown, life.sync, the landing
// signal, autosave), so tests drive it with nothing but a callback.
//
// Every edit goes through canApply first (the world module decides what is
// legal; nothing here or in the UI does) and is one undo step, unless it is
// made between begin() and end(): a Shift-drag run undoes as one.

import type { Edit, EditResult, Terrain, World } from '@/core/world';
import type { ResolveOptions } from '@/resolve/index';
import type { DressingPlan, ShapePlan } from '@/resolve/plan';
import { createStagedResolver, type StagedResolver } from '@/resolve/staged';
import { canRedo, canUndo, createHistory, pushHistory, redo, undo, type History } from '@/world/history';
import { applyEdit, canApply } from '@/world/world';

export interface GameStart {
  world: World;
  terrain: Terrain;
  /** Passed to every resolve (a scenario's own rules). */
  resolve?: ResolveOptions;
}

export interface GameEvents {
  /**
   * The town to draw changed. `landed` is the edit that changed it (null for
   * undo, redo, a new island or a restyle). Called once at creation too.
   */
  show(shape: ShapePlan, landed: Edit | null): void;
  /** The world or the history changed: refresh buttons, schedule a save. */
  changed?(): void;
}

export interface Game {
  readonly world: World;
  readonly terrain: Terrain;
  /** The shape of the world as shown. */
  readonly shape: ShapePlan;
  /** Would this edit be legal now? */
  can(e: Edit): EditResult;
  /** Applies the edit if it is legal and shows the result. */
  edit(e: Edit): EditResult;
  /** Opens a batch: the edits until end() are one undo step. */
  begin(): void;
  end(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  undo(): boolean;
  redo(): boolean;
  /** A what-if shape for the ghost preview. Changes nothing. */
  preview(world: World): ShapePlan;
  /** Once per frame: the dressing for the newest world when it is ready, else null. */
  poll(): { shape: ShapePlan; dressing: DressingPlan } | null;
  /** A different town altogether (new island, a loaded town): history starts over. */
  restart(start: GameStart): void;
  /** Resolves and shows the same world again (style values changed). */
  refresh(): void;
}

export function createGame(start: GameStart, events: GameEvents): Game {
  let terrain = start.terrain;
  let resolver: StagedResolver = createStagedResolver(terrain, start.resolve ?? {});
  let history: History = createHistory(start.world);
  let world = start.world;
  let shape: ShapePlan;
  /** The world when the open batch began, or null. */
  let batch: World | null = null;

  const show = (next: World, landed: Edit | null): void => {
    world = next;
    shape = resolver.update(world);
    events.show(shape, landed);
    events.changed?.();
  };

  const closeBatch = (): void => {
    if (batch === null) return;
    batch = null;
    if (world !== history.present) {
      history = pushHistory(history, world);
      events.changed?.();
    }
  };

  const step = (next: History): boolean => {
    if (next === history) return false;
    history = next;
    show(history.present, null);
    return true;
  };

  shape = resolver.update(world);
  events.show(shape, null);
  events.changed?.();

  return {
    get world() {
      return world;
    },
    get terrain() {
      return terrain;
    },
    get shape() {
      return shape;
    },
    can: (e) => canApply(world, terrain, e),
    edit(e) {
      const verdict = canApply(world, terrain, e);
      if (!verdict.ok) return verdict;
      const next = applyEdit(world, terrain, e);
      if (batch === null) history = pushHistory(history, next);
      show(next, e);
      return verdict;
    },
    begin() {
      closeBatch();
      batch = world;
    },
    end: closeBatch,
    get canUndo() {
      return batch === null && canUndo(history);
    },
    get canRedo() {
      return batch === null && canRedo(history);
    },
    undo: () => batch === null && canUndo(history) && step(undo(history)),
    redo: () => batch === null && canRedo(history) && step(redo(history)),
    preview: (w) => resolver.preview(w),
    poll: () => resolver.poll(),
    restart(next) {
      batch = null;
      terrain = next.terrain;
      resolver = createStagedResolver(terrain, next.resolve ?? {});
      history = createHistory(next.world);
      show(next.world, null);
    },
    refresh() {
      show(world, null);
    },
  };
}
