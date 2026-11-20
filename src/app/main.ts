// The app: wiring and the main loop (CONTRACTS section 12). Owner: Interface.
//
//   world → staged resolve → view → life, once per edit (src/app/game.ts)
//   signals.advance → resolver.poll → life.update → view.render, once per frame
//
// Which town opens:
//   #t=<code>          a share link: that town, as a copy (design section 15)
//   ?scenario=<name>   a scenario (never saved)
//   ?seed=<n>          a fresh island with that seed (&gen=1 for the first island generator)
//   otherwise          the autosaved town, or a fresh island
//
// The phone fallbacks of design section 14 pick themselves on a small touch
// screen (half-resolution ink in the view, a smaller crowd in life); for
// measuring, ?ink=full|half and ?density=1|2|3 (the highest rule tier that
// dresses the town) override them.
//
// Seasons and weather (design section 13a) run by themselves; ?season=spring|summer|autumn|winter|
// festival|<year 0..1> and ?weather=auto|clear|cloudy|rain|storm|fog|wind|snow hold them (a scenario
// can name them too), and &settle=1 brings the weather in at once (settled snow included).
//
// window.__lc is the debug handle browser tests and the console use.

import { hash } from '@/core/rand';
import type { Edit, Terrain, World } from '@/core/world';
import type { LifeRuntime } from '@/life/api';
import { createLife } from '@/life/runtime';
import { mischiefOf } from '@/life/mischief/director';
import { applyCalendar } from '@/life/season';
import { createSignals, type TownSignals } from '@/life/signals';
import { createTownView, type CameraPose } from '@/render/index';
import type { ShapePlan } from '@/resolve/plan';
import { buildScenario, scenarioResolveOptions, type CameraSpec, type Scenario } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { generateTerrain, initialWorld, NEW_ISLAND_GEN, terrainOf, type TerrainGen } from '@/terrain/terrain';
import { townFromHash } from '@/ui/files';
import { createInterface, type Interface } from '@/ui/interface';
import { loadTown } from '@/world/save';
import { createAutosave } from './autosave';
import { createGame, type GameStart } from './game';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** A new island: the newest generator (design section 6), unless the URL asks for the first (tests pin it). */
function freshIsland(seed: number): GameStart {
  const gen: TerrainGen = new URLSearchParams(location.search).get('gen') === '1' ? 1 : NEW_ISLAND_GEN;
  const terrain = generateTerrain(seed, gen);
  return { terrain, world: initialWorld(seed, terrain, gen) };
}
/** A saved or shared town: on the island its own generator made (World.terrainGen; absent = 1). */
const townOf = (world: World): GameStart => ({ world, terrain: terrainOf(world) });
const newSeed = (): number => hash(Date.now() | 0, 'island', Math.floor(Math.random() * 0x7fffffff)) | 0;

// ── which town ───────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const scenarioName = params.get('scenario');
const seedParam = params.get('seed');
let scn: Scenario | undefined = scenarioName ? findScenario(scenarioName) : undefined;
if (scenarioName && !scn) console.warn(`no scenario named '${scenarioName}'`);

const saved = scn || seedParam !== null ? null : loadTown(storage());
const shared = townFromHash(location.hash);
/** A shared town opened by someone who has a town of their own: shown, but not saved over theirs until they say so. */
let visiting = false;
let start: GameStart;
let scenarioCamera: CameraSpec | undefined;
if (shared?.ok) {
  start = townOf(shared.world);
  visiting = saved !== null;
  scn = undefined;
} else if (scn) {
  const built = buildScenario(scn);
  start = { world: built.world, terrain: built.terrain, resolve: scenarioResolveOptions(scn) };
  scenarioCamera = built.cameras[0];
} else if (saved) {
  start = townOf(saved);
} else {
  start = freshIsland(seedParam !== null ? Number(seedParam) | 0 : newSeed());
}

// ── device settings ──────────────────────────────────────────────────────
const inkParam = params.get('ink');
const densityParam = Number(params.get('density'));
const density = densityParam === 1 || densityParam === 2 || densityParam === 3 ? densityParam : undefined;
/** The town with the decoration density (rule tiers) asked for in the URL, if any. */
const tiered = (s: GameStart): GameStart => (density === undefined ? s : { ...s, resolve: { ...s.resolve, maxTier: density } });

// ── the parts ────────────────────────────────────────────────────────────
const canvas = document.getElementById('town') as HTMLCanvasElement;
const view = createTownView(canvas, { ink: inkParam === 'full' || inkParam === 'half' ? inkParam : 'auto' });
let signals: TownSignals = createSignals(start.world.seed);
applyCalendar(signals, params.get('season') ?? scn?.season, params.get('weather') ?? scn?.weather, params.get('settle') === '1' || (scn !== undefined && (scn.season !== undefined || scn.weather !== undefined)));
let life: LifeRuntime = createLife(view.stage, signals);
let ui: Interface | null = null;

const autosave = createAutosave({
  storage: storage(),
  world: () => game.world,
  onFail: () => ui?.feedback.toast('This browser will not let the town be saved, so it lasts only until you close the page.'),
});
autosave.enabled = !scn && !visiting;

const game = createGame(tiered(start), {
  // CONTRACTS section 12: setTown before life.sync, so the instances exist.
  show(shape: ShapePlan, landed: Edit | null) {
    view.setTown(shape, null);
    life.sync({ shape, dressing: null });
    if (landed?.type === 'placeBlock') signals.emit('blockLanded', landed.cell);
    if (landed?.type === 'eraseBlock') signals.emit('blockRemoved', landed.cell);
  },
  changed() {
    ui?.sync();
    autosave.schedule();
  },
});

// Mischief (design section 13b): what it does reaches the town as ordinary edits, one undo step per act.
const mischief = mischiefOf(view.stage);
mischief.connect({
  begin: () => game.begin(),
  apply: (edits) => void game.editAll(edits),
  end: () => game.end(),
  abort: () => void game.abort(),
  edit: (edits) => void game.editAll(edits),
  amend: (edits) => void game.amend(edits),
});

/** A different town: life and the signals start over with its seed; the held time of day carries across. */
function open(next: GameStart): void {
  const holding = signals.holding;
  mischief.detach();
  const { seasonHolding, weatherHolding } = signals;
  life.dispose();
  signals = createSignals(next.world.seed);
  signals.hold(holding);
  if (seasonHolding !== 'run') signals.holdSeason(seasonHolding);
  if (weatherHolding !== 'auto') signals.holdWeather(weatherHolding);
  life = createLife(view.stage, signals);
  game.restart(tiered(next));
}

function leaveSpecialTown(): void {
  scn = undefined;
  visiting = false;
  autosave.enabled = true;
  if (location.search || location.hash) history.replaceState(null, '', location.pathname);
}

function resize(): void {
  view.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
}
window.addEventListener('resize', resize);
resize();
const opening = view.getCamera();
/** The whole-island view a new island opens on (Escape with nothing open glides back to it). */
function homeCamera(): CameraPose {
  const c = opening;
  // A phone held upright: pull back so the island's width fits the screen.
  return window.innerWidth < window.innerHeight ? { ...c, zoom: Math.max(0.7, c.zoom * Math.min(1, (window.innerWidth / window.innerHeight) * 1.05)) } : c;
}
view.setCamera(scenarioCamera ?? homeCamera());

function render(): void {
  view.render(signals);
}

ui = createInterface({
  view,
  game,
  time: {
    get holding() {
      return signals.holding;
    },
    hold: (mode) => signals.hold(mode),
    get phase() {
      return signals.time.phase;
    },
    glide: (mode) => signals.glideTime(mode),
    scrub: (phase) => signals.scrubTime(phase),
  },
  seasons: {
    get seasonHolding() {
      return signals.seasonHolding;
    },
    holdSeason: (mode) => signals.holdSeason(mode),
    get year() {
      return signals.season.year;
    },
    glideSeason: (mode) => signals.glideSeason(mode),
    scrubYear: (year) => signals.scrubYear(year),
    get weatherHolding() {
      return signals.weatherHolding;
    },
    holdWeather: (mode) => signals.holdWeather(mode),
  },
  renderNow: render,
  homeCamera,
  newIsland() {
    leaveSpecialTown();
    open(freshIsland(newSeed()));
  },
  openTown(world) {
    leaveSpecialTown();
    open(townOf(world));
    ui?.feedback.toast('Town opened.');
  },
});

// ── share links ──────────────────────────────────────────────────────────
if (shared && !shared.ok) {
  // A broken link: say so plainly and leave the player's own town as it is (plan Review Focus 2).
  ui.feedback.toast(shared.reason);
  history.replaceState(null, '', location.pathname + location.search);
} else if (shared?.ok && visiting) {
  ui.feedback.banner('This is a town someone shared with you.', [
    {
      label: 'Keep it as mine',
      primary: true,
      run() {
        leaveSpecialTown();
        autosave.schedule();
      },
    },
    {
      label: 'Back to my town',
      run() {
        leaveSpecialTown();
        const mine = loadTown(storage());
        open(mine ? townOf(mine) : freshIsland(newSeed()));
      },
    },
  ]);
} else if (shared?.ok) {
  // Nobody's town is at stake: the copy simply becomes the player's town.
  leaveSpecialTown();
  autosave.schedule();
}

window.addEventListener('pagehide', () => autosave.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autosave.flush();
});

// ── the frame loop ───────────────────────────────────────────────────────
let last = performance.now();
function frame(now: number): void {
  const real = Math.min(0.1, Math.max(0, (now - last) / 1000));
  const dt = signals.advance((now - last) / 1000);
  last = now;
  const ready = game.poll();
  if (ready) {
    view.setDressing(ready.dressing);
    life.sync(ready);
    ui?.dressed(ready.dressing);
  }
  // Fly mode moves the eye on real time (it carries on when the town's clock is held).
  ui?.fly.frame(real);
  // Flames turn to whichever eye draws: fly mode's while flying (its pitch is above the horizon, the
  // orbit camera's below it).
  const eye = view.getEyeCamera();
  const cam = view.getCamera();
  mischief.camera = eye ? { yaw: eye.yaw, pitch: -eye.pitch } : { yaw: cam.yaw, pitch: cam.pitch };
  life.update(dt);
  mischief.flush();
  render();
  ui?.frame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

declare global {
  interface Window {
    __lc?: unknown;
  }
}
window.__lc = {
  view,
  get signals() {
    return signals;
  },
  /** Applies an edit if it is legal; returns whether it was. */
  edit: (e: Edit): boolean => game.edit(e).ok,
  world: (): World => game.world,
  terrain: (): Terrain => game.terrain,
  shape: (): ShapePlan => game.shape,
  game,
  ui,
  autosave,
  mischief,
};
