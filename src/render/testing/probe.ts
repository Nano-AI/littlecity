// TEST SUPPORT (Look). A page-side handle for browser tests of the view:
// load it in a page of the dev server and drive it with page.evaluate.
//
//   await page.evaluate(() => import('/src/render/testing/probe.ts'));
//   await page.evaluate(() => window.__look.open('look-primitives', { ink: 'full' }));
//   const frame = await page.evaluate(() => window.__look.frame());
//
// It is not part of the app: nothing imports it but the tests.

import { columnIndex, keyX, keyZ } from '@/core/grid';
import { translation } from '@/core/mat4';
import { resetStyles, setStyle, type StyleValue } from '@/core/style';
import { MeshBuilder } from '@/gen/mesh';
import type { DayPart, InstanceHandle } from '@/life/api';
import { createSignals, type TownSignals } from '@/life/signals';
import { applyCalendar } from '@/life/season';
import type { Edit, World } from '@/core/world';
import type { ResolveOptions } from '@/resolve/engine/api';
import { resolveDressing, resolveShape } from '@/resolve/index';
import type { DressingPlan, ShapePlan, Structure } from '@/resolve/plan';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { applyEdit, canApply } from '@/world/world';
import type { EyePose, CameraPose, TownView, ViewOptions } from '../api';
import { createTownView } from '../index';
import { sameKeys } from '../rebuild-budget';

export interface FrameSummary {
  drawCalls: number;
  triangles: number;
  width: number;
  height: number;
  /** Mean colour, 0–255. */
  mean: [number, number, number];
  /** Share of pixels dark enough to be ink. */
  dark: number;
  /** Pixels that are bright and warm: lit windows and lamps. */
  warm: number;
  /** Share of ink-dark pixels in the outermost three rows and columns of the frame. */
  border: number;
  /** The four corner pixels (bare paper in most views). */
  corners: [number, number, number][];
  /** A coarse copy of the picture (COLS × ROWS cells, rgb), for comparing two frames. */
  thumb: number[];
}

const COLS = 32, ROWS = 20;

let view: TownView | null = null;
let signals: TownSignals | null = null;
let canvas: HTMLCanvasElement | null = null;
let shape: ShapePlan | null = null;
let options: ResolveOptions | null = null;
let dressing: DressingPlan | null = null;
let lifted: InstanceHandle | null = null;
let spawned: InstanceHandle[] = [];

function summary(): FrameSummary {
  const gl = canvas!.getContext('webgl2')!;
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let r = 0, g = 0, b = 0, dark = 0, warm = 0, border = 0, borderDark = 0;
  const thumb = new Float64Array(COLS * ROWS * 3);
  const counts = new Float64Array(COLS * ROWS);
  for (let y = 0; y < h; y++) {
    const row = Math.min(ROWS - 1, Math.floor(((h - 1 - y) / h) * ROWS));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const pr = px[i]!, pg = px[i + 1]!, pb = px[i + 2]!;
      r += pr;
      g += pg;
      b += pb;
      const isDark = 0.299 * pr + 0.587 * pg + 0.114 * pb < 95;
      if (isDark) dark++;
      if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3) {
        border++;
        if (isDark) borderDark++;
      }
      if (pr > 225 && pg > 185 && pb < 170 && pr - pb > 70) warm++;
      const cell = row * COLS + Math.min(COLS - 1, Math.floor((x / w) * COLS));
      thumb[cell * 3] += pr;
      thumb[cell * 3 + 1] += pg;
      thumb[cell * 3 + 2] += pb;
      counts[cell]++;
    }
  }
  const n = w * h;
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 4;
    return [px[i]!, px[i + 1]!, px[i + 2]!];
  };
  const stats = view!.stats();
  return {
    drawCalls: stats.drawCalls,
    triangles: stats.triangles,
    width: w,
    height: h,
    mean: [r / n, g / n, b / n],
    dark: dark / n,
    warm,
    border: borderDark / Math.max(1, border),
    corners: [at(2, 2), at(w - 3, 2), at(2, h - 3), at(w - 3, h - 3)],
    thumb: [...thumb].map((v, i) => Math.round(v / counts[Math.floor(i / 3)]!)),
  };
}

/**
 * The town as opened, every cell of its first `n` houses at this packed ruin, and the land a level
 * down under `sunk` more houses after those, the first whose land can go down (a 'land' edit carries
 * what stands on it).
 */
function damaged(n: number, ruin: number, sunk: number): World {
  const houses = [...shape!.structures.values()].filter((s) => s.kind === 'house');
  const t = shape!.terrain;
  let world = shape!.world;
  for (const s of houses.slice(0, n)) for (const cell of s.cells) world = applyEdit(world, t, { type: 'setRuin', cell, ruin });
  if (sunk === 0) return world;
  const under = (ss: readonly Structure[]): Edit => ({ type: 'land', up: [], down: [...new Set(ss.flatMap((s) => s.cells.map((c) => columnIndex(keyX(c), keyZ(c)))))] });
  return applyEdit(world, t, under(houses.slice(n).filter((s) => canApply(world, t, under([s])).ok).slice(0, sunk)));
}

const api = {
  /** Shows a scenario in a fresh view. */
  open(name: string, opts: ViewOptions & { width?: number; height?: number; camera?: number } = {}): number {
    const scn = findScenario(name);
    if (!scn) throw new Error(`no scenario named '${name}'`);
    view?.dispose();
    canvas?.remove();
    lifted = null;
    spawned = [];
    const width = opts.width ?? 640, height = opts.height ?? 400;
    canvas = document.createElement('canvas');
    canvas.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px`;
    document.body.appendChild(canvas);
    view = createTownView(canvas, { pixelRatio: 1, ...opts, preserveDrawingBuffer: true });
    view.resize(width, height);
    signals = createSignals(scn.seed);
    // Summer and a clear sky, held: the view's tests measure the town as it always looked.
    applyCalendar(signals, 'summer', 'clear', true);
    const built = buildScenario(scn);
    options = scenarioResolveOptions(scn);
    shape = resolveShape(built.world, built.terrain, options);
    dressing = resolveDressing(shape, options);
    view.setTown(shape, dressing);
    view.setCamera(built.cameras[opts.camera ?? 0]!);
    return shape.structures.size;
  },
  /** Advances life time (0 keeps the frame identical), draws, and reads the picture back. */
  frame(seconds = 0): FrameSummary {
    for (let t = 0; t < seconds; t += 1 / 30) signals!.advance(1 / 30);
    view!.render(signals!);
    return summary();
  },
  /** Advances and draws without reading the picture back (for timing). */
  frameOnly(seconds = 0): void {
    for (let t = 0; t < seconds; t += 1 / 30) signals!.advance(Math.min(1 / 30, seconds));
    view!.render(signals!);
  },
  /**
   * One edit at a time, as a player makes them: a house (or Auto) block on a column where one is
   * legal, a different column each time. Returns, per edit, the time in resolveShape, in setTown, and where
   * setTown spent it (ViewStats.rebuild), plus the cost of the frame that follows.
   */
  editBench(edits = 30, kind: 'house' | 'auto' = 'house'): { shapeMs: number; rebuildMs: number; frameMs: number; generators: number; layers: number; parts: number; view: number; structures: number; vertices: number; dressingMs: number; dressMs: number; dressParts: number; dressView: number; items: number }[] {
    const out = [];
    let world = shape!.world;
    const terrain = shape!.terrain;
    const gl = canvas!.getContext('webgl2')!;
    const px = new Uint8Array(4);
    for (let i = 0, tries = 0; out.length < edits && tries < edits * 40; tries++, i++) {
      const x = 5 + ((i * 7) % 38), z = 5 + ((i * 11) % 38);
      let y = terrain.height[x + z * 48]!;
      while (world.blocks.has(x | (z << 6) | (y << 12))) y++;
      const edit: Edit = { type: 'placeBlock', cell: x | (z << 6) | (y << 12), kind, color: 'auto', from: world.blocks.has(x | (z << 6) | ((y - 1) << 12)) ? x | (z << 6) | ((y - 1) << 12) : null };
      if (y < 1 || !canApply(world, terrain, edit).ok) continue;
      world = applyEdit(world, terrain, edit);
      const a = performance.now();
      const next = resolveShape(world, terrain, options ?? {});
      const b = performance.now();
      view!.setTown(next, null);
      const stats = view!.stats();
      const c = performance.now();
      signals!.advance(1 / 60);
      view!.render(signals!);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const frameMs = performance.now() - c;
      // Then the dressing arrives, as it does in the game a moment after the edit.
      const d0 = performance.now();
      dressing = resolveDressing(next, options ?? {});
      const d1 = performance.now();
      view!.setDressing(dressing);
      const dress = view!.stats();
      out.push({ shapeMs: b - a, rebuildMs: stats.rebuildMs, frameMs, ...stats.rebuild!, dressingMs: d1 - d0, dressMs: dress.rebuildMs, dressParts: dress.rebuild!.parts, dressView: dress.rebuild!.view, items: dressing.props.length + dressing.actors.length });
      shape = next;
    }
    return out;
  },
  /**
   * Mischief: gives every cell of the first `n` houses this packed ruin (packRuin) and shows the town,
   * spread over frames or not. Each call starts from the town as opened. Returns ViewStats.pending.
   */
  ruinHouses(n: number, ruin: number, spread: boolean): number {
    view!.setTown(resolveShape(damaged(n, ruin, 0), shape!.terrain, options ?? {}), null, { spread });
    return view!.stats().pending;
  },
  /**
   * A nuke in small: as ruinHouses, and the land under `sunk` more houses goes down a level, carrying
   * them (see damaged). Then the dressing for that town arrives, before any frame. Returns ViewStats.pending
   * as the setTown left it, `moved` (structures that changed and lost their cells or edges: none of
   * these may wait) and `stayed` (those that changed in place: the most that may).
   */
  crater(n: number, ruin: number, sunk: number, spread: boolean): { pending: number; moved: number; stayed: number } {
    const next = resolveShape(damaged(n, ruin, sunk), shape!.terrain, options ?? {});
    view!.setTown(next, null, { spread });
    const pending = view!.stats().pending;
    view!.setDressing(resolveDressing(next, options ?? {}));
    let moved = 0, stayed = 0;
    for (const s of next.structures.values()) {
      const was = shape!.structures.get(s.id);
      if (!was || was.hash === s.hash) continue;
      if (sameKeys(was.cells, s.cells) && sameKeys(was.edges, s.edges)) stayed++;
      else moved++;
    }
    return { pending, moved, stayed };
  },
  /** Structures whose new drawing is still waiting (ViewStats.pending). */
  pending: (): number => view!.stats().pending,
  /** Spawns `n` small boxes over the town, as life spawns walkers and puffs. */
  spawn(n: number): number {
    const b = new MeshBuilder({ ink: 'probe' }).setColor('#e56b58');
    b.boxAt([0, 0, 0], [0.16, 0.42, 0.16]);
    const mesh = b.build();
    for (let i = 0; i < n; i++) spawned.push(view!.stage.spawnMesh(mesh, translation(8 + ((i * 7) % 32), 0.8, 8 + ((i * 13) % 32))));
    return spawned.length;
  },
  /** Luminance (0–255) of a box of the last frame, row by row from its top-left corner (CSS pixels at ratio 1). */
  luminance(x: number, y: number, w: number, h: number): number[] {
    const gl = canvas!.getContext('webgl2')!;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(x, gl.drawingBufferHeight - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const out: number[] = [];
    for (let row = h - 1; row >= 0; row--) for (let col = 0; col < w; col++) {
      const i = (row * w + col) * 4;
      out.push(0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!);
    }
    return out;
  },
  /** Moves every spawned box to where it would be at time `t` (a little circle each). */
  moveSpawned(t: number): void {
    spawned.forEach((h, i) => h.setMatrix(translation(8 + ((i * 7) % 32) + Math.cos(t + i) * 0.5, 0.8, 8 + ((i * 13) % 32) + Math.sin(t + i) * 0.5)));
  },
  /** Moves the first prop sideways by `dx` from its resting place (props stand in the grounding picture). */
  moveProp(dx: number): boolean {
    const h = dressing!.props.length > 0 ? view!.stage.instance(dressing!.props[0]!.id) : null;
    if (!h) return false;
    const m = Array.from(h.base);
    m[12] = m[12]! + dx;
    h.setMatrix(m);
    return true;
  },
  /**
   * Whole-frame time (CPU and GPU, synced by a pixel read) over `frames` frames while `mode` moves:
   * nothing, the spawned boxes, or one prop. Returns the median and the mean draw calls per frame.
   */
  moving(mode: 'still' | 'spawned' | 'prop', frames = 120): { ms: number; drawCalls: number } {
    const gl = canvas!.getContext('webgl2')!;
    const px = new Uint8Array(4);
    const times: number[] = [];
    let calls = 0;
    for (let i = 0; i < frames + 10; i++) {
      const t0 = performance.now();
      signals!.advance(1 / 60);
      if (mode === 'spawned') api.moveSpawned(i / 20);
      if (mode === 'prop') api.moveProp(Math.sin(i / 20) * 0.3);
      view!.render(signals!);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (i >= 10) {
        times.push(performance.now() - t0);
        calls += view!.stats().drawCalls;
      }
    }
    times.sort((a, b) => a - b);
    return { ms: times[Math.floor(times.length / 2)]!, drawCalls: calls / frames };
  },
  /** Changes one style value, as the tuning panel does. No arguments puts every value back. */
  style(name?: string, key?: string, value?: StyleValue): void {
    if (name === undefined || key === undefined || value === undefined) resetStyles();
    else setStyle(name, key, value);
  },
  time(part: DayPart): void {
    signals!.hold(part);
  },
  /** Seasons: holds a season and weather and brings it in at once (design section 13a). */
  season(season: string | number, weather = 'clear'): void {
    applyCalendar(signals!, season, weather, true);
  },
  camera(pose: Partial<CameraPose>): void {
    view!.setCamera(pose);
  },
  /** Fly mode's perspective eye (or back to the orbit camera with null). */
  eye(pose: EyePose | null): void {
    view!.setEyeCamera(pose);
  },
  /**
   * A street to look down at eye level: the open floor cell with the longest straight run of open
   * floor ahead, its eye (world units, a little over a person's eyes) and the way along it (yaw).
   */
  street(): { eye: [number, number, number]; yaw: number; run: number } | null {
    const kinds = shape!.kinds;
    const floors = shape!.world.floors;
    const open = (k: number): boolean => floors.has(k) && !kinds.has(k) && !kinds.has(k + 4096);
    const dirs: [number, number, number][] = [[0, -1, 0], [1, 0, -90], [0, 1, 180], [-1, 0, 90]];
    let best: { k: number; n: number; yaw: number } | null = null;
    for (const k of floors.keys()) {
      if (!open(k)) continue;
      for (const [dx, dz, yaw] of dirs) {
        let n = 0, c = k;
        for (;;) {
          const x = (c & 63) + dx, z = ((c >> 6) & 63) + dz;
          if (x < 0 || z < 0 || x > 47 || z > 47) break;
          c = (c & ~4095) | x | (z << 6);
          if (!open(c)) break;
          n++;
        }
        if (!best || n > best.n) best = { k, n, yaw };
      }
    }
    if (!best) return null;
    return { eye: [(best.k & 63) + 0.5, (best.k >> 12) * 0.8 + 0.45, ((best.k >> 6) & 63) + 0.5], yaw: best.yaw, run: best.n };
  },
  orbit(dYaw: number, dPitch: number): CameraPose {
    view!.orbit(dYaw, dPitch);
    return view!.getCamera();
  },
  /** Lifts the first house out of its chunk and raises it by `dy` world units. */
  lift(dy: number): boolean {
    const s = [...shape!.structures.values()].find((x) => x.kind === 'house');
    if (!s) return false;
    lifted = view!.stage.liftStructure(s.id);
    lifted?.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, dy, 0, 1]);
    return lifted !== null;
  },
  release(): void {
    lifted?.release();
    lifted = null;
  },
  /**
   * Shows what the game's hover would: a what-if plan with a two-storey house placed two cells east of
   * the first house, that new house as the ghost, a shimmering cell and a refused cell beside it.
   * `false` clears the ghost.
   */
  ghost(on: boolean): void {
    if (!on) return view!.setGhost(null);
    const s = [...shape!.structures.values()].find((x) => x.kind === 'house')!;
    const base = Math.min(...s.cells);
    const at = base + 2;
    let world = shape!.world;
    for (const cell of [at, at + (1 << 12)]) {
      const edit: Edit = { type: 'placeBlock', cell, kind: 'house', color: 2, from: null };
      if (canApply(world, shape!.terrain, edit).ok) world = applyEdit(world, shape!.terrain, edit);
    }
    const plan = resolveShape(world, shape!.terrain, options ?? {});
    const id = plan.structureAt.get(at);
    view!.setGhost({ plan, show: id === undefined ? [s.id] : [id], shimmer: [base + 4], refuse: base + 5 });
  },
  /** Hides every prop, or shows them again. Returns how many there are. */
  props(visible: boolean): number {
    let n = 0;
    for (const p of dressing!.props) {
      const h = view!.stage.instance(p.id);
      if (!h) continue;
      h.setVisible(visible);
      n++;
    }
    return n;
  },
  /** Hides every actor (people, birds, door leaves…), or shows them again. Returns how many there are. */
  actors(visible: boolean): number {
    let n = 0;
    for (const a of dressing!.actors) {
      const h = view!.stage.instance(a.id);
      if (!h) continue;
      h.setVisible(visible);
      n++;
    }
    return n;
  },
  /** Gives the view the same town again; returns the time it spent (nothing changed, so close to nothing). */
  rebuildMs(): number {
    view!.setTown(shape!, dressing);
    return view!.stats().rebuildMs;
  },
  /** Gives the view the same town again; returns what it rebuilt (nothing changed, so nothing): work, not time. */
  rebuildWork(): { structures: number; vertices: number } {
    view!.setTown(shape!, dressing);
    const r = view!.stats().rebuild;
    return { structures: r?.structures ?? -1, vertices: r?.vertices ?? -1 };
  },
  close(): void {
    view?.dispose();
    canvas?.remove();
    view = null;
    canvas = null;
  },
};

declare global {
  interface Window {
    __look?: typeof api;
  }
}
window.__look = api;
