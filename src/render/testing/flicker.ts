// TEST SUPPORT (Look): temporal instability. Draws a town from a run of camera poses very close
// together and scores how much of the picture changes in a way the motion does not explain.
// Load it after probe.ts, then drive it with page.evaluate:
//
//   await page.evaluate(() => window.__look.open('everything', { ink: 'full' }));
//   const r = await page.evaluate(() => window.__flicker.sweep({ yaw: 45, pitch: 35, zoom: 1.6, target: [23.5, 1, 24.5] }, 'yaw', 48));
//
// The poses are spaced so that nothing in the picture moves more than about a third of a CSS pixel
// from one frame to the next (`STEP_PX`). Anything the motion explains then stays inside the 3 × 3
// neighbourhood of where it was a frame before. The scores, per frame, in parts per thousand:
//
//   blink   pixels that, for one frame, are darker (or lighter) by more than T than everything in
//           their 3 × 3 neighbourhood both the frame before and the frame after: ink that appears
//           for a frame and goes, a line that drops out for a frame.
//   pop     pixels that differ by more than T from everything in their neighbourhood a frame before:
//           a face filling with ink, a line or a pattern switching on or off (blinks count twice).
//   area    16 × 16 CSS-pixel blocks whose mean brightness jumps by more than T_AREA from one frame to the
//           next: large areas changing tone at once.
//
// It also keeps the regions where the most pixels blinked or popped, as crops (frames A, B, C and
// the mask, magnified), and a heat map of the whole sweep, as data URLs the runner writes to disk.

import { pixelsPerUnit } from '../camera';
import type { CameraPose } from '../api';

export type Motion = 'yaw' | 'pitch' | 'zoom' | 'pan';

/** How far anything moves on the page per frame, CSS pixels, at the frame's edge. */
export const STEP_PX = 0.35;
/**
 * A change that counts, in 8-bit luminance: at most 56, less on a dark page (night), where the
 * whole picture spans a narrower range. Set from the first frame (see `contrastOf`).
 */
const T_MAX = 56;
let T = T_MAX;
let T_AREA = 10;
let DARK = 95;
/** Pixels this close to the frame's edge are left out: what comes into view there is new, not a flicker. */
const EDGE = 3;
/** Blocks for the area score: 16 CSS pixels a side (times the pixel ratio). */
let BLOCK = 16;
const TILE = 48;
const KEEP = 6;
const MAG = 4;

export interface Crop {
  frame: number;
  x: number;
  y: number;
  score: number;
  png: string;
}
export interface SweepResult {
  frames: number;
  width: number;
  height: number;
  blink: number;
  pop: number;
  area: number;
  /** Mean share of ink-dark pixels, for context. */
  dark: number;
  /**
   * Mean absolute change of luminance per pixel per frame. Mostly the motion itself; compared between
   * two settings of the same sweep it shows how much a setting adds (lines crawling under the pen's
   * wobble, say).
   */
  change: number;
  /** The threshold used (8-bit luminance). */
  threshold: number;
  crops: Crop[];
  heat: string;
}

/** The first frame's spread: 2nd to 95th percentile of luminance. */
function contrastOf(l: Uint8Array): [number, number] {
  const hist = new Uint32Array(256);
  for (let i = 0; i < l.length; i++) hist[l[i]!]!++;
  let acc = 0, lo = -1, hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v]!;
    if (lo < 0 && acc >= l.length * 0.02) lo = v;
    if (acc >= l.length * 0.95) { hi = v; break; }
  }
  return [lo, hi];
}

const lumOf = (px: Uint8Array, n: number, out: Uint8Array): void => {
  for (let i = 0, j = 0; i < n; i++, j += 4) out[i] = (px[j]! * 77 + px[j + 1]! * 150 + px[j + 2]! * 29) >> 8;
};

/** 3 × 3 min and max of a luminance image. */
function range3(l: Uint8Array, w: number, h: number, mn: Uint8Array, mx: Uint8Array, tmn: Uint8Array, tmx: Uint8Array): void {
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      const a = l[r + Math.max(0, x - 1)]!, b = l[r + x]!, c = l[r + Math.min(w - 1, x + 1)]!;
      tmn[r + x] = Math.min(a, b, c);
      tmx[r + x] = Math.max(a, b, c);
    }
  }
  for (let y = 0; y < h; y++) {
    const u = Math.max(0, y - 1) * w, r = y * w, d = Math.min(h - 1, y + 1) * w;
    for (let x = 0; x < w; x++) {
      mn[r + x] = Math.min(tmn[u + x]!, tmn[r + x]!, tmn[d + x]!);
      mx[r + x] = Math.max(tmx[u + x]!, tmx[r + x]!, tmx[d + x]!);
    }
  }
}

interface Frame {
  rgba: Uint8Array;
  lum: Uint8Array;
  mn: Uint8Array;
  mx: Uint8Array;
  blocks: Float32Array;
}

/** The poses of a sweep: `n` frames from `base`, each moving the picture about STEP_PX at the frame's edge. */
export function posesFor(base: CameraPose, motion: Motion, n: number, width: number, height: number, stepPx = STEP_PX): CameraPose[] {
  const ppu = pixelsPerUnit(base, height);
  // A turn of d radians moves a point r units from the axis by r·d·ppu pixels. The farthest visible
  // point is about half the frame's width across, or half its height up the slope of the ground.
  const reach = Math.max(width / 2, height / 2 / Math.sin(Math.max(10, base.pitch) * (Math.PI / 180)));
  const dAngle = (stepPx / reach) * (180 / Math.PI);
  const out: CameraPose[] = [];
  for (let i = 0; i < n; i++) {
    const p: CameraPose = { ...base, target: [...base.target] as [number, number, number] };
    if (motion === 'yaw') p.yaw = base.yaw + dAngle * i;
    else if (motion === 'pitch') p.pitch = base.pitch + dAngle * i;
    else if (motion === 'zoom') p.zoom = base.zoom * (1 + stepPx / Math.hypot(width / 2, height / 2)) ** i;
    else {
      // Along the screen's diagonal.
      const y = base.yaw * (Math.PI / 180);
      const d = (stepPx / ppu) * i * Math.SQRT1_2;
      p.target = [base.target[0] + d * (Math.cos(y) + Math.sin(y)), base.target[1], base.target[2] + d * (Math.cos(y) - Math.sin(y))];
    }
    out.push(p);
  }
  return out;
}

function cropPng(frames: Frame[], w: number, h: number, cx: number, cy: number, mask: Uint8Array): string {
  const s = TILE;
  const x0 = Math.max(0, Math.min(w - s, cx - s / 2)), y0 = Math.max(0, Math.min(h - s, cy - s / 2));
  const c = document.createElement('canvas');
  c.width = s * MAG * 4 + 6;
  c.height = s * MAG;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  const img = g.createImageData(s, s);
  const panel = document.createElement('canvas');
  panel.width = panel.height = s;
  const pg = panel.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  for (let k = 0; k < 4; k++) {
    for (let y = 0; y < s; y++) {
      // readPixels rows run bottom-up.
      const src = (h - 1 - (y0 + y)) * w + x0;
      for (let x = 0; x < s; x++) {
        const o = (y * s + x) * 4;
        if (k < 3) {
          const i = (src + x) * 4;
          img.data[o] = frames[k]!.rgba[i]!;
          img.data[o + 1] = frames[k]!.rgba[i + 1]!;
          img.data[o + 2] = frames[k]!.rgba[i + 2]!;
        } else {
          const m = mask[src + x]!;
          const l = frames[1]!.lum[src + x]! * 0.5;
          img.data[o] = m & 1 ? 255 : m & 2 ? 255 : l;
          img.data[o + 1] = m & 1 ? 0 : m & 2 ? 170 : l;
          img.data[o + 2] = m ? 0 : l;
        }
        img.data[o + 3] = 255;
      }
    }
    pg.putImageData(img, 0, 0);
    g.drawImage(panel, k * (s * MAG + 2), 0, s * MAG, s * MAG);
  }
  return c.toDataURL('image/png');
}

/**
 * Draws the open town from each pose (`threshold` fixes T, to compare two versions of the view on
 * exactly the same terms; by default it is set from the first frame) (life time held still) and scores the run. `canvas` defaults to
 * the probe's (the last canvas on the page).
 */
export function sweepPoses(poses: CameraPose[], threshold?: number): SweepResult {
  const look = window.__look!;
  const cv = [...document.querySelectorAll('canvas')].at(-1)!;
  const gl = cv.getContext('webgl2')!;
  let w = 0, h = 0, n = 0;
  const ring: Frame[] = [];
  let heat = new Uint16Array(0), mask = new Uint8Array(0), tmn = new Uint8Array(0), tmx = new Uint8Array(0);
  let blink = 0, pop = 0, area = 0, change = 0, triples = 0, pairs = 0, dark = 0;
  const crops: Crop[] = [];
  for (let f = 0; f < poses.length; f++) {
    look.camera(poses[f]!);
    look.frameOnly(0);
    if (f === 0) {
      w = gl.drawingBufferWidth;
      h = gl.drawingBufferHeight;
      n = w * h;
      BLOCK = 16 * Math.max(1, Math.round(w / Math.max(1, cv.clientWidth)));
      heat = new Uint16Array(n);
      mask = new Uint8Array(n);
      tmn = new Uint8Array(n);
      tmx = new Uint8Array(n);
      // The first frame after opening also bakes the grounding picture: draw it once more.
      look.frameOnly(0);
    }
    const fr: Frame = ring.length === 3 ? ring.shift()! : { rgba: new Uint8Array(n * 4), lum: new Uint8Array(n), mn: new Uint8Array(n), mx: new Uint8Array(n), blocks: new Float32Array(Math.ceil(w / BLOCK) * Math.ceil(h / BLOCK)) };
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, fr.rgba);
    lumOf(fr.rgba, n, fr.lum);
    if (f === 0) {
      const [lo, hi] = contrastOf(fr.lum);
      T = threshold ?? Math.max(16, Math.min(T_MAX, Math.round((hi - lo) * 0.28)));
      T_AREA = Math.max(8, T / 5.6);
      DARK = lo + (hi - lo) * 0.3;
    }
    range3(fr.lum, w, h, fr.mn, fr.mx, tmn, tmx);
    // The edge band explains anything (its range is everything), so nothing there counts.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x >= EDGE && y >= EDGE && x < w - EDGE && y < h - EDGE) continue;
      fr.mn[y * w + x] = 0;
      fr.mx[y * w + x] = 255;
    }
    const bw = Math.ceil(w / BLOCK);
    fr.blocks.fill(0);
    let d = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const l = fr.lum[y * w + x]!;
      fr.blocks[((y / BLOCK) | 0) * bw + ((x / BLOCK) | 0)]! += l;
      if (l < DARK) d++;
    }
    dark += d / n;
    ring.push(fr);
    if (ring.length < 2) continue;
    // pop: B against A's neighbourhood
    const A = ring.at(-2)!, B = ring.at(-1)!;
    mask.fill(0);
    let pops = 0, moved = 0;
    for (let i = 0; i < n; i++) {
      const b = B.lum[i]!;
      moved += Math.abs(b - A.lum[i]!);
      if (b > A.mx[i]! + T || b < A.mn[i]! - T) {
        pops++;
        mask[i] = 2;
      }
    }
    pop += pops / n;
    change += moved / n;
    pairs++;
    let areas = 0;
    for (let k = 0; k < B.blocks.length; k++) if (Math.abs(B.blocks[k]! - A.blocks[k]!) / (BLOCK * BLOCK) > T_AREA) areas++;
    area += areas / B.blocks.length;
    // blink: the middle of the last three frames against both neighbours
    let blinks = 0;
    if (ring.length === 3) {
      const [P, M, N] = ring as [Frame, Frame, Frame];
      for (let i = 0; i < n; i++) {
        const b = M.lum[i]!;
        if ((b < P.mn[i]! - T && b < N.mn[i]! - T) || (b > P.mx[i]! + T && b > N.mx[i]! + T)) {
          blinks++;
          heat[i] = Math.min(65535, heat[i]! + 4);
        }
      }
      blink += blinks / n;
      triples++;
    }
    for (let i = 0; i < n; i++) if (mask[i]) heat[i] = Math.min(65535, heat[i]! + 1);
    // the worst tiles of this step (pops in B; blinks counted from the triple ending here)
    if (ring.length === 3 && (pops > 0 || blinks > 0)) {
      const [P, M, N] = ring as [Frame, Frame, Frame];
      const tw = Math.ceil(w / TILE), th = Math.ceil(h / TILE);
      const score = new Float32Array(tw * th);
      const bmask = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const b = M.lum[i]!;
        const isBlink = (b < P.mn[i]! - T && b < N.mn[i]! - T) || (b > P.mx[i]! + T && b > N.mx[i]! + T);
        const isPop = b > P.mx[i]! + T || b < P.mn[i]! - T;
        if (!isBlink && !isPop) continue;
        bmask[i] = isBlink ? 1 : 2;
        const x = i % w, y = h - 1 - ((i / w) | 0);
        score[((y / TILE) | 0) * tw + ((x / TILE) | 0)]! += isBlink ? 4 : 1;
      }
      for (let k = 0; k < score.length; k++) {
        const s = score[k]!;
        if (s < 6) continue;
        const tx = (k % tw) * TILE, ty = ((k / tw) | 0) * TILE;
        const same = crops.findIndex((c) => Math.abs(c.x - tx) < TILE * 2 && Math.abs(c.y - ty) < TILE * 2);
        if (same >= 0 && crops[same]!.score >= s) continue;
        if (same < 0 && crops.length >= KEEP && crops.at(-1)!.score >= s) continue;
        const crop: Crop = { frame: f - 1, x: tx, y: ty, score: s, png: cropPng([P, M, N], w, h, tx + TILE / 2, ty + TILE / 2, bmask) };
        if (same >= 0) crops.splice(same, 1);
        crops.push(crop);
        crops.sort((a, b) => b.score - a.score);
        if (crops.length > KEEP) crops.pop();
      }
    }
  }
  // The heat map: the last frame, faded, with every blink and pop of the run in red.
  const last = ring.at(-1)!;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (h - 1 - y) * w + x, o = (y * w + x) * 4;
    const l = 150 + last.lum[i]! * 0.4, k = Math.min(1, heat[i]! / 6);
    img.data[o] = l + (255 - l) * k;
    img.data[o + 1] = l * (1 - k);
    img.data[o + 2] = l * (1 - k);
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return {
    frames: poses.length,
    width: w,
    height: h,
    blink: (blink / Math.max(1, triples)) * 1000,
    pop: (pop / Math.max(1, pairs)) * 1000,
    area: (area / Math.max(1, pairs)) * 1000,
    dark: dark / poses.length,
    threshold: T,
    change: change / Math.max(1, pairs),
    crops: crops.map((cr) => ({ ...cr })),
    heat: c.toDataURL('image/png'),
  };
}

const api = {
  posesFor,
  sweepPoses,
  /** A sweep of `n` frames of one motion from `base`, in a view of `width` × `height` CSS pixels. */
  sweep(base: CameraPose, motion: Motion, n: number, width: number, height: number, stepPx?: number, threshold?: number): SweepResult {
    return sweepPoses(posesFor(base, motion, n, width, height, stepPx), threshold);
  },
};

declare global {
  interface Window {
    __flicker?: typeof api;
  }
}
window.__flicker = api;
