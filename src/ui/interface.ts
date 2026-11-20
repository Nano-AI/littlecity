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

import { maybeWelcome } from './welcome';
import { columnIndex, edgeOf, key, keyX, keyY, keyZ, NO_CELL, type CellKey } from '@/core/grid';
import type { Edit, Terrain, World } from '@/core/world';
import type { DressingPlan } from '@/resolve/plan';
import type { TimeHold } from '@/life/api';
import type { SeasonHold, WeatherHold } from '@/life/season';
import type { Ghost, TownView } from '@/render/api';
import type { Game } from '@/app/game';
import { brushAt, copyLook, landColumn, levelSteps, lineCells, planErase, planUse, type ActionContext, type Plan, type ToolState } from './actions';
import { el, iconButton, installTheme, setIcon } from './dom';
import { createFeedback, wiggle, type Feedback } from './feedback';
import { createGrowth, onlyStartingTrees, type Growth } from './growth';
import { growTown } from '@/townmaker/index';
import { copyText, download, downloadTown, makePostcard, readTownFile, shareLink } from './files';
import type { GestureSink } from './gestures';
import { ghostFor, ghostForLand, ghostForRun } from './ghost';
import { createGuide, type Guide } from './guide';
import { clampLength, createScrollSteps, growthOf, maxLengthOf, planRun, type Run } from './length';
import { createMarkers } from './markers';
import { createMenu } from './menu';
import { faceZone, pickCell, type Pick } from './pick';
import { DRAWER_IDS, drawerItems, isLandTool, isToolId, paintsRuns, type DrawerId, type ItemId } from './pieces';
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
  /** Added by Seasons: the season and weather controls (the signals driver). Without them, no buttons. */
  seasons?: {
    readonly seasonHolding: SeasonHold;
    holdSeason(mode: SeasonHold): void;
    readonly weatherHolding: WeatherHold;
    holdWeather(mode: WeatherHold): void;
  };
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
  /** The guide to special buildings (design section 7, "The guide"). */
  readonly guide: Guide;
  /** The dressing for the newest world arrived (the guide's ticks for lamps, laundry and parks). */
  dressed(dressing: DressingPlan): void;
  /** Call once per frame, after the town has been drawn. */
  frame(): void;
  /** The world or the history changed: refresh the buttons and the ghost. */
  sync(): void;
  /** What the interface is showing, for browser tests and the console. */
  debug(): {
    item: ItemId;
    drawer: DrawerId;
    swatch: number | 'auto';
    /** The house style in the hand: 0 = Random. */
    style: number;
    /** The house-style flyout is open. */
    styles: boolean;
    time: TimeHold;
    /** Added by Seasons. */
    season: SeasonHold | null;
    weather: WeatherHold | null;
    ghost: GhostSummary | null;
    markers: CellKey[];
    sound: boolean;
    /** The held piece's length, or null when the selected item has none. */
    length: number | null;
    /** How many cells of the held run the ghost shows (null when there is no run on show). */
    run: number | null;
    /** The guide is open. */
    guide: boolean;
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
// Seasons (design section 13a): the season button cycles like the sun button; the weather button
// steps through the kinds, auto first.
const SEASON_ORDER: readonly SeasonHold[] = ['run', 'spring', 'summer', 'autumn', 'winter'];
const SEASON_LABEL: Record<SeasonHold, string> = {
  run: 'Seasons: the year is turning. Press to hold spring',
  spring: 'Holding spring. Press for summer',
  summer: 'Holding summer. Press for autumn',
  autumn: 'Holding autumn. Press for winter',
  winter: 'Holding winter, with the festival lights. Press to let the year turn',
};
const WEATHER_ORDER: readonly WeatherHold[] = ['auto', 'clear', 'cloudy', 'rain', 'storm', 'snow', 'fog', 'wind'];
const WEATHER_LABEL: Record<WeatherHold, string> = {
  auto: 'Weather: comes and goes. Press for a clear sky',
  clear: 'Holding a clear sky. Press for cloud',
  cloudy: 'Holding cloud. Press for rain',
  rain: 'Holding rain. Press for a thunderstorm',
  storm: 'Holding a thunderstorm. Press for snow',
  snow: 'Holding snow. Press for mist',
  fog: 'Holding mist. Press for wind',
  wind: 'Holding a windy day. Press to let the weather change by itself',
};
const SOUND_KEY = 'little-city.sound';
const LAND_HINT_KEY = 'little-city.land-hint';
/** Told once, the first time Raise, Dig or Level is picked. */
export const LAND_HINT = 'Drag the land to shape it. Drag the sea to turn the view.';

function readSound(): boolean {
  try {
    // Off until the player turns it on.
    return localStorage.getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
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

  const guide = createGuide({ shape: () => game.shape });

  const timeButton = iconButton('time-run', 'Time of day', { class: 'lc-round', attrs: { 'data-ui': 'time' } });
  const seasonButton = iconButton('season-run', 'Season', { class: 'lc-round', attrs: { 'data-ui': 'season' } });
  const weatherButton = iconButton('weather-auto', 'Weather', { class: 'lc-round', attrs: { 'data-ui': 'weather' } });
  const undoButton = iconButton('undo', 'Undo', { class: 'lc-round', title: 'Undo (⌘Z)', attrs: { 'data-ui': 'undo' } });
  const redoButton = iconButton('redo', 'Redo', { class: 'lc-round', title: 'Redo (⇧⌘Z)', attrs: { 'data-ui': 'redo' } });
  root.append(
    markers.el,
    el('div', { class: 'lc-card lc-corner lc-corner-left' }, [menu.button]),
    el('div', { class: 'lc-card lc-corner lc-corner-left lc-corner-guide' }, [guide.button]),
    el('div', { class: 'lc-card lc-corner lc-corner-right' }, [timeButton, ...(host.seasons ? [seasonButton, weatherButton] : []), undoButton, redoButton]),
    tray.el,
    count,
    menu.el,
    menu.file,
    feedback.el,
    guide.el,
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
  const showSeasons = (): void => {
    const s = host.seasons;
    if (!s) return;
    const season = s.seasonHolding, weather = s.weatherHolding;
    setIcon(seasonButton, `season-${season}`);
    seasonButton.title = SEASON_LABEL[season];
    seasonButton.setAttribute('aria-label', SEASON_LABEL[season]);
    seasonButton.setAttribute('data-season', season);
    setIcon(weatherButton, `weather-${weather}`);
    weatherButton.title = WEATHER_LABEL[weather];
    weatherButton.setAttribute('aria-label', WEATHER_LABEL[weather]);
    weatherButton.setAttribute('data-weather', weather);
  };
  seasonButton.addEventListener('click', () => {
    const s = host.seasons;
    if (!s) return;
    s.holdSeason(SEASON_ORDER[(SEASON_ORDER.indexOf(s.seasonHolding) + 1) % SEASON_ORDER.length]!);
    showSeasons();
  });
  weatherButton.addEventListener('click', () => {
    const s = host.seasons;
    if (!s) return;
    s.holdWeather(WEATHER_ORDER[(WEATHER_ORDER.indexOf(s.weatherHolding) + 1) % WEATHER_ORDER.length]!);
    showSeasons();
  });
  showSeasons();
  undoButton.addEventListener('click', () => game.undo());
  redoButton.addEventListener('click', () => game.redo());

  // ── acting on the town ─────────────────────────────────────────────────
  const tool = (): ToolState => ({
    item: tray.state.item,
    swatch: tray.state.swatch,
    style: tray.state.style,
    ...(isLandTool(tray.state.item) ? { brush: heldLength() ?? 1 } : {}),
  });

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
    if (plan.steps && plan.steps.length > 1) {
      // Level: all the way to the target height, as one undo step and one redraw.
      if (game.editAll(plan.steps) > 0) return true;
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
      if (isLandTool(tray.state.item)) {
        // Raise, Dig, Level: the ground as it would be, and what it carries.
        const plan = planUse(tool(), seen.pick, seen.ctx);
        const key = `${worldVersion}|${tray.state.item}|${heldLength()}|${plan.at}|${JSON.stringify(plan.tries[0] ?? null)}`;
        if (key === ghostKey) return;
        return setGhost(ghostForLand(plan, game), key);
      }
      const length = heldLength();
      if (length !== null && length > 1) {
        // A held run: worked out again only when the target, the direction, the length or the piece changes.
        const run = planRun(tool(), seen.pick, seen.ctx, length);
        shownRun = run;
        const key = `${worldVersion}|${tray.state.item}|${tray.state.swatch}|${tray.state.style}|${length}|${run.at}|${run.dir}|${JSON.stringify(run.edits[0] ?? run.refusal)}`;
        if (key === ghostKey) return;
        return setGhost(ghostForRun(run, game), key);
      }
      const plan = planUse(tool(), seen.pick, seen.ctx);
      // The same piece on the same target in the same world: nothing to work out again.
      const key = `${worldVersion}|${tray.state.item}|${tray.state.swatch}|${tray.state.style}|${plan.at}|${JSON.stringify(plan.tries[0] ?? plan.refusal ?? null)}`;
      if (key === ghostKey) return;
      setGhost(ghostFor(plan, game), key);
    };
    shownRun = null;
    ghostOf();
    showCount();
  };

  // ── held length (design section 7) ─────────────────────────────────────
  /** Length per piece, for this session; every piece starts at 1. */
  const lengths = new Map<string, number>();
  /** The land tools share one brush. */
  const lengthKey = (item: ItemId): string => (isLandTool(item) ? 'brush' : item);
  const heldLength = (): number | null => (growthOf(tray.state.item) === null ? null : (lengths.get(lengthKey(tray.state.item)) ?? 1));
  const showStepper = (): void => stepper.show(heldLength(), maxLengthOf(tray.state.item), isLandTool(tray.state.item) ? 'Brush' : 'Length');
  const stepper = createStepper((by) => changeLength(by));
  tray.el.append(stepper.el);
  tray.avoid(stepper.el);
  const scrollSteps = createScrollSteps();
  /** True while a run is being placed: the ghost waits until it is all down. */
  let placingRun = false;

  const changeLength = (by: number): void => {
    const length = heldLength();
    if (length === null) return;
    const next = clampLength(length + by, maxLengthOf(tray.state.item));
    if (next === length) return;
    lengths.set(lengthKey(tray.state.item), next);
    showStepper();
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

  // ── Shift-drag with Raise, Dig or Level: a stroke (shaping the land) ───
  // Each column changes at most once per stroke, and the whole stroke is one
  // undo step. Columns gathered while the pointer moves are applied once per
  // frame, in one edit, so a fast stroke over twenty columns costs one
  // resolve and one rebuild a frame rather than one per pointer event.
  let stroke: {
    item: ItemId;
    /** The town when the stroke began: the pointer is picked against it, so the ground does not move under it. */
    world0: World;
    terrain0: Terrain;
    /** Level: the height of the column the stroke began on. */
    levelTo: number;
    brush: number;
    done: Set<number>;
    pending: number[];
    last: { x: number; z: number };
    /** Why some of the stroke could not be done (told once, when it ends). */
    refused: string;
    at: [number, number];
  } | null = null;

  const strokeAt = (x: number, y: number): Pick | null => (stroke ? pickCell(view.screenToRay(x, y), stroke.world0, stroke.terrain0) : null);

  const strokeAdd = (cols: readonly number[]): void => {
    if (!stroke) return;
    for (const c of cols) {
      if (stroke.done.has(c)) continue;
      stroke.done.add(c);
      stroke.pending.push(c);
    }
  };

  /** Applies the columns gathered since the last frame, as one edit. Refusals are noted and told once, at the end. */
  const flushStroke = (): void => {
    if (!stroke || stroke.pending.length === 0) return;
    const cols = stroke.pending;
    stroke.pending = [];
    if (stroke.item === 'level') {
      // Level goes all the way to the stroke's height (design section 6, as the name promises).
      const level = levelSteps(game.world, game.terrain, cols, stroke.levelTo);
      if (level.edits.length > 0) game.editAll(level.edits);
      const h = game.terrain.height;
      if (cols.some((c) => h[c] !== stroke!.levelTo)) stroke.refused ||= level.reason;
      return;
    }
    const e: Edit = stroke.item === 'raise' ? { type: 'land', up: cols, down: [] } : { type: 'land', up: [], down: cols };
    const v = game.edit(e);
    if (!v.ok) stroke.refused ||= v.reason;
  };

  const strokeStart = (x: number, y: number): boolean => {
    const seen = look(x, y);
    if (!seen) return false;
    const { x: cx, z: cz } = landColumn(seen.pick);
    const brush = heldLength() ?? 1;
    const levelTo = game.terrain.height[columnIndex(cx, cz)]!;
    setGhost(null, '');
    game.begin();
    stroke = { item: tray.state.item, world0: game.world, terrain0: game.terrain, levelTo, brush, done: new Set(), pending: [], last: { x: cx, z: cz }, refused: '', at: [x, y] };
    // The first dab is the brush where the stroke began.
    strokeAdd(brushAt(seen.pick, brush));
    flushStroke();
    return true;
  };

  const strokeMove = (x: number, y: number): void => {
    if (!stroke) return;
    const pick = strokeAt(x, y);
    if (!pick) return;
    const { x: tx, z: tz } = landColumn(pick);
    // Every column between the last sample and this one, so a fast stroke leaves no gaps.
    const from = key(stroke.last.x, 0, stroke.last.z);
    const steps = tx === stroke.last.x && tz === stroke.last.z ? [] : lineCells(from, key(tx, 0, tz));
    for (const c of steps) {
      const at: Pick = { ...pick, cell: key(keyX(c), keyY(pick.cell), keyZ(c)), point: [keyX(c) + (pick.point[0] - tx), pick.point[1], keyZ(c) + (pick.point[2] - tz)] };
      strokeAdd(brushAt(at, stroke.brush));
    }
    strokeAdd(brushAt(pick, stroke.brush));
    stroke.last = { x: tx, z: tz };
    stroke.at = [x, y];
  };

  const strokeEnd = (): void => {
    flushStroke();
    const told = stroke?.refused;
    const at = stroke?.at;
    stroke = null;
    game.end();
    if (told && at) refuse(told, at[0], at[1]);
  };

  // ── the pointer ────────────────────────────────────────────────────────
  /** A press on the town while a pop-up is open only closes it: that click builds nothing. */
  let dismissing = false;
  /** The press that is going on is an Alt-click with the mouse: it copies a look instead of building. */
  let copying = false;
  const closePopups = (): boolean => {
    const menuWasOpen = menu.isOpen;
    menu.close();
    return tray.closePopups() || menuWasOpen;
  };
  const onCanvasDown = (e: PointerEvent): void => {
    dismissing = closePopups();
    copying = e.altKey && e.pointerType === 'mouse' && e.button === 0;
  };

  /** Alt-click (design section 7, "Copy a look"): the block's kind, colour and style go into the hand. */
  const copyAt = (x: number, y: number): void => {
    const seen = look(x, y);
    const copied = seen && copyLook(seen.pick, seen.ctx);
    if (!copied) return;
    tray.select(copied.item);
    tray.setSwatch(copied.swatch);
    tray.setStyle(copied.style);
  };
  canvas.addEventListener('pointerdown', onCanvasDown, { capture: true });

  const sink: GestureSink = {
    use(x, y) {
      if (dismissing) return;
      if (growth.active) return growth.skip();
      if (copying) return copyAt(x, y);
      const seen = look(x, y);
      if (!seen) return;
      const length = heldLength();
      if (length !== null && length > 1 && !isLandTool(tray.state.item)) placeRun(x, y, seen, length);
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
    // A land tool held: a drag that starts on the land shapes it; one that starts on the sea turns the view.
    dragPaints(x, y) {
      if (!isLandTool(tray.state.item) || growth.active || dismissing || copying) return false;
      const seen = look(x, y);
      return seen !== null && seen.pick.hit !== 'water';
    },
    runStart(x, y) {
      if (dismissing || growth.active || copying || !paintsRuns(tray.state.item)) return false;
      if (isLandTool(tray.state.item)) return strokeStart(x, y);
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
    runMove(x, y) {
      if (stroke) strokeMove(x, y);
      else runStep(x, y);
    },
    runEnd() {
      if (stroke) return strokeEnd();
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
    if (key === 'escape') return void (closePopups() || guide.close());
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

  // Shaping the land: the first time a land tool is picked, one line on how it is used.
  let landHintShown = false;
  try {
    landHintShown = localStorage.getItem(LAND_HINT_KEY) === 'seen';
  } catch {
    // No storage: the hint shows once per visit.
  }
  tray.onChange(() => {
    if (isLandTool(tray.state.item) && !landHintShown) {
      landHintShown = true;
      feedback.toast(LAND_HINT);
      try {
        localStorage.setItem(LAND_HINT_KEY, 'seen');
      } catch {
        // as above
      }
    }
    ghostKey = '';
    scrollSteps.reset();
    showStepper();
    updateGhost();
  });
  showStepper();

  // First visit to an empty island: point at Grow a town (see welcome.ts).
  const welcome = maybeWelcome(root, { hasTown: () => !onlyStartingTrees(game.world, game.terrain), growTown: grow });

  const api: Interface = {
    el: root,
    tray,
    feedback,
    growth,
    guide,
    dressed: (dressing) => guide.dressed(dressing),
    frame() {
      flushStroke();
      growth.tick(performance.now());
      markers.update(tray.state.item === 'change', game.world, game.terrain);
    },
    sync() {
      worldVersion++;
      undoButton.disabled = !game.canUndo;
      redoButton.disabled = !game.canRedo;
      showTime();
      showSeasons();
      guide.townChanged();
      welcome.townChanged();
      if (hoverAt) updateGhost();
    },
    debug: () => ({
      item: tray.state.item,
      drawer: tray.state.drawer,
      swatch: tray.state.swatch,
      style: tray.state.style,
      styles: tray.styles.isOpen,
      time: host.time.holding,
      season: host.seasons?.seasonHolding ?? null,
      weather: host.seasons?.weatherHolding ?? null,
      ghost: ghost ? { show: [...ghost.show], shimmer: [...(ghost.shimmer ?? [])], refuse: ghost.refuse ?? null } : null,
      markers: markers.cells(),
      sound,
      length: heldLength(),
      run: shownRun && ghost ? shownRun.edits.length : null,
      guide: guide.isOpen,
    }),
    dispose() {
      growth.stop();
      tray.styles.dispose();
      guide.dispose();
      welcome.dispose();
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
