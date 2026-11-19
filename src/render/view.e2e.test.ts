// The view in a real browser with WebGL: it draws ink on paper inside the
// draw-call budget, the dusk grade and lit windows work, lifting a
// structure and the ghost preview draw and undraw cleanly, and the
// half-resolution ink option gives the same picture with softer lines.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Page } from 'playwright';
import { startApp, type App } from '../../tests/helpers/browser';
import type { FrameSummary } from './testing/probe';

let app: App;
let page: Page;
let errors: string[];

beforeAll(async () => {
  app = await startApp();
  ({ page, errors } = await app.open('/tools/shot/index.html', { width: 700, height: 460 }));
  await page.addScriptTag({ type: 'module', url: `${app.url}/src/render/testing/probe.ts` });
  await page.waitForFunction('window.__look !== undefined');
});
afterAll(async () => {
  await app?.close();
});

const look = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
/** A frame of the town at rest: the frame after a change also redraws the grounding map, this one does not. */
const settled = async (): Promise<FrameSummary> => {
  await look(`window.__look.frame()`);
  return look<FrameSummary>(`window.__look.frame()`);
};
const lum = (c: readonly number[]): number => 0.299 * c[0]! + 0.587 * c[1]! + 0.114 * c[2]!;
/** Mean absolute difference between two frames' thumbnails, 0–255. */
const differ = (a: FrameSummary, b: FrameSummary): number => a.thumb.reduce((sum, v, i) => sum + Math.abs(v - b.thumb[i]!), 0) / a.thumb.length;

describe('the view', () => {
  test('draws ink on paper, in a dozen draw calls', async () => {
    await look(`window.__look.open('look-island', { ink: 'full' })`);
    const f = await look<FrameSummary>(`window.__look.frame()`);
    expect(f.width).toBe(640);
    // Bare paper in the corners: the palette's cream, give or take the grain.
    for (const c of f.corners) {
      expect(Math.abs(c[0]! - 0xf2)).toBeLessThan(28);
      expect(Math.abs(c[1]! - 0xed)).toBeLessThan(28);
      expect(Math.abs(c[2]! - 0xe3)).toBeLessThan(28);
    }
    // Ink: some of the picture is line, most of it is not.
    expect(f.dark).toBeGreaterThan(0.003);
    expect(f.dark).toBeLessThan(0.2);
    // The sea is blue and the picture is not blank.
    expect(f.mean[2]).toBeGreaterThan(f.mean[0]);
    // The first frame also draws the grounding map (the town from above); after that, a dozen calls.
    expect(f.drawCalls).toBeLessThanOrEqual(28);
    expect(f.triangles).toBeGreaterThan(50_000);
    // The same moment drawn again is the same picture: the pen does not boil.
    const again = await look<FrameSummary>(`window.__look.frame()`);
    expect(again.thumb).toEqual(f.thumb);
    expect(again.drawCalls).toBeLessThanOrEqual(16);
    expect(errors).toEqual([]);
  });

  test('night darkens the page, keeps the line darker still, and lights the windows', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full', camera: 4 })`);
    const day = await look<FrameSummary>(`window.__look.frame()`);
    await look(`window.__look.time('dusk')`);
    const dusk = await look<FrameSummary>(`window.__look.frame()`);
    await look(`window.__look.time('night')`);
    const night = await look<FrameSummary>(`window.__look.frame()`);
    // On a page this dark, the only bright warm pixels are lit windows and lamps.
    expect(night.warm).toBeGreaterThan(300);
    expect(lum(night.mean)).toBeLessThan(lum(day.mean) * 0.6);
    expect(night.mean[2]).toBeGreaterThan(night.mean[0] * 1.3); // blue-violet
    expect(dusk.mean[0] / dusk.mean[2]).toBeGreaterThan(day.mean[0] / day.mean[2]); // warmer than day
    expect(night.dark).toBeGreaterThan(0.003); // the ink is still there
    expect(errors).toEqual([]);
  });

  test('a lifted structure moves without a rebuild and bakes back exactly', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full', camera: 5 })`);
    const before = await settled();
    expect(await look<boolean>(`window.__look.lift(2.5)`)).toBe(true);
    const up = await settled();
    expect(differ(up, before)).toBeGreaterThan(0.3);
    expect(up.drawCalls).toBe(before.drawCalls); // no extra mesh: its vertices were re-pointed at a slot
    await look(`window.__look.release()`);
    const after = await settled();
    expect(after.thumb).toEqual(before.thumb);
    expect(await look<number>(`window.__look.rebuildMs()`)).toBeLessThan(8);
  });

  test('props are instances: hiding them changes the picture, showing them restores it', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full', camera: 4 })`);
    const before = await settled();
    expect(await look<number>(`window.__look.props(false)`)).toBeGreaterThan(3);
    const hidden = await settled();
    expect(differ(hidden, before)).toBeGreaterThan(0.02);
    await look(`window.__look.props(true)`);
    expect((await settled()).thumb).toEqual(before.thumb);
  });

  test('the ghost preview is drawn over the page and clears without a trace', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full', camera: 5 })`);
    const before = await settled();
    await look(`window.__look.ghost(true)`);
    const ghost = await settled();
    expect(ghost.drawCalls).toBeGreaterThan(before.drawCalls);
    expect(ghost.drawCalls).toBeLessThanOrEqual(before.drawCalls + 2);
    expect(differ(ghost, before)).toBeGreaterThan(0.05);
    // The ghost is a pencil sketch: with its lines switched off (zero ink width) it is fainter.
    await look(`window.__look.style('look', 'inkWidth', 0.01)`);
    await look(`window.__look.style('look', 'inkWidthFar', 0.01)`);
    const unlined = await settled();
    await look(`window.__look.ghost(false)`);
    const unlinedBare = await settled();
    await look(`window.__look.style()`);
    await look(`window.__look.ghost(true)`);
    expect(differ(ghost, before)).toBeGreaterThan(differ(unlined, unlinedBare) * 1.1);
    await look(`window.__look.ghost(false)`);
    const after = await settled();
    expect(after.thumb).toEqual(before.thumb);
    expect(after.drawCalls).toBe(before.drawCalls);
    expect(errors).toEqual([]);
  });

  test('half-resolution ink (the phone option) draws the same picture with softer lines', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full', pixelRatio: 2 })`);
    const full = await settled();
    await look(`window.__look.open('look-primitives', { ink: 'half', pixelRatio: 2 })`);
    const half = await settled();
    expect(half.width).toBe(1280);
    expect(differ(half, full)).toBeLessThan(6);
    expect(half.dark).toBeGreaterThan(full.dark * 0.25);
    expect(half.drawCalls).toBe(full.drawCalls + 1); // the ink mask pass
    expect(errors).toEqual([]);
  });

  test('grounding: pieces sit in a soft shade of their own, at no cost once the town is still', async () => {
    // From the north-west, the shadow side faces the viewer.
    await look(`window.__look.open('look-primitives', { ink: 'full' })`);
    await look(`window.__look.camera({ yaw: 215, pitch: 30, zoom: 7.5, target: [21, 1.5, 24.5] })`);
    const grounded = await settled();
    await look(`window.__look.style('look', 'ground', 0)`);
    const bare = await settled();
    await look(`window.__look.style()`);
    // The shade darkens the picture a little overall and changes it visibly where pieces stand ...
    expect(differ(grounded, bare)).toBeGreaterThan(0.4);
    expect(lum(grounded.mean)).toBeLessThan(lum(bare.mean) - 0.5);
    // ... but gently: this is a pencilled tone, not a black shadow.
    expect(lum(grounded.mean)).toBeGreaterThan(lum(bare.mean) - 12);
    expect(grounded.dark).toBeLessThan(bare.dark * 1.25 + 0.002);
    // It is baked only when something changes: a still town draws the same dozen calls with it or without.
    expect(grounded.drawCalls).toBe(bare.drawCalls);
    // At dusk the light is low and the cast shade reaches further.
    await look(`window.__look.time('dusk')`);
    const dusk = await settled();
    await look(`window.__look.style('look', 'ground', 0)`);
    const duskBare = await settled();
    await look(`window.__look.style()`);
    expect(lum(duskBare.mean) - lum(dusk.mean)).toBeGreaterThan(lum(bare.mean) - lum(grounded.mean));
    expect(errors).toEqual([]);
  });

  test('a changed style value redraws the town (the tuning panel), and life keeps its handles', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full' })`);
    const before = await settled();
    // A palette colour is baked into the meshes: the view rebuilds them by itself, with no setTown.
    await look(`window.__look.style('palette', 'grass', '#e0503c')`);
    const red = await settled();
    expect(red.mean[0] - red.mean[1]).toBeGreaterThan(before.mean[0] - before.mean[1] + 15);
    // Props kept their slots through the rebuild: the handles life holds still work.
    expect(await look<number>(`window.__look.props(false)`)).toBeGreaterThan(3);
    const hidden = await settled();
    expect(differ(hidden, red)).toBeGreaterThan(0.01);
    await look(`window.__look.props(true)`);
    // Putting the value back gives exactly the first picture.
    await look(`window.__look.style()`);
    expect((await settled()).thumb).toEqual(before.thumb);
    // A value only the page reads (ink width) changes the picture too, with no rebuild at all.
    await look(`window.__look.style('look', 'inkWidth', 3)`);
    await look(`window.__look.style('look', 'inkWidthFar', 3)`);
    const thick = await settled();
    expect(thick.dark).toBeGreaterThan(before.dark * 1.2);
    await look(`window.__look.style()`);
    expect((await settled()).thumb).toEqual(before.thumb);
    expect(errors).toEqual([]);
  });

  test('hatching belongs to the surface: it does not pop where its spacing halves as the view zooms in', async () => {
    // The stroke spacing halves each time the zoom doubles (here at 64 CSS pixels per unit: zoom 7.68 at
    // this size). Old strokes stay where they are and new ones fade in between, so a hair either side of
    // that zoom the picture is the same, just as it is for a hair's change anywhere else.
    await look(`window.__look.open('look-primitives', { ink: 'full' })`);
    const at = async (zoom: number): Promise<FrameSummary> => {
      await look(`window.__look.camera({ yaw: 215, pitch: 30, zoom: ${zoom}, target: [21, 1.5, 24.5] })`);
      return settled();
    };
    const across = differ(await at(7.675), await at(7.685));
    const elsewhere = differ(await at(7.2), await at(7.21));
    expect(across).toBeLessThan(elsewhere * 1.5 + 0.05);
  });

  test('line weight answers to zoom: up close the lines inside a shape are finer than its outline; far off nothing changes', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full', pixelRatio: 2 })`);
    const inkAt = async (zoom: number, inner: number | null): Promise<number> => {
      await look(`window.__look.style()`);
      if (inner !== null) await look(`window.__look.style('look', 'inkWidthInner', ${inner})`);
      await look(`window.__look.camera({ yaw: 45, pitch: 30, zoom: ${zoom}, target: [21, 1.5, 24.5] })`);
      return (await settled()).dark;
    };
    // Close (zoom 12: a house fills the view). With the interior as heavy as the outline there is clearly more ink.
    const fine = await inkAt(12, null), heavy = await inkAt(12, 1.5);
    expect(fine).toBeLessThan(heavy * 0.85);
    // The outline is still there: thinning the interior further removes little more.
    expect(await inkAt(12, 0.4)).toBeGreaterThan(fine * 0.6);
    // At the overview the interior width plays no part: the picture is inked exactly as before.
    expect(await inkAt(1.6, 0.4)).toBe(await inkAt(1.6, 1.5));
    await look(`window.__look.style()`);
    expect(errors).toEqual([]);
  });

  test('actors and spawned things move without redrawing the grounding picture; a moved prop redraws it', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full' })`);
    const rest = (await settled()).drawCalls;
    expect(await look<number>(`window.__look.spawn(60)`)).toBe(60);
    await settled();
    // Sixty things moving every frame: one more draw call (their pool) and nothing else, ever.
    const walking = await look<{ ms: number; drawCalls: number }>(`window.__look.moving('spawned', 30)`);
    expect(walking.drawCalls).toBe(rest + 1);
    // A prop stands in the picture (it throws shade), so moving one redraws it, every other frame at most.
    const sliding = await look<{ ms: number; drawCalls: number }>(`window.__look.moving('prop', 30)`);
    expect(sliding.drawCalls).toBeGreaterThan(rest + 3);
    expect(sliding.drawCalls).toBeLessThanOrEqual(rest + 1 + (rest + 2) / 2 + 1);
    expect(errors).toEqual([]);
  });

  test('flat ground and open sea never ink over, however far out or low the view (phone, half ink)', async () => {
    for (const ink of ['half', 'full']) {
      await look(`window.__look.open('look-isle-1', { ink: '${ink}', pixelRatio: 2, width: 390, height: 844 })`);
      await look(`window.__look.camera({ zoom: 0.01, pitch: 35, yaw: 45, target: [24, 1, 24] })`);
      const far = await look<FrameSummary>(`window.__look.frame()`);
      expect(far.dark, `${ink}, far`).toBeLessThan(0.02);
      await look(`window.__look.camera({ zoom: 0.8, pitch: 10, yaw: 100, target: [24, 1, 40] })`);
      const low = await look<FrameSummary>(`window.__look.frame()`);
      expect(low.dark, `${ink}, low`).toBeLessThan(0.05);
    }
    expect(errors).toEqual([]);
  });

  test('no stray ink along the edge of the frame where the sea runs off-screen', async () => {
    // The depth test reads either side of each pixel. At the frame's edge one side used to be missing,
    // which read as a jump in depth on any sloping surface and drew a row of scribble along the edge.
    // Here the whole frame is open sea: there is nothing to outline, so there must be no ink at all.
    for (const [ink, ratio] of [['full', 1], ['full', 2], ['half', 2]] as const) {
      await look(`window.__look.open('look-primitives', { ink: '${ink}', pixelRatio: ${ratio} })`);
      for (const pose of ['{ pitch: 32, yaw: 45 }', '{ pitch: 25, yaw: 225 }', '{ pitch: 75, yaw: 300 }']) {
        await look(`window.__look.camera({ ...${pose}, zoom: 9, target: [39, 0, 39] })`);
        const f = await look<FrameSummary>(`window.__look.frame(2)`);
        expect(f.border, `${ink} @${ratio}x ${pose}: frame edge`).toBeLessThan(0.002);
        expect(f.dark, `${ink} @${ratio}x ${pose}: whole frame`).toBeLessThan(0.002);
      }
    }
    expect(errors).toEqual([]);
  });

  test('orbit, pan and zoom glide: the pose moves toward the goal over a few frames', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full' })`);
    const still = await look<FrameSummary>(`window.__look.frame(0.1)`);
    await look(`window.__look.orbit(40, 0)`);
    const first = await look<FrameSummary>(`window.__look.frame(1 / 30)`);
    const settled = await look<FrameSummary>(`window.__look.frame(2)`);
    expect(differ(first, still)).toBeGreaterThan(0.2); // it has started to turn
    expect(differ(settled, first)).toBeGreaterThan(0.2); // and had further to go
    const rest = await look<FrameSummary>(`window.__look.frame(0)`);
    expect(differ(rest, settled)).toBeLessThan(0.01);
    await look(`window.__look.close()`);
    expect(errors).toEqual([]);
  });
});
