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
    expect(f.drawCalls).toBeLessThanOrEqual(16);
    expect(f.triangles).toBeGreaterThan(50_000);
    // The same moment drawn again is the same picture: the pen does not boil.
    const again = await look<FrameSummary>(`window.__look.frame()`);
    expect(again.thumb).toEqual(f.thumb);
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
    const before = await look<FrameSummary>(`window.__look.frame()`);
    expect(await look<boolean>(`window.__look.lift(2.5)`)).toBe(true);
    const up = await look<FrameSummary>(`window.__look.frame()`);
    expect(differ(up, before)).toBeGreaterThan(0.3);
    expect(up.drawCalls).toBe(before.drawCalls); // no extra mesh: its vertices were re-pointed at a slot
    await look(`window.__look.release()`);
    const after = await look<FrameSummary>(`window.__look.frame()`);
    expect(after.thumb).toEqual(before.thumb);
    expect(await look<number>(`window.__look.rebuildMs()`)).toBeLessThan(8);
  });

  test('props are instances: hiding them changes the picture, showing them restores it', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full', camera: 4 })`);
    const before = await look<FrameSummary>(`window.__look.frame()`);
    expect(await look<number>(`window.__look.props(false)`)).toBeGreaterThan(3);
    const hidden = await look<FrameSummary>(`window.__look.frame()`);
    expect(differ(hidden, before)).toBeGreaterThan(0.02);
    await look(`window.__look.props(true)`);
    expect((await look<FrameSummary>(`window.__look.frame()`)).thumb).toEqual(before.thumb);
  });

  test('the ghost preview is drawn over the page and clears without a trace', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full', camera: 5 })`);
    const before = await look<FrameSummary>(`window.__look.frame()`);
    await look(`window.__look.ghost(true)`);
    const ghost = await look<FrameSummary>(`window.__look.frame()`);
    expect(ghost.drawCalls).toBeGreaterThan(before.drawCalls);
    expect(ghost.drawCalls).toBeLessThanOrEqual(before.drawCalls + 2);
    expect(differ(ghost, before)).toBeGreaterThan(0.05);
    await look(`window.__look.ghost(false)`);
    const after = await look<FrameSummary>(`window.__look.frame()`);
    expect(after.thumb).toEqual(before.thumb);
    expect(after.drawCalls).toBe(before.drawCalls);
    expect(errors).toEqual([]);
  });

  test('half-resolution ink (the phone option) draws the same picture with softer lines', async () => {
    await look(`window.__look.open('look-primitives', { ink: 'full', pixelRatio: 2 })`);
    const full = await look<FrameSummary>(`window.__look.frame()`);
    await look(`window.__look.open('look-primitives', { ink: 'half', pixelRatio: 2 })`);
    const half = await look<FrameSummary>(`window.__look.frame()`);
    expect(half.width).toBe(1280);
    expect(differ(half, full)).toBeLessThan(6);
    expect(half.dark).toBeGreaterThan(full.dark * 0.25);
    expect(half.drawCalls).toBe(full.drawCalls + 1); // the ink mask pass
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
