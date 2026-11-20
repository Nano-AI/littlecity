// The gallery (dev page): every registered generator, layer, part and
// scenario, each shown by itself with orbit controls, beside sliders bound
// to the style modules so values can be tuned live. Owner: Interface.
//
// Nothing is listed by hand. Generators come from the kind table and
// allGenerators(), parts from allParts(), scenarios from allScenarios().
// What an entry shows is a scenario: a hand-made one from
// scenarios/gallery/** if there is one for it, else an automatic specimen
// (./specimens.ts). See gallery/README.md for the convention.
//
// Like tools/shot, it draws through TownView only, so it keeps working
// whatever the renderer becomes.

import { ALL_KINDS, FLOOR_KINDS } from '@/core/kinds';
import { allStyles } from '@/core/style';
import { allGenerators, allParts } from '@/gen/discover';
import type { LifeRuntime, TimeHold } from '@/life/api';
import { allBehaviours, allSystems } from '@/life/discover';
import { createLife } from '@/life/runtime';
import { createSignals, type TownSignals } from '@/life/signals';
import { applyCalendar } from '@/life/season';
import type { CameraPose, TownView } from '@/render/api';
import { createTownView } from '@/render/index';
import { allFacts, allRules } from '@/resolve/engine/discover';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { buildScenario, cameraName, scenarioResolveOptions, type BuiltScenario, type Scenario } from '@/scenario';
import { allScenarios } from '@/scenario/discover';
import { INPUT } from '@/style/input';
import { el, installTheme } from '@/ui/dom';
import { icon, iconIds } from '@/ui/icons';
import { attachPointer } from '@/ui/pointer';
import { createTuningPanel } from '@/ui/tuning';
import { generatorSpecimen, layerSpecimen, partSpecimen, type SpecimenKind } from './specimens';

interface Entry {
  /** Also the URL fragment: #gen.house, #part.prop.lamp, #scenario.hello-town, #icons. */
  id: string;
  group: string;
  label: string;
  /** A short note beside the label: "placeholder", "automatic", a folder. */
  note: string;
  /** What it shows. Null for the icon sheet. */
  scenario: (() => Scenario) | null;
  /** The scenario file behind it, if it is hand-made. */
  file?: string;
  about?: string;
}

// ── what there is ────────────────────────────────────────────────────────

const discovered = allScenarios();
const byName = new Map(discovered.map((e) => [e.scenario.name, e]));
const generators = allGenerators();
const parts = allParts();

function entryFor(id: string, group: string, label: string, state: string, automatic: () => Scenario): Entry {
  const own = byName.get(id);
  return own
    ? { id, group, label, note: state, scenario: () => own.scenario, file: own.file, about: own.scenario.about }
    : { id, group, label, note: state ? `${state} · automatic` : 'automatic', scenario: automatic };
}

const kinds: SpecimenKind[] = ['auto', ...ALL_KINDS, ...FLOOR_KINDS];
const entries: Entry[] = [
  ...discovered
    .filter((e) => e.file.includes('/scenarios/gallery/') && !/^(gen|part)\./.test(e.scenario.name))
    .map((e): Entry => ({ id: `scenario.${e.scenario.name}`, group: 'Gallery entries', label: e.scenario.name, note: '', scenario: () => e.scenario, file: e.file, about: e.scenario.about })),
  ...kinds.map((kind) =>
    entryFor(`gen.${kind}`, 'Generators', kind, kind === 'auto' ? 'resolves to a kind' : generators.has(kind) ? '' : 'placeholder', () => generatorSpecimen(kind)),
  ),
  ...generators.layers().map((l) => entryFor(`layer.${l.layer}`, 'Layers', l.layer, '', () => layerSpecimen(l.layer))),
  ...parts.list().map((p) => entryFor(`part.${p.category}.${p.type}`, 'Parts', `${p.type}`, p.category, () => partSpecimen(p.category, p.type))),
  ...discovered
    .filter((e) => !e.file.includes('/scenarios/gallery/'))
    .map((e): Entry => ({
      id: `scenario.${e.scenario.name}`,
      group: 'Scenarios',
      label: e.scenario.name,
      note: e.file.replace(/^\/?scenarios\//, '').split('/').slice(0, -1).join('/'),
      scenario: () => e.scenario,
      file: e.file,
      about: e.scenario.about,
    })),
  { id: 'icons', group: 'Interface', label: 'icons', note: 'tray, tools, menu', scenario: null, about: 'Every icon the interface draws (src/ui/icons.ts).' },
];

// ── the page ─────────────────────────────────────────────────────────────

installTheme();
const root = document.getElementById('gallery')!;
const canvas = el('canvas', { class: 'g-canvas', attrs: { id: 'town' } });
const iconSheet = el('div', { class: 'g-icons', attrs: { hidden: '' } });
const title = el('h2', { class: 'g-title' });
const about = el('p', { class: 'g-about' });
const cameraBar = el('div', { class: 'g-buttons', attrs: { 'data-ui': 'cameras' } });
const timeBar = el('div', { class: 'g-buttons', attrs: { 'data-ui': 'times' } });
const stats = el('div', { class: 'g-stats' });
const list = el('nav', { class: 'g-list', attrs: { 'aria-label': 'Entries' } });
const filter = el('input', { class: 'g-filter', attrs: { type: 'search', placeholder: 'Filter…', 'aria-label': 'Filter entries' } });
const stage = el('div', { class: 'g-stage' }, [canvas, iconSheet, el('div', { class: 'lc-card g-head' }, [title, about, el('div', { class: 'g-bars' }, [cameraBar, timeBar]), stats])]);

let view: TownView | null = null;
let life: LifeRuntime | null = null;
let signals: TownSignals | null = null;
let built: BuiltScenario | null = null;
let current: Entry | null = null;
let hold: TimeHold = 'day';
let problem = '';

function sizeView(): void {
  view?.resize(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight));
}

/** Resolves the current scenario again and draws it in a fresh view; the camera is kept if given. */
function draw(camera?: CameraPose): void {
  if (!built) return;
  life?.dispose();
  view?.dispose();
  view = createTownView(canvas);
  sizeView();
  signals = createSignals(built.scenario.seed);
  // Summer and a clear sky, held (seasons, design section 13a): pictures as they always were.
  applyCalendar(signals, 'summer', 'clear', true);
  signals.hold(hold);
  life = createLife(view.stage, signals);
  const opts = scenarioResolveOptions(built.scenario);
  const shape = resolveShape(built.world, built.terrain, opts);
  const dressing = resolveDressing(shape, opts);
  view.setTown(shape, dressing);
  life.sync({ shape, dressing });
  view.setCamera(camera ?? built.cameras[0]!);
  stats.textContent = `${built.world.blocks.size} blocks · ${shape.structures.size} structures · ${shape.features.length} features · ${dressing.props.length} props · ${dressing.actors.length} actors`;
}

const pressed = (bar: HTMLElement, index: number): void => {
  [...bar.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
};
const barButton = (text: string, run: () => void): HTMLButtonElement =>
  el('button', { class: 'lc-text-btn g-small', text, attrs: { type: 'button', 'aria-pressed': 'false' }, on: { click: run } });

const TIMES: readonly TimeHold[] = ['day', 'dusk', 'night', 'run'];
timeBar.append(
  ...TIMES.map((mode, i) =>
    barButton(mode === 'run' ? 'passing' : mode, () => {
      hold = mode;
      signals?.hold(mode);
      pressed(timeBar, i);
    }),
  ),
);
pressed(timeBar, 0);

function show(entry: Entry): void {
  current = entry;
  problem = '';
  for (const b of list.querySelectorAll<HTMLElement>('[data-entry]')) b.setAttribute('aria-current', String(b.dataset.entry === entry.id));
  if (location.hash.slice(1) !== entry.id) history.replaceState(null, '', `#${entry.id}`);
  title.textContent = `${entry.group}: ${entry.label}`;
  cameraBar.replaceChildren();
  const isIcons = entry.scenario === null;
  iconSheet.toggleAttribute('hidden', !isIcons);
  canvas.toggleAttribute('hidden', isIcons);
  timeBar.toggleAttribute('hidden', isIcons);
  if (!entry.scenario) {
    built = null;
    about.textContent = entry.about ?? '';
    stats.textContent = `${iconIds().length} icons`;
    return;
  }
  try {
    const scn = entry.scenario();
    built = buildScenario(scn);
    const source = entry.file ? `${entry.file.replace(/^\//, '')} · npm run shots -- ${scn.name}` : 'automatic specimen (gallery/specimens.ts)';
    about.textContent = `${scn.about ?? entry.about ?? ''} — ${source}`;
    const cameras = built.cameras;
    cameraBar.append(
      ...cameras.map((cam, i) =>
        barButton(`view ${cameraName(cameras, i)}`, () => {
          view?.setCamera(cam);
          pressed(cameraBar, i);
        }),
      ),
    );
    pressed(cameraBar, 0);
    draw();
  } catch (err) {
    // A scenario the current rules refuse: say so here instead of breaking the page.
    built = null;
    problem = String((err as Error)?.message ?? err);
    about.textContent = `This entry could not be built: ${problem}`;
    stats.textContent = '';
  }
}

// The list: one group per kind of thing, a filter on top.
function renderList(): void {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
  list.replaceChildren(
    ...[...groups].map(([group, items]) =>
      el('section', { attrs: { 'data-group': group } }, [
        el('h3', { text: `${group} (${items.length})` }),
        ...items.map((e) =>
          el(
            'button',
            { class: 'g-entry', title: e.about ?? e.label, attrs: { type: 'button', 'data-entry': e.id, 'aria-current': 'false' }, on: { click: () => show(e) } },
            [el('span', { text: e.label }), e.note ? el('small', { text: e.note }) : null],
          ),
        ),
      ]),
    ),
  );
}
filter.addEventListener('input', () => {
  const q = filter.value.trim().toLowerCase();
  for (const b of list.querySelectorAll<HTMLElement>('[data-entry]')) b.hidden = q !== '' && !b.textContent!.toLowerCase().includes(q) && !b.dataset.entry!.includes(q);
  for (const s of list.querySelectorAll<HTMLElement>('section')) s.hidden = !s.querySelector('[data-entry]:not([hidden])');
});

// Sliders: a change re-resolves (the Auto numbers are style values too) and
// redraws in a fresh view, so it shows whatever the renderer caches.
let pending = 0;
const tuning = createTuningPanel(
  () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => draw(view?.getCamera()));
  },
  { title: `Style (${allStyles().length} modules)`, open: ['palette'] },
);
tuning.classList.add('g-tuning');

iconSheet.append(
  ...iconIds().map((id) => el('figure', { attrs: { 'data-icon': id } }, [el('span', { class: 'g-icon-big', html: icon(id) }), el('span', { class: 'g-icon-small', html: icon(id) }), el('figcaption', { text: id })])),
);

// The registry: everything else discovery found, as plain tables.
function table(heading: string, rows: string[][]): HTMLElement {
  const t = el('table');
  for (const row of rows) t.append(el('tr', {}, row.map((cell) => el('td', { text: cell }))));
  return el('section', {}, [el('h3', { text: `${heading} (${rows.length})` }), t]);
}
const registry = el('div', { class: 'g-registry', attrs: { 'data-ui': 'registry' } }, [
  el('h2', { text: 'Registry' }),
  table('Generators', [...ALL_KINDS, ...FLOOR_KINDS].map((k) => [k, generators.has(k) ? 'real' : 'placeholder box'])),
  table('Layers', generators.layers().map((l) => [l.layer])),
  table('Parts', parts.list().map((p) => [p.category, p.type])),
  table('Rules', allRules().map((r) => [r.id, r.part, `tier ${r.tier}`, `priority ${r.priority}`, r.about ?? ''])),
  table('Facts', allFacts().map((f) => [f.factName])),
  table('Behaviours', allBehaviours().map((b) => [b.category, b.type])),
  table('Systems', allSystems().map((s) => [s.id])),
  table('Scenarios', discovered.map((e) => [e.scenario.name, e.file, e.scenario.about ?? ''])),
  table('Style modules', allStyles().map((s) => [s.name, Object.keys(s.values).join(', ')])),
]);

root.append(
  el('div', { class: 'g-viewer' }, [el('aside', { class: 'g-side' }, [el('h1', { text: 'Little City gallery' }), filter, list]), stage, tuning]),
  registry,
);
renderList();

// Orbit controls: the same pointer reading as the game, with nothing to build.
attachPointer(canvas, {
  use() {},
  erase() {},
  orbit: (dx, dy) => view?.orbit(-dx * INPUT.orbitYaw, dy * INPUT.orbitPitch),
  pan: (dx, dy) => view?.pan(dx, dy),
  zoom: (factor, x, y) => view?.zoomBy(factor, x, y),
  hover() {},
  hoverEnd() {},
  runStart: () => false,
  runMove() {},
  runEnd() {},
  dragging(on) {
    canvas.style.cursor = on ? 'grabbing' : 'grab';
  },
});
window.addEventListener('resize', sizeView);
window.addEventListener('hashchange', () => {
  const next = entries.find((e) => e.id === location.hash.slice(1));
  if (next && next !== current) show(next);
});

show(entries.find((e) => e.id === location.hash.slice(1)) ?? entries.find((e) => e.id === 'scenario.hello-town') ?? entries[0]!);

let last = performance.now();
function frame(now: number): void {
  if (view && signals && life && built) {
    life.update(signals.advance((now - last) / 1000));
    view.render(signals);
  }
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

declare global {
  interface Window {
    __gallery?: unknown;
  }
}
window.__gallery = {
  entries: () => entries.map(({ id, group, label, note, file }) => ({ id, group, label, note, file })),
  show: (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (entry) show(entry);
    return entry !== undefined;
  },
  current: () => current?.id ?? null,
  problem: () => problem,
  blocks: () => built?.world.blocks.size ?? 0,
  get view() {
    return view;
  },
};
