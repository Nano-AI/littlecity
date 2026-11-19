import { describe, expect, test } from 'vitest';
import { parseColor } from '@/gen/mesh';
import { partPhases, timeAt } from '@/life/signals';
import { PALETTE } from '@/style/palette';
import { gradeAt, gradeColor, type Rgb } from './grade';

const lum = (c: Rgb): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const at = (phase: number) => gradeAt(timeAt(phase, 0));
const paper = (() => {
  const [r, g, b] = parseColor(PALETTE.paper);
  return [r / 255, g / 255, b / 255] as Rgb;
})();
const graded = (c: Rgb, phase: number, facing = 1): Rgb => gradeColor(c, at(phase), facing);
const hex = (h: string): Rgb => {
  const [r, g, b] = parseColor(h);
  return [r / 255, g / 255, b / 255];
};
const apart = (a: Rgb, b: Rgb): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('the dusk grade', () => {
  const p = partPhases();

  test('midday leaves the drawing alone: no tint, no lift, nothing lit, no stars', () => {
    const g = at(p.day.mid);
    expect(g.tint).toEqual([1, 1, 1]);
    expect(g.lift).toEqual([0, 0, 0]);
    expect(g.sat).toBe(1);
    expect(g.shade).toEqual([1, 1, 1]);
    expect([g.chroma, g.contrast, g.sea]).toEqual([1, 1, 1]);
    expect(gradeColor([0.3, 0.6, 0.9], g, -1)).toEqual([0.3, 0.6, 0.9]);
    expect(g.glow).toBe(0);
    expect(g.stars).toBe(0);
  });

  test('dusk is warm: red stays, blue is pulled down', () => {
    const g = at(p.dusk.start + (p.dusk.end - p.dusk.start) * 0.42);
    expect(g.tint[0]).toBeGreaterThan(g.tint[2] + 0.15);
    expect(g.tint[0]).toBeGreaterThan(0.95);
  });

  test('night is deep blue-violet and the paper darkens with it', () => {
    const g = at(p.night.mid);
    expect(g.tint[2]).toBeGreaterThan(g.tint[0] + 0.15);
    expect(lum(graded(paper, p.night.mid))).toBeLessThan(lum(paper) * 0.5);
    expect(g.glow).toBe(1);
    expect(g.stars).toBe(1);
  });

  test('dusk keeps stone, path, sand and plaza apart: no single salmon (art review L3)', () => {
    const peak = p.dusk.start + (p.dusk.end - p.dusk.start) * 0.42;
    const pale = [PALETTE.stone, PALETTE.path, PALETTE.sand, PALETTE.plaza].map(hex);
    const closest = (phase: number, facing: number): number => {
      let d = Infinity;
      for (let i = 0; i < pale.length; i++) for (let j = i + 1; j < pale.length; j++) d = Math.min(d, apart(graded(pale[i]!, phase, facing), graded(pale[j]!, phase, facing)));
      return d;
    };
    // At least as far apart as by day, on lit faces and on faces in shade. (A plain multiply by the old
    // tint brought the nearest pair to half its daytime distance.)
    expect(closest(peak, 1)).toBeGreaterThanOrEqual(closest(p.day.mid, 1));
    expect(closest(peak, -1)).toBeGreaterThanOrEqual(closest(p.day.mid, 1));
    // Warm where the light falls, cool violet where it does not.
    const stone = hex(PALETTE.stone);
    const lit = graded(stone, peak, 1), shade = graded(stone, peak, -1);
    expect(lit[0] - lit[2]).toBeGreaterThan(0.15);
    expect(shade[0] - shade[2]).toBeLessThan((lit[0] - lit[2]) * 0.5);
    expect(lum(shade)).toBeLessThan(lum(lit) - 0.05);
  });

  test('at night stone and white trim stand clear of the grass, and the sea is a step darker than the land (L4)', () => {
    const night = p.night.mid;
    const grass = lum(graded(hex(PALETTE.grass), night, 1));
    for (const pale of [PALETTE.stone, PALETTE.marble, PALETTE.white]) {
      expect(lum(graded(hex(pale), night, 1)) - grass, pale).toBeGreaterThan(0.1); // a top face in moonlight
      expect(lum(graded(hex(pale), night, -1)), pale).toBeGreaterThan(grass); // even a wall turned from it
    }
    const g = at(night);
    const sea = hex(PALETTE.sea).map((v) => v * g.sea) as Rgb;
    expect(lum(gradeColor(sea, g, 1))).toBeLessThan(grass - 0.04);
  });

  test('it still reads as ink on paper at night: the line is clearly darker than the page', () => {
    for (const phase of [p.day.mid, p.dusk.mid, p.night.mid, p.dawn.mid]) {
      const page = lum(graded(paper, phase));
      const ink = lum(at(phase).ink);
      expect(page - ink).toBeGreaterThan(0.18);
      expect(page / Math.max(ink, 1e-3)).toBeGreaterThan(2.5);
    }
  });

  test('windows come on before the stars come out', () => {
    let firstGlow = -1, firstStars = -1;
    for (let i = 0; i <= 1000; i++) {
      const phase = p.dusk.start + ((p.dusk.end - p.dusk.start) * i) / 1000;
      const g = at(phase);
      if (firstGlow < 0 && g.glow > 0.05) firstGlow = i;
      if (firstStars < 0 && g.stars > 0.05) firstStars = i;
    }
    expect(firstGlow).toBeGreaterThan(0);
    expect(firstStars).toBeGreaterThan(firstGlow);
  });

  test('nothing jumps anywhere in the loop, part boundaries and the wrap included', () => {
    const steps = 9600; // 50 ms of the 8-minute loop
    let last = at(0);
    for (let i = 1; i <= steps; i++) {
      const g = at((i % steps) / steps);
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(g.tint[k]! - last.tint[k]!)).toBeLessThan(0.004);
        expect(Math.abs(g.ink[k]! - last.ink[k]!)).toBeLessThan(0.004);
        expect(Math.abs(g.lift[k]! - last.lift[k]!)).toBeLessThan(0.004);
        expect(Math.abs(g.shade[k]! - last.shade[k]!)).toBeLessThan(0.004);
      }
      expect(Math.abs(g.glow - last.glow)).toBeLessThan(0.01);
      expect(Math.abs(g.stars - last.stars)).toBeLessThan(0.01);
      expect(Math.abs(g.sat - last.sat)).toBeLessThan(0.004);
      expect(Math.abs(g.chroma - last.chroma)).toBeLessThan(0.004);
      expect(Math.abs(g.contrast - last.contrast)).toBeLessThan(0.01);
      expect(Math.abs(g.sea - last.sea)).toBeLessThan(0.004);
      last = g;
    }
  });
});
