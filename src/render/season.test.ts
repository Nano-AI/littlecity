import { describe, expect, test } from 'vitest';
import { CLEAR, holdYear, seasonAt, SUMMER } from '@/life/season';
import { parseColor } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { gradeAt } from './grade';
import { timeAt } from '@/life/signals';
import { paperOf, seasonFrame, seasonGrade } from './season';

describe('the season on the page', () => {
  test('summer under a clear sky switches every seasonal effect off and leaves the grade and paper alone', () => {
    const f = seasonFrame(SUMMER, CLEAR);
    expect(f.on).toBe(false);
    const g = gradeAt(timeAt(0.2, 0));
    expect(seasonGrade(g, f)).toBe(g);
    expect(paperOf(f)).toEqual(parseColor(PALETTE.paper).map((c) => c / 255));
  });

  test('any other season, or any weather, switches it on', () => {
    expect(seasonFrame(seasonAt(holdYear('autumn')), CLEAR).on).toBe(true);
    expect(seasonFrame(SUMMER, { ...CLEAR, rain: 0.2 }).on).toBe(true);
    expect(seasonFrame(SUMMER, { ...CLEAR, cover: 0.01 }).on).toBe(true);
  });

  test('winter is cooler and paler, autumn warmer, a heavy sky greyer', () => {
    const g = gradeAt(timeAt(0.2, 0));
    const winter = seasonGrade(g, seasonFrame(seasonAt(holdYear('winter')), CLEAR));
    expect(winter.tint[2]).toBeGreaterThan(winter.tint[0]);
    const autumn = seasonGrade(g, seasonFrame(seasonAt(holdYear('autumn')), CLEAR));
    expect(autumn.tint[0]).toBeGreaterThan(autumn.tint[2]);
    const grey = seasonGrade(g, seasonFrame(SUMMER, { ...CLEAR, cloud: 1 }));
    expect(grey.sat).toBeLessThan(g.sat);
    expect(grey.cast).toBeLessThan(g.cast);
  });

  test('ice comes only with a hard winter', () => {
    expect(seasonFrame(seasonAt(holdYear('winter')), CLEAR).snow[3]).toBeGreaterThan(0.9);
    expect(seasonFrame(seasonAt(holdYear('autumn')), CLEAR).snow[3]).toBe(0);
  });
});
