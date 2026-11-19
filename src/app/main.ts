// STUB (Stage 0, working). Owner: Interface (Stage 1).
//
// Wiring and the main loop: world → staged resolve → view → life. The stub
// has no tray or menus (src/ui/input.ts: click places, right click erases).
//
// URL parameters: ?seed=<n> starts a fresh island; ?scenario=<name> loads a
// scenario instead of the saved town.
//
// window.__lc is a debug handle for Playwright tests and the console.

import { hash } from '@/core/rand';
import type { Edit, Terrain, World } from '@/core/world';
import { createLife } from '@/life/runtime';
import { createSignals } from '@/life/signals';
import { createTownView } from '@/render/index';
import { createStagedResolver } from '@/resolve/staged';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { generateTerrain, initialWorld } from '@/terrain/terrain';
import { attachInput, STUB_KINDS } from '@/ui/input';
import { canRedo, canUndo, createHistory, pushHistory, redo, undo } from '@/world/history';
import { loadTown, saveTown } from '@/world/save';
import { applyEdit, canApply } from '@/world/world';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const params = new URLSearchParams(location.search);
const scenarioName = params.get('scenario');
const seedParam = params.get('seed');

let world: World;
let terrain: Terrain;
const scn = scenarioName ? findScenario(scenarioName) : undefined;
if (scenarioName && !scn) console.warn(`no scenario named '${scenarioName}'`);
if (scn) {
  const built = buildScenario(scn);
  world = built.world;
  terrain = built.terrain;
} else {
  const saved = seedParam === null ? loadTown(storage()) : null;
  const seed = saved?.seed ?? (seedParam !== null ? Number(seedParam) | 0 : hash(Date.now() | 0, 'island') | 0);
  terrain = generateTerrain(seed);
  world = saved ?? initialWorld(seed, terrain);
}

const canvas = document.getElementById('town') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLDivElement;
const view = createTownView(canvas);
const signals = createSignals(world.seed);
const life = createLife(view.stage, signals);
const resolver = createStagedResolver(terrain, scn ? scenarioResolveOptions(scn) : {});
let history = createHistory(world);
let kindLabel = 'auto';
let message = '';

function show(next: World, landed?: Edit): void {
  world = next;
  const shape = resolver.update(world);
  view.setTown(shape, null);
  life.sync({ shape, dressing: null });
  if (landed?.type === 'placeBlock') signals.emit('blockLanded', landed.cell);
  if (landed?.type === 'eraseBlock') signals.emit('blockRemoved', landed.cell);
  if (!scn) saveTown(storage(), world);
}

function edit(e: Edit): boolean {
  const verdict = canApply(world, terrain, e);
  if (!verdict.ok) {
    message = verdict.reason;
    return false;
  }
  message = '';
  const next = applyEdit(world, terrain, e);
  history = pushHistory(history, next);
  show(next, e);
  return true;
}

attachInput({
  view,
  world: () => world,
  terrain: () => terrain,
  edit,
  onKind(kind) {
    kindLabel = kind;
  },
});

window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
  e.preventDefault();
  const step = e.shiftKey ? (canRedo(history) ? redo(history) : null) : canUndo(history) ? undo(history) : null;
  if (!step) return;
  history = step;
  show(history.present);
});

function resize(): void {
  view.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();
show(world);

let last = performance.now();
function frame(now: number): void {
  const dt = signals.advance((now - last) / 1000);
  last = now;
  const ready = resolver.poll();
  if (ready) {
    view.setDressing(ready.dressing);
    life.sync(ready);
  }
  life.update(dt);
  view.render(signals);
  hud.textContent =
    `Little City (stub)   placing: ${kindLabel}   blocks: ${world.blocks.size}\n` +
    `click place · right click erase · drag orbit · right drag pan · scroll zoom · keys 1–${STUB_KINDS.length} pick` +
    (message ? `\n${message}` : '');
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
  signals,
  edit,
  world: () => world,
  terrain: () => terrain,
  shape: () => resolver.shape,
};
