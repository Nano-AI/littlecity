// TEST SUPPORT (Look). A page-side handle for browser tests of the view:
// load it in a page of the dev server and drive it with page.evaluate.
//
//   await page.evaluate(() => import('/src/render/testing/probe.ts'));
//   await page.evaluate(() => window.__look.open('look-primitives', { ink: 'full' }));
//   const frame = await page.evaluate(() => window.__look.frame());
//
// It is not part of the app: nothing imports it but the tests.

import type { DayPart, InstanceHandle, SignalsDriver } from '@/life/api';
import { createSignals } from '@/life/signals';
import { resolveDressing, resolveShape } from '@/resolve/index';
import type { DressingPlan, ShapePlan } from '@/resolve/plan';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import type { CameraPose, TownView, ViewOptions } from '../api';
import { createTownView } from '../index';

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
  /** The four corner pixels (bare paper in most views). */
  corners: [number, number, number][];
  /** A coarse copy of the picture (COLS × ROWS cells, rgb), for comparing two frames. */
  thumb: number[];
}

const COLS = 32, ROWS = 20;

let view: TownView | null = null;
let signals: SignalsDriver | null = null;
let canvas: HTMLCanvasElement | null = null;
let shape: ShapePlan | null = null;
let dressing: DressingPlan | null = null;
let lifted: InstanceHandle | null = null;

function summary(): FrameSummary {
  const gl = canvas!.getContext('webgl2')!;
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let r = 0, g = 0, b = 0, dark = 0, warm = 0;
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
      if (0.299 * pr + 0.587 * pg + 0.114 * pb < 95) dark++;
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
    corners: [at(2, 2), at(w - 3, 2), at(2, h - 3), at(w - 3, h - 3)],
    thumb: [...thumb].map((v, i) => Math.round(v / counts[Math.floor(i / 3)]!)),
  };
}

const api = {
  /** Shows a scenario in a fresh view. */
  open(name: string, opts: ViewOptions & { width?: number; height?: number; camera?: number } = {}): number {
    const scn = findScenario(name);
    if (!scn) throw new Error(`no scenario named '${name}'`);
    view?.dispose();
    canvas?.remove();
    lifted = null;
    const width = opts.width ?? 640, height = opts.height ?? 400;
    canvas = document.createElement('canvas');
    canvas.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px`;
    document.body.appendChild(canvas);
    view = createTownView(canvas, { pixelRatio: 1, ...opts, preserveDrawingBuffer: true });
    view.resize(width, height);
    signals = createSignals(scn.seed);
    const built = buildScenario(scn);
    const options = scenarioResolveOptions(scn);
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
  time(part: DayPart): void {
    signals!.hold(part);
  },
  camera(pose: Partial<CameraPose>): void {
    view!.setCamera(pose);
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
  /** Shows the first house as a ghost with a refused cell beside it, or clears the ghost. */
  ghost(on: boolean): void {
    if (!on) return view!.setGhost(null);
    const s = [...shape!.structures.values()].find((x) => x.kind === 'house')!;
    view!.setGhost({ plan: shape!, show: [s.id], shimmer: [s.cells[0]! + 2], refuse: s.cells[0]! + 3 });
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
  /** Gives the view the same town again; returns the time it spent (nothing changed, so close to nothing). */
  rebuildMs(): number {
    view!.setTown(shape!, dressing);
    return view!.stats().rebuildMs;
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
