import { describe, expect, test } from 'vitest';
import { parseColor } from '@/gen/mesh';
import { partPhases, timeAt } from '@/life/signals';
import { PALETTE } from '@/style/palette';
import { gradeAt, type Rgb } from './grade';

const lum = (c: Rgb): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const at = (phase: number) => gradeAt(timeAt(phase, 0));
const paper = (() => {
  const [r, g, b] = parseColor(PALETTE.paper);
  return [r / 255, g / 255, b / 255] as Rgb;
})();
const graded = (c: Rgb, phase: number): Rgb => {
  const g = at(phase);
  return [c[0] * g.tint[0] + g.lift[0], c[1] * g.tint[1] + g.lift[1], c[2] * g.tint[2] + g.lift[2]];
};

describe('the dusk grade', () => {
  const p = partPhases();

  test('midday leaves the drawing alone: no tint, no lift, nothing lit, no stars', () => {
    const g = at(p.day.mid);
    expect(g.tint).toEqual([1, 1, 1]);
    expect(g.lift).toEqual([0, 0, 0]);
    expect(g.sat).toBe(1);
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
      }
      expect(Math.abs(g.glow - last.glow)).toBeLessThan(0.01);
      expect(Math.abs(g.stars - last.stars)).toBeLessThan(0.01);
      expect(Math.abs(g.sat - last.sat)).toBeLessThan(0.004);
      last = g;
    }
  });
});
