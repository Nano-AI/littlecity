// The page `npm run guide` drives: renders each guide entry's recipe town
// (src/guide/entries.ts) by day, with people, birds and boats left out so
// the pictures never change by chance, frames it tightly, and cuts it out
// as a soft-edged vignette on a transparent background.
//
// Uses only TownView, Signals, LifeRuntime and the scenario builder, like
// tools/shot.

import { CELL_H, keyX, keyY, keyZ, unedge } from '@/core/grid';
import { hash } from '@/core/rand';
import type { World } from '@/core/world';
import { ENTRIES, guideScenario, type GuideEntry } from '@/guide/entries';
import type { LifeRuntime, SignalsDriver } from '@/life/api';
import { createLife } from '@/life/runtime';
import { createSignals } from '@/life/signals';
import type { CameraPose, TownView } from '@/render/api';
import { frameOf, panPose, project, zoomPose } from '@/render/camera';
import { createTownView } from '@/render/index';
import { resolveDressing, resolveShape } from '@/resolve/index';
import type { DressingPlan } from '@/resolve/plan';
import { buildScenario } from '@/scenario';

/** Actors that move about by chance: left out of the pictures. */
const RESTLESS = new Set<string>([
  'resident', 'figure', 'gull', 'pigeon', 'swift', 'small-bird', 'bird-wing', 'cat', 'insect', 'leaf', 'firefly', 'cloud', 'balloon',
  'rowboat', 'sailboat', 'fishing-boat', 'boat-sail', 'mooring-line', 'sheep', 'chicken',
]);

/** Wild tufts and beach finds strewn over open ground: at thumbnail size they read as specks of dirt. */
const SCATTER = 'D24.';

const canvas = document.getElementById('town') as HTMLCanvasElement;
let view: TownView | null = null;
let life: LifeRuntime | null = null;
let signals: SignalsDriver | null = null;

const nextFrame = (): Promise<number> => new Promise((r) => requestAnimationFrame(r));

/** The world-space box round everything the recipe placed, padded by `pad` cells. */
function boxOf(entry: GuideEntry, world: World): { lo: [number, number, number]; hi: [number, number, number] } {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const see = (k: number, top: number, xa = keyX(k), xb = keyX(k) + 1, za = keyZ(k), zb = keyZ(k) + 1): void => {
    x0 = Math.min(x0, xa); x1 = Math.max(x1, xb);
    z0 = Math.min(z0, za); z1 = Math.max(z1, zb);
    y0 = Math.min(y0, keyY(k)); y1 = Math.max(y1, keyY(k) + top);
  };
  // Roofs, spires and lanterns rise above a block's cell; floors, fences and walls stay low.
  for (const k of world.blocks.keys()) see(k, 2.1);
  for (const k of world.floors.keys()) see(k, 0.6);
  for (const e of world.edges.keys()) {
    // An edge piece stands on the east or south side of its cell.
    const { cell, side } = unedge(e);
    const x = keyX(cell), z = keyZ(cell);
    if (side === 'E') see(cell, 0.6, x + 1, x + 1, z, z + 1);
    else see(cell, 0.6, x, x + 1, z + 1, z + 1);
  }
  const pad = entry.pad ?? 0.4;
  if (entry.frame) {
    // A part of the recipe chosen by the entry (the castle's gate, where its people are).
    const [fx0, fz0, fx1, fz1, top] = entry.frame;
    return { lo: [fx0 - pad, y0 * CELL_H, fz0 - pad], hi: [fx1 + 1 + pad, (y0 + top) * CELL_H, fz1 + 1 + pad] };
  }
  return { lo: [x0 - pad, y0 * CELL_H, z0 - pad], hi: [x1 + pad, y1 * CELL_H, z1 + pad] };
}

/**
 * The pose that fits the box in the view, leaving `margin` of it free on each side (worked out on
 * paper, then set at once). `wanted` > 1 means the camera's closest zoom still leaves the box that
 * much too small.
 */
function fit(start: CameraPose, box: ReturnType<typeof boxOf>, width: number, height: number, margin: number): { pose: CameraPose; wanted: number } {
  let pose = start;
  let wanted = 1;
  for (let pass = 0; pass < 4; pass++) {
    const f = frameOf(pose, width, height);
    let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
    for (const x of [box.lo[0], box.hi[0]]) {
      for (const y of [box.lo[1], box.hi[1]]) {
        for (const z of [box.lo[2], box.hi[2]]) {
          const [px, py] = project(f, [x, y, z], width, height);
          sx0 = Math.min(sx0, px); sx1 = Math.max(sx1, px); sy0 = Math.min(sy0, py); sy1 = Math.max(sy1, py);
        }
      }
    }
    pose = panPose(pose, width / 2 - (sx0 + sx1) / 2, height / 2 - (sy0 + sy1) / 2, width, height);
    const scale = Math.min((width * (1 - 2 * margin)) / (sx1 - sx0), (height * (1 - 2 * margin)) / (sy1 - sy0));
    const before = pose.zoom;
    pose = zoomPose(pose, scale, width, height, width / 2, height / 2);
    wanted = (before * scale) / pose.zoom;
  }
  return { pose, wanted };
}

/** A soft, slightly wobbly rounded-square vignette, the same for an entry every time. */
function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, seed: string): void {
  const s = hash(0, 'guide', seed);
  const wob = (i: number): number => ((hash(s, i) % 1000) / 1000 - 0.5) * 2;
  const feather = Math.round(Math.min(w, h) * 0.035);
  const cx = w / 2, cy = h / 2, rx = w / 2 - feather * 1.6, ry = h / 2 - feather * 1.6;
  const a1 = wob(1) * 0.012, a2 = wob(2) * 0.01, p1 = wob(3) * Math.PI, p2 = wob(4) * Math.PI;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.filter = `blur(${feather}px)`;
  ctx.beginPath();
  const n = 160;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const c = Math.cos(t), sn = Math.sin(t);
    // A superellipse (exponent 5): nearly square, with rounded corners.
    const e = 2 / 5;
    const r = 1 + a1 * Math.sin(3 * t + p1) + a2 * Math.sin(5 * t + p2);
    const x = cx + rx * r * Math.sign(c) * Math.abs(c) ** e;
    const y = cy + ry * r * Math.sign(sn) * Math.abs(sn) ** e;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

const api = {
  ids: (): string[] => ENTRIES.map((e) => e.id),

  /** Renders one entry and returns it as a data URL (image/webp unless `type` says otherwise). */
  async render(id: string, opts: { quality?: number; type?: string; margin?: number; settle?: number } = {}): Promise<string> {
    const entry = ENTRIES.find((e) => e.id === id);
    if (!entry) throw new Error(`no guide entry '${id}'`);
    const scn = guideScenario(entry);
    const built = buildScenario(scn);
    const shape = resolveShape(built.world, built.terrain);
    const full = resolveDressing(shape);
    const dressing: DressingPlan = {
      ...full,
      props: full.props.filter((p) => !p.rule.startsWith(SCATTER)),
      actors: full.actors.filter((a) => !RESTLESS.has(a.type)),
    };

    // One view for every picture: a fresh WebGL context per picture would draw its first
    // frames before its shaders are ready.
    life?.dispose();
    const width = window.innerWidth, height = window.innerHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    view ??= createTownView(canvas, { preserveDrawingBuffer: true, pixelRatio: window.devicePixelRatio });
    view.resize(width, height);
    signals = createSignals(scn.seed);
    signals.hold('day');
    life = createLife(view.stage, signals);
    view.setTown(shape, dressing);
    life.sync({ shape, dressing });

    const box = boxOf(entry, built.world);
    const centre: [number, number, number] = [(box.lo[0] + box.hi[0]) / 2, (box.lo[1] + box.hi[1]) / 2 / CELL_H, (box.lo[2] + box.hi[2]) / 2];
    const start: CameraPose = { yaw: entry.view.yaw, pitch: entry.view.pitch, zoom: 6, target: centre };
    const margin = opts.margin ?? 0.07;
    let fitted = fit(start, box, width, height, margin);
    if (fitted.wanted > 1.02) {
      // Small things: the camera will not come closer, so draw a bigger canvas and keep its middle.
      const w = Math.round(width * Math.min(3, fitted.wanted)), h = Math.round(height * Math.min(3, fitted.wanted));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      view.resize(w, h);
      fitted = fit(start, box, w, h, margin);
    }
    view.setCamera(fitted.pose);

    const steps = Math.round((opts.settle ?? entry.life?.settle ?? 2) * 30);
    for (let i = 0; i < steps; i++) life.update(signals.advance(1 / 30));
    for (let i = 0; i < 6; i++) {
      view.render(signals);
      await nextFrame();
    }

    const out = document.createElement('canvas');
    out.width = Math.round(width * window.devicePixelRatio);
    out.height = Math.round(height * window.devicePixelRatio);
    const ctx = out.getContext('2d')!;
    ctx.drawImage(canvas, (canvas.width - out.width) / 2, (canvas.height - out.height) / 2, out.width, out.height, 0, 0, out.width, out.height);
    vignette(ctx, out.width, out.height, entry.id);
    return out.toDataURL(opts.type ?? 'image/webp', opts.quality ?? 0.8);
  },
};

declare global {
  interface Window {
    __guide?: typeof api;
  }
}
window.__guide = api;
