// Everything the player touches, put together (design section 7).
// Owner: Interface.
//
//   ☰                                   ☀ ↶ ↷
//                 (the town)
//   [Build][Ground][Nature][Tools]
//   [ the open drawer's pieces …        ] ● colour
//
// createInterface() builds the DOM over the canvas, reads the pointer and
// the keyboard, and turns them into edits on the Game. It never decides
// whether an edit is legal: it asks (game.edit → canApply) and shows the
// refusal. The view is used only through TownView.

import { edgeOf, keyY, NO_CELL, type CellKey } from '@/core/grid';
import type { Edit, World } from '@/core/world';
import type { TimeHold } from '@/life/api';
import type { Ghost, TownView } from '@/render/api';
import type { Game } from '@/app/game';
import { lineCells, planErase, planUse, type ActionContext, type Plan, type ToolState } from './actions';
import { el, iconButton, installTheme, setIcon } from './dom';
import { createFeedback, wiggle, type Feedback } from './feedback';
import { createGrowth, onlyStartingTrees, type Growth } from './growth';
import { growTown } from '@/townmaker/index';
import { copyText, download, downloadTown, makePostcard, readTownFile, shareLink } from './files';
import type { GestureSink } from './gestures';
import { ghostFor, ghostForRun } from './ghost';
import { clampLength, createScrollSteps, growthOf, planRun, type Run } from './length';
import { createMarkers } from './markers';
import { createMenu } from './menu';
import { faceZone, pickCell, type Pick } from './pick';
import { DRAWER_IDS, drawerItems, isToolId, paintsRuns, type DrawerId, type ItemId } from './pieces';
import { attachPointer } from './pointer';
import { createStepper } from './stepper';
import { createTray, type Tray } from './tray';
import { createTuningPanel } from './tuning';
import { INPUT } from '@/style/input';

export interface InterfaceHost {
  view: TownView;
  game: Game;
  /** The time-of-day control (the signals driver). */
  time: { readonly holding: TimeHold; hold(mode: TimeHold): void };
  /** Draws a frame right now (the postcard copies the canvas straight after). */
  renderNow(): void;
  /** A fresh island, already confirmed by the player. */
  newIsland(): void;
  /** Replaces the town with one read from a file. */
  openTown(world: World): void;
  /** Where the interface's elements go. Default: document.body. */
  parent?: HTMLElement;
}

export interface Interface {
  readonly el: HTMLElement;
  readonly tray: Tray;
  readonly feedback: Feedback;
  /** Grow a town (design section 15a): the playing growth, if any. */
  readonly growth: Growth;
  /** Call once per frame, after the town has been drawn. */
  frame(): void;
  /** The world or the history changed: refresh the buttons and the ghost. */
  sync(): void;
  /** What the interface is showing, for browser tests and the console. */
  debug(): {
    item: ItemId;
    drawer: DrawerId;
    swatch: number | 'auto';
    time: TimeHold;
    ghost: GhostSummary | null;
    markers: CellKey[];
    sound: boolean;
    /** The held piece's length, or null when the selected item has none. */
    length: number | null;
    /** How many cells of the held run the ghost shows (null when there is no run on show). */
    run: number | null;
  };
  dispose(): void;
}

export interface GhostSummary {
  show: number[];
  shimmer: CellKey[];
  refuse: CellKey | null;
}

const TIME_ORDER: readonly TimeHold[] = ['run', 'day', 'dusk', 'night'];
const TIME_LABEL: Record<TimeHold, string> = {
  run: 'Time of day: passing. Press to hold the day',
  day: 'Holding day. Press for dusk',
  dusk: 'Holding dusk. Press for night',
  night: 'Holding night. Press to let time pass',
  dawn: 'Holding dawn. Press to let time pass',
};
const SOUND_KEY = 'little-city.sound';

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function createInterface(host: InterfaceHost): Interface {
  const { view, game } = host;
  const canvas = view.canvas;
  installTheme();

  // ── the pieces of the interface ────────────────────────────────────────
  const root = el('div', { class: 'lc-ui', attrs: { 'data-ui': 'root' } });
  const tray = createTray();
  const markers = createMarkers(view);
  const feedback = createFeedback(root);
  const count = el('div', { class: 'lc-count', attrs: { 'data-ui': 'run-count', 'aria-hidden': 'true', hidden: '' } });
  let sound = readSound();
  let tuning: HTMLElement | null = null;

  // ── grow a town (design section 15a) ───────────────────────────────────
  let growingNote: (() => void) | null = null;
  const growth = createGrowth(game, {
    onDone() {
      growingNote?.();
      growingNote = null;
      api.sync();
    },
  });
  const grow = (): void => {
    growth.stop();
    setGhost(null, '');
    growth.start(growTown(game.terrain, game.world.seed));
    if (growth.active) growingNote = feedback.banner('A town is growing.', [{ label: 'Finish now', primary: true, run: () => growth.skip() }]);
  };

  const menu = createMenu({
    growTown: grow,
    growNewIsland() {
      growth.stop();
      host.newIsland();
      grow();
    },
    hasTown: () => !onlyStartingTrees(game.world, game.terrain),
    newIsland: () => {
      growth.stop();
      host.newIsland();
    },
    shareLink: () => void share(),
    postcard: () => void postcard(),
    downloadTown: () => downloadTown(game.world),
    openTownFile: (file) => void openFile(file),
    sound: () => sound,
    setSound(on) {
      sound = on;
      try {
        localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
      } catch {
        // No storage: the choice lasts until the page closes.
      }
      // Sound itself arrives in a later stage; it listens for this.
      window.dispatchEvent(new CustomEvent('lc:sound', { detail: on }));
    },
    toggleTuning: () => toggleTuning(),
  });
  const toggleTuning = (): void => {
    if (tuning) {
      tuning.remove();
      tuning = null;
      return;
    }
    tuning = createTuningPanel(() => game.refresh(), { open: ['input'], onClose: toggleTuning });
    root.append(tuning);
  };

  const timeButton = iconButton('time-run', 'Time of day', { class: 'lc-round', attrs: { 'data-ui': 'time' } });
  const undoButton = iconButton('undo', 'Undo', { class: 'lc-round', title: 'Undo (⌘Z)', attrs: { 'data-ui': 'undo' } });
  const redoButton = iconButton('redo', 'Redo', { class: 'lc-round', title: 'Redo (⇧⌘Z)', attrs: { 'data-ui': 'redo' } });
  root.append(
    markers.el,
    el('div', { class: 'lc-card lc-corner lc-corner-left' }, [menu.button]),
    el('div', { class: 'lc-card lc-corner lc-corner-right' }, [timeButton, undoButton, redoButton]),
    tray.el,
    count,
    menu.el,
    menu.file,
    feedback.el,
  );
  const slots = Math.max(...DRAWER_IDS.map((d) => drawerItems(d).length));
  tray.el.style.setProperty('--lc-slots', String(slots));
  (host.parent ?? document.body).append(root);

  // ── time, undo, redo ───────────────────────────────────────────────────
  const showTime = (): void => {
    const mode = host.time.holding;
    setIcon(timeButton, `time-${mode === 'dawn' ? 'run' : mode}`);
    timeButton.title = TIME_LABEL[mode];
    timeButton.setAttribute('aria-label', TIME_LABEL[mode]);
    timeButton.setAttribute('data-time', mode);
  };
  timeButton.addEventListener('click', () => {
    const next = TIME_ORDER[(TIME_ORDER.indexOf(host.time.holding) + 1) % TIME_ORDER.length]!;
    host.time.hold(next);
    showTime();
  });
  undoButton.addEventListener('click', () => game.undo());
  redoButton.addEventListener('click', () => game.redo());

  // ── acting on the town ─────────────────────────────────────────────────
  const tool = (): ToolState => ({ item: tray.state.item, swatch: tray.state.swatch });

  const look = (x: number, y: number, world: World = game.world): { pick: Pick; ctx: ActionContext } | null => {
    const ray = view.screenToRay(x, y);
    const pick = pickCell(ray, world, game.terrain);
    return pick ? { pick, ctx: { world: game.world, terrain: game.terrain, kinds: game.shape.kinds, rayDir: ray.dir } } : null;
  };

  const refuse = (reason: string, x: number, y: number): void => {
    const r = canvas.getBoundingClientRect();
    feedback.refuse(reason, x + r.left, y + r.top);
    tray.shake();
  };

  /** Tries the plan's edits in order; shows the refusal if none is legal. */
  const perform = (plan: Plan, x: number, y: number): boolean => {
    if (plan.tries.length === 0) {
      if (plan.wiggle) {
        const structure = game.shape.structureAt.get(plan.at);
        if (structure !== undefined) wiggle(view.stage, structure, plan.at);
      } else if (plan.refusal) refuse(plan.refusal, x, y);
      return false;
    }
    let reason = '';
    for (const edit of plan.tries) {
      const verdict = game.edit(edit);
      if (verdict.ok) return true;
      reason ||= verdict.reason;
    }
    refuse(reason, x, y);
    return false;
  };

  // ── the ghost (mouse only) ─────────────────────────────────────────────
  let hoverAt: { x: number; y: number } | null = null;
  let ghostKey = '';
  let ghost: Ghost | null = null;
  let worldVersion = 0;

  const setGhost = (next: Ghost | null, key: string): void => {
    ghostKey = key;
    if (next === null && ghost === null) return;
    ghost = next;
    view.setGhost(next);
  };

  /** The run on show under the mouse, while a piece is held longer than 1. */
  let shownRun: Run | null = null;

  const showCount = (): void => {
    const n = shownRun?.edits.length ?? 0;
    count.toggleAttribute('hidden', !hoverAt || n === 0);
    if (!hoverAt || n === 0) return;
    const length = heldLength();
    count.textContent = n < (length ?? 0) ? `${n} of ${length}` : String(n);
    const r = canvas.getBoundingClientRect();
    count.style.transform = `translate(${Math.round(hoverAt.x + r.left + 16)}px, ${Math.round(hoverAt.y + r.top + 14)}px)`;
  };

  const updateGhost = (): void => {
    if (placingRun) return;
    if (growth.active) return setGhost(null, '');
    const ghostOf = (): void => {
      if (!hoverAt || isToolId(tray.state.item)) return setGhost(null, '');
      const seen = look(hoverAt.x, hoverAt.y);
      if (!seen) return setGhost(null, '');
      const length = heldLength();
      if (length !== null && length > 1) {
        // A held run: worked out again only when the target, the direction, the length or the piece changes.
        const run = planRun(tool(), seen.pick, seen.ctx, length);
        shownRun = run;
        const key = `${worldVersion}|${tray.state.item}|${tray.state.swatch}|${length}|${run.at}|${run.dir}|${JSON.stringify(run.edits[0] ?? run.refusal)}`;
        if (key === ghostKey) return;
        return setGhost(ghostForRun(run, game), key);
      }
      const plan = planUse(tool(), seen.pick, seen.ctx);
      // The same piece on the same target in the same world: nothing to work out again.
      const key = `${worldVersion}|${tray.state.item}|${tray.state.swatch}|${plan.at}|${JSON.stringify(plan.tries[0] ?? plan.refusal ?? null)}`;
      if (key === ghostKey) return;
      setGhost(ghostFor(plan, game), key);
    };
    shownRun = null;
    ghostOf();
    showCount();
  };

  // ── held length (design section 7) ─────────────────────────────────────
  /** Length per piece, for this session; every piece starts at 1. */
  const lengths = new Map<ItemId, number>();
  const heldLength = (): number | null => (growthOf(tray.state.item) === null ? null : (lengths.get(tray.state.item) ?? 1));
  const stepper = createStepper((by) => changeLength(by));
  tray.el.append(stepper.el);
  const scrollSteps = createScrollSteps();
  /** True while a run is being placed: the ghost waits until it is all down. */
  let placingRun = false;

  const changeLength = (by: number): void => {
    const length = heldLength();
    if (length === null) return;
    const next = clampLength(length + by);
    if (next === length) return;
    lengths.set(tray.state.item, next);
    stepper.show(next);
    updateGhost();
  };

  /** A plain scroll: changes the length when a piece with one is held over a valid target; otherwise it zooms. */
  const scrollLength = (dy: number, notch: boolean, x: number, y: number): boolean => {
    if (heldLength() === null) return false;
    const seen = look(x, y);
    if (!seen || !planUse(tool(), seen.pick, seen.ctx).tries.some((e) => game.can(e).ok)) {
      scrollSteps.reset();
      return false;
    }
    const steps = scrollSteps.feed(dy, notch);
    if (steps !== 0) changeLength(steps);
    return true;
  };

  /** A click with a piece held longer than 1: the part of the run that fits, as one undo step. */
  const placeRun = (x: number, y: number, seen: { pick: Pick; ctx: ActionContext }, length: number): void => {
    const run = planRun(tool(), seen.pick, seen.ctx, length);
    if (run.edits.length === 0) {
      if (run.refusal) refuse(run.refusal, x, y);
      return;
    }
    placingRun = true;
    game.begin();
    try {
      for (const edit of run.edits) if (!game.edit(edit).ok) break;
    } finally {
      game.end();
      placingRun = false;
    }
    if (hoverAt) updateGhost();
  };

  // ── Shift-drag: paint a run (floors, fences, walls, marble) ────────────
  let run: {
    /** The world when the run began: later samples are picked against it, so new pieces do not get in the way. */
    world0: World;
    level: number;
    first: Edit;
    last: CellKey;
    /** The first cell's colour, used for the rest of the run. */
    color: number | 'auto';
    done: Set<number>;
  } | null = null;

  const runStep = (x: number, y: number): void => {
    if (!run) return;
    const seen = look(x, y, run.world0);
    if (!seen) return;
    const first = run.first;
    if (first.type === 'placeEdge') {
      const side = faceZone(seen.pick);
      if (side === null || seen.pick.target === NO_CELL || keyY(seen.pick.target) !== run.level) return;
      const edge = edgeOf(seen.pick.target, side);
      if (edge === NO_CELL || run.done.has(edge)) return;
      run.done.add(edge);
      game.edit({ type: 'placeEdge', edge, kind: first.kind });
      return;
    }
    const sample = planUse(tool(), seen.pick, { ...seen.ctx, world: run.world0 }).tries[0];
    const cell = sample && 'cell' in sample ? sample.cell : NO_CELL;
    if (cell === NO_CELL || cell === run.last || keyY(cell) !== run.level) return;
    for (const c of lineCells(run.last, cell)) {
      if (run.done.has(c)) continue;
      run.done.add(c);
      if (first.type === 'placeFloor') game.edit({ type: 'placeFloor', cell: c, floor: first.floor });
      else if (first.type === 'placeBlock') game.edit({ type: 'placeBlock', cell: c, kind: first.kind, color: run.color, from: null });
    }
    run.last = cell;
  };

  // ── the pointer ────────────────────────────────────────────────────────
  /** A press on the town while a pop-up is open only closes it: that click builds nothing. */
  let dismissing = false;
  const closePopups = (): boolean => {
    const menuWasOpen = menu.isOpen;
    menu.close();
    return tray.closePopups() || menuWasOpen;
  };
  const onCanvasDown = (): void => {
    dismissing = closePopups();
  };
  canvas.addEventListener('pointerdown', onCanvasDown, { capture: true });

  const sink: GestureSink = {
    use(x, y) {
      if (dismissing) return;
      if (growth.active) return growth.skip();
      const seen = look(x, y);
      if (!seen) return;
      const length = heldLength();
      if (length !== null && length > 1) placeRun(x, y, seen, length);
      else perform(planUse(tool(), seen.pick, seen.ctx), x, y);
    },
    erase(x, y) {
      if (dismissing) return;
      if (growth.active) return growth.skip();
      const seen = look(x, y);
      if (seen && perform(planErase(seen.pick, seen.ctx), x, y)) navigator.vibrate?.(12);
    },
    orbit: (dx, dy) => view.orbit(-dx * INPUT.orbitYaw, dy * INPUT.orbitPitch),
    pan: (dx, dy) => view.pan(dx, dy),
    zoom(factor, x, y) {
      view.zoomBy(factor, x, y);
      if (hoverAt) updateGhost();
    },
    scroll: scrollLength,
    hover(x, y) {
      hoverAt = { x, y };
      updateGhost();
    },
    hoverEnd() {
      hoverAt = null;
      shownRun = null;
      setGhost(null, '');
      showCount();
    },
    runStart(x, y) {
      if (dismissing || growth.active || !paintsRuns(tray.state.item)) return false;
      const seen = look(x, y);
      if (!seen) return false;
      const plan = planUse(tool(), seen.pick, seen.ctx);
      const first = plan.tries[0];
      if (!first) return false;
      game.begin();
      const placed = perform(plan, x, y);
      const cell = 'cell' in first ? first.cell : NO_CELL;
      run = {
        world0: seen.ctx.world,
        level: keyY(first.type === 'placeEdge' ? seen.pick.target : cell),
        first,
        last: cell,
        color: (placed && first.type === 'placeBlock' ? game.world.blocks.get(cell)?.color : undefined) ?? tray.state.swatch,
        done: new Set(first.type === 'placeEdge' ? [first.edge] : [cell]),
      };
      return true;
    },
    runMove: runStep,
    runEnd() {
      run = null;
      game.end();
    },
    dragging(on) {
      canvas.style.cursor = on ? 'grabbing' : '';
    },
  };
  const detachPointer = attachPointer(canvas, sink);

  // ── the keyboard ───────────────────────────────────────────────────────
  const onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const key = e.key.toLowerCase();
    if (growth.active && !['shift', 'control', 'alt', 'meta'].includes(key)) {
      // Any key finishes a growing town at once (and does nothing else).
      e.preventDefault();
      growth.skip();
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) game.redo();
        else game.undo();
      } else if (key === 'y') {
        e.preventDefault();
        game.redo();
      }
      return;
    }
    if (e.altKey) return;
    if (key === 'escape') return void closePopups();
    if (/^[0-9]$/.test(e.key)) tray.pickNumber(Number(e.key));
  };
  window.addEventListener('keydown', onKey);

  // The page itself never zooms: a pinch or Ctrl + scroll over the tray or a card does nothing (over the town it zooms the town).
  const noPageZoom = (e: Event): void => {
    if (e.type !== 'wheel' || (e as WheelEvent).ctrlKey) e.preventDefault();
  };
  window.addEventListener('wheel', noPageZoom, { passive: false });
  window.addEventListener('gesturestart', noPageZoom);

  // ── towns in and out ───────────────────────────────────────────────────
  const share = async (): Promise<void> => {
    const link = shareLink(game.world);
    if (link === null) {
      downloadTown(game.world);
      feedback.toast('This town is too big for a link, so here it is as a file.');
    } else if (await copyText(link)) feedback.toast('Link copied. Anyone who opens it gets a copy of this town.');
    else feedback.linkBox('Copy this link to share your town:', link);
  };
  const postcard = async (): Promise<void> => {
    const blob = await makePostcard(canvas, host.renderNow);
    if (blob) download(blob, 'little-city-postcard.png');
    else feedback.toast('The postcard could not be made.');
  };
  const openFile = async (file: File): Promise<void> => {
    const result = await readTownFile(file);
    if (result.ok) growth.stop();
    if (result.ok) host.openTown(result.world);
    else feedback.toast(result.reason);
  };
  const onDragOver = (e: DragEvent): void => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  };
  const onDrop = (e: DragEvent): void => {
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    e.preventDefault();
    void openFile(file);
  };
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('drop', onDrop);

  tray.onChange(() => {
    ghostKey = '';
    scrollSteps.reset();
    stepper.show(heldLength());
    updateGhost();
  });
  stepper.show(heldLength());

  const api: Interface = {
    el: root,
    tray,
    feedback,
    growth,
    frame() {
      growth.tick(performance.now());
      markers.update(tray.state.item === 'change', game.world, game.terrain);
    },
    sync() {
      worldVersion++;
      undoButton.disabled = !game.canUndo;
      redoButton.disabled = !game.canRedo;
      showTime();
      if (hoverAt) updateGhost();
    },
    debug: () => ({
      item: tray.state.item,
      drawer: tray.state.drawer,
      swatch: tray.state.swatch,
      time: host.time.holding,
      ghost: ghost ? { show: [...ghost.show], shimmer: [...(ghost.shimmer ?? [])], refuse: ghost.refuse ?? null } : null,
      markers: markers.cells(),
      sound,
      length: heldLength(),
      run: shownRun && ghost ? shownRun.edits.length : null,
    }),
    dispose() {
      growth.stop();
      detachPointer();
      canvas.removeEventListener('pointerdown', onCanvasDown, { capture: true });
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', noPageZoom);
      window.removeEventListener('gesturestart', noPageZoom);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      view.setGhost(null);
      root.remove();
    },
  };
  api.sync();
  return api;
}
