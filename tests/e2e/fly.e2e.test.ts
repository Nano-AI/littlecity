// Fly mode (design section 7, "Fly mode") in a real browser: F and the wings
// button take off from the camera as it is, without a jump; W flies forward;
// a house stops the eye short of its wall; Escape and the cursor being let go
// both glide back to exactly where the camera was; nothing can be built
// while flying and the piece in hand is still in hand after. Escape with
// nothing open glides to the whole-island view and keeps the piece. No wings
// on a phone.
//
// Headless Chromium will not capture the cursor (pointer lock), so the tests
// let it go through fly mode's test hook (testLoseLock) instead of the
// browser; the keys are real key presses.

import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startApp, type App } from '../helpers/browser';

let app: App;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

const phase = (page: Page): Promise<string> => page.evaluate('window.__lc.ui.fly.phase') as Promise<string>;
const waitPhase = (page: Page, p: string): Promise<unknown> => page.waitForFunction(`window.__lc.ui.fly.phase === '${p}'`);
const camera = (page: Page): Promise<{ yaw: number; pitch: number; zoom: number; target: number[] }> => page.evaluate('window.__lc.view.getCamera()') as never;
const pressed = `[...document.querySelectorAll('[data-item][aria-pressed="true"]')].map((b) => b.dataset.item)`;
const blocks = `window.__lc.world().blocks.size`;
type Debug = { phase: string; eye: [number, number, number] | null; yaw: number; pitch: number; fov: number; speed: number };
const debug = (page: Page): Promise<Debug> => page.evaluate('window.__lc.ui.fly.debug()') as Promise<Debug>;

/** Two frames drawn: what the page shows has caught up with what was set. */
const frames = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function open(path = '/?seed=7&gen=1'): Promise<{ page: Page; errors: string[] }> {
  const opened = await app.open(path);
  await opened.page.waitForFunction('window.__lc !== undefined && window.__lc.ui.fly !== undefined');
  return opened;
}

/**
 * How different two PNG screenshots look, seen coarsely: each is averaged over blocks of 8 × 8 pixels
 * (so an outline a pixel or two to one side does not count, a picture that has moved does), and the
 * mean difference of the blocks' colours is returned, 0 to 255. Worked out in the page.
 */
async function changed(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([a, b]) => {
      const load = async (s: string): Promise<{ data: Uint8ClampedArray; w: number; h: number }> => {
        const img = new Image();
        img.src = `data:image/png;base64,${s}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
      };
      const [pa, pb] = await Promise.all([load(a), load(b)]);
      const B = 8;
      let sum = 0, n = 0;
      for (let by = 0; by + B <= pa.h; by += B) {
        for (let bx = 0; bx + B <= pa.w; bx += B) {
          const ca = [0, 0, 0], cb = [0, 0, 0];
          for (let y = by; y < by + B; y++) {
            for (let x = bx; x < bx + B; x++) {
              const i = (y * pa.w + x) * 4;
              for (let k = 0; k < 3; k++) {
                ca[k]! += pa.data[i + k]!;
                cb[k]! += pb.data[i + k]!;
              }
            }
          }
          sum += (Math.abs(ca[0]! - cb[0]!) + Math.abs(ca[1]! - cb[1]!) + Math.abs(ca[2]! - cb[2]!)) / (3 * B * B);
          n++;
        }
      }
      return sum / n;
    },
    [a.toString('base64'), b.toString('base64')] as const,
  );
}

describe('fly mode', () => {
  test('F takes off without a jump; W flies forward; Escape glides back to exactly where the camera was', async () => {
    const { page, errors } = await open();
    await page.evaluate(() => (window as unknown as { __lc: { signals: { hold(p: string): void } } }).__lc.signals.hold('day'));
    // The town only, without the interface over it.
    await page.addStyleTag({ content: '.lc-ui { visibility: hidden !important; }' });
    const from = await camera(page);
    await frames(page);
    const before = await page.locator('#town').screenshot();
    // The first frame of the way in, held still.
    await page.evaluate('window.__lc.ui.fly.testHold(0)');
    await page.keyboard.press('f');
    await waitPhase(page, 'in');
    await page.waitForFunction('window.__lc.view.getEyeCamera() !== null');
    await frames(page);
    const first = await page.locator('#town').screenshot();
    // The end of the way in, for scale: the picture there has really changed.
    await page.evaluate('window.__lc.ui.fly.testHold(1)');
    await waitPhase(page, 'flying');
    await page.evaluate('window.__lc.ui.fly.testHold(null)');
    await frames(page);
    const flying = await page.locator('#town').screenshot();
    const jump = await changed(page, before, first);
    const moved = await changed(page, before, flying);
    // Measured: about 1 taking off (outlines a pixel to one side, the far corners of the slab a few) and
    // about 20 once in.
    expect(jump).toBeLessThan(2);
    expect(moved).toBeGreaterThan(jump * 5);

    // W: forward, the way the eye looks.
    const d0 = await debug(page);
    await page.keyboard.down('w');
    await page.waitForFunction((x0) => {
      const d = (window as unknown as { __lc: { ui: { fly: { debug(): Debug } } } }).__lc.ui.fly.debug();
      return d.eye !== null && Math.hypot(d.eye[0] - x0[0], d.eye[1] - x0[1], d.eye[2] - x0[2]) > 2;
    }, d0.eye!);
    await page.keyboard.up('w');
    const d1 = await debug(page);
    const yaw = (d0.yaw * Math.PI) / 180, pitch = (d0.pitch * Math.PI) / 180;
    const fwd = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    const step = [0, 1, 2].map((i) => d1.eye![i]! - d0.eye![i]!);
    const along = step[0]! * fwd[0]! + step[1]! * fwd[1]! + step[2]! * fwd[2]!;
    expect(along).toBeGreaterThan(1.9);
    expect(along / Math.hypot(...step)).toBeGreaterThan(0.99);

    // Escape: back to the builder's view, exactly as it was.
    await page.keyboard.press('Escape');
    await waitPhase(page, 'off');
    expect(await page.evaluate('window.__lc.view.getEyeCamera()')).toBeNull();
    expect(await camera(page)).toEqual(from);
    expect(errors).toEqual([]);
  });

  test('the wings button takes off; the tray hides and a click builds nothing; losing the cursor lands with the same piece in hand', async () => {
    const { page, errors } = await open();
    await page.click('[data-item="house"]');
    expect(await page.evaluate(pressed)).toEqual(['house']);
    const from = await camera(page);
    const count = await page.evaluate(blocks);
    await page.click('[data-ui="fly"]');
    await waitPhase(page, 'flying');
    expect(await page.locator('.lc-tray').isVisible()).toBe(false);
    expect(await page.locator('[data-ui="fly"]').isVisible()).toBe(false);
    expect(await page.locator('[data-ui="fly-hint"]').isVisible()).toBe(true);
    expect(await page.evaluate('window.__lc.ui.debug().ghost')).toBeNull();
    // Clicks on the town while flying: nothing placed, nothing erased.
    await page.mouse.click(640, 400);
    await page.mouse.click(640, 460, { button: 'right' });
    await page.waitForTimeout(300);
    expect(await page.evaluate(blocks)).toBe(count);
    expect(await phase(page)).toBe('flying');
    // The browser lets the cursor go (it took Escape for itself): fly mode lands.
    await page.evaluate('window.__lc.ui.fly.testLoseLock()');
    await waitPhase(page, 'off');
    expect(await camera(page)).toEqual(from);
    expect(await page.locator('.lc-tray').isVisible()).toBe(true);
    expect(await page.evaluate(pressed)).toEqual(['house']);
    expect(await page.evaluate(blocks)).toBe(count);
    expect(errors).toEqual([]);
  });

  test('flying at a house stops short of its wall', async () => {
    const { page, errors } = await open();
    // A house three storeys tall on the island, with nothing in the four cells west of it up at its top storey.
    const spot = await page.evaluate(() => {
      const lc = (window as unknown as { __lc: { terrain(): { height: Uint8Array }; shape(): { kinds: Map<number, string> }; edit(e: unknown): boolean } }).__lc;
      const h = lc.terrain().height;
      const kinds = lc.shape().kinds;
      for (let z = 14; z < 34; z++) {
        for (let x = 18; x < 34; x++) {
          const y = h[x + z * 48]!;
          if (y < 1) continue;
          let ok = true;
          for (let i = 0; i <= 4 && ok; i++) if (h[x - i + z * 48]! > y + 1 || kinds.has((x - i) | (z << 6) | ((y + 2) << 12)) || kinds.has((x - i) | (z << 6) | ((y + 1) << 12))) ok = false;
          if (!ok) continue;
          for (let l = 0; l < 3; l++) if (!lc.edit({ type: 'placeBlock', cell: x | (z << 6) | ((y + l) << 12), kind: 'house', color: 'auto', from: null })) ok = false;
          if (ok) return { x, y, z };
        }
      }
      return null;
    });
    expect(spot).not.toBeNull();
    const { x, y, z } = spot!;
    await page.keyboard.press('f');
    await waitPhase(page, 'flying');
    // Four cells west of the house, at its top storey, facing east (yaw −90).
    await page.evaluate(([x, y, z]) => (window as unknown as { __lc: { ui: { fly: { testPlace(e: number[], yaw: number, pitch: number): void } } } }).__lc.ui.fly.testPlace([x - 3.5, (y + 2) * 0.8 + 0.4, z + 0.5], -90, 0), [x, y, z]);
    await page.keyboard.down('w');
    // Wait until it has come to the wall and stopped there.
    await page.waitForFunction((wx) => {
      const d = (window as unknown as { __lc: { ui: { fly: { debug(): Debug } } } }).__lc.ui.fly.debug();
      return d.eye !== null && d.eye[0] > wx - 0.5 && d.speed < 1e-6;
    }, x);
    const eye = (await debug(page)).eye!;
    await page.keyboard.up('w');
    expect(eye[0]).toBeLessThan(x);
    expect(eye[0]).toBeGreaterThan(x - 0.3);
    expect(await page.evaluate(([px, py, pz]) => {
      const cell = Math.floor(px) | (Math.floor(pz) << 6) | (Math.floor(py / 0.8) << 12);
      return (window as unknown as { __lc: { shape(): { kinds: Map<number, string> } } }).__lc.shape().kinds.has(cell);
    }, eye)).toBe(false);
    await page.keyboard.press('Escape');
    await waitPhase(page, 'off');
    expect(errors).toEqual([]);
  });

  test('Escape with nothing open glides to the whole-island view and keeps the piece; with a slider open it only closes it', async () => {
    const { page, errors } = await open();
    const home = await camera(page);
    await page.click('[data-drawer="ground"]');
    await page.click('[data-item="fence"]');
    expect(await page.evaluate(pressed)).toEqual(['fence']);
    // Turn and zoom the view away from the whole island.
    await page.evaluate(() => (window as unknown as { __lc: { view: { setCamera(p: unknown): void } } }).__lc.view.setCamera({ yaw: 160, pitch: 60, zoom: 4, target: [10, 1, 30] }));
    // A slider open: Escape closes it and nothing else.
    await page.click('[data-ui="time"]');
    expect(await page.locator('[data-ui="slider-time"]').isVisible()).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.locator('[data-ui="slider-time"]').isVisible()).toBe(false);
    expect(await page.evaluate('window.__lc.ui.debug().recentring')).toBe(false);
    expect((await camera(page)).zoom).toBe(4);
    // Nothing open: back to the whole island, gliding there.
    await page.keyboard.press('Escape');
    expect(await page.evaluate('window.__lc.ui.debug().recentring')).toBe(true);
    await page.waitForFunction('window.__lc.ui.debug().recentring === false');
    const back = await camera(page);
    expect(((back.yaw % 360) + 360) % 360).toBeCloseTo(((home.yaw % 360) + 360) % 360, 6);
    expect(back.pitch).toBeCloseTo(home.pitch, 6);
    expect(back.zoom).toBeCloseTo(home.zoom, 6);
    for (let i = 0; i < 3; i++) expect(back.target[i]).toBeCloseTo(home.target[i]!, 6);
    // The piece is still in hand, its stepper still showing.
    expect(await page.evaluate(pressed)).toEqual(['fence']);
    expect(await page.locator('[data-ui="length"]:visible').count()).toBe(1);
    expect(errors).toEqual([]);
  });

  test('on a phone there are no wings and F does nothing', async () => {
    const { page, errors } = await app.open('/?seed=7&gen=1', { width: 390, height: 844, hasTouch: true, isMobile: true });
    await page.waitForFunction('window.__lc !== undefined');
    expect(await page.locator('[data-ui="fly"]').count()).toBe(0);
    await page.keyboard.press('f');
    await frames(page);
    expect(await phase(page)).toBe('off');
    expect(await page.evaluate('window.__lc.view.getEyeCamera()')).toBeNull();
    expect(errors).toEqual([]);
  });
});
