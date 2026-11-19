// House styles (design section 7, "House style"): Random rolls exactly as
// before styles existed; the six named styles are fixed, distinct looks.

import { describe, expect, test } from 'vitest';
import type { Role } from '@/core/vocab';
import { HOUSE_STYLES, houseStyle, isHouseStyle, personalityOf } from '@/style/houses';

const ROLES: (Role | undefined)[] = [undefined, 'cottage', 'chapel', 'stilt-house', 'greenhouse', 'manor', 'boathouse', 'keepers-cottage', 'town-hall', 'shop', 'townhouse'];

/** FNV-1a over a string. */
function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

describe('house styles', () => {
  test('style 0 (Random) gives byte-identical personalities to the code before styles', () => {
    // The digest was taken from personalityOf at 8531978, before styles existed, over the same spread.
    let text = '';
    let textDefault = '';
    for (let seed = 0; seed < 40; seed++)
      for (let color = 0; color < 8; color++)
        for (const role of ROLES)
          for (const size of [1, 3, 8])
            for (const rustic of [false, true]) {
              const s = Math.imul(seed + 1, 2654435761) >>> 0;
              text += JSON.stringify(personalityOf(s, color, role, size, rustic, 0)) + '\n';
              textDefault += JSON.stringify(personalityOf(s, color, role, size, rustic)) + '\n';
            }
    expect(text.length).toBe(5102504);
    expect(fnv(text)).toBe(271846127);
    expect(textDefault).toBe(text);
  });

  test('there are six, numbered 1–6, with short names', () => {
    expect(HOUSE_STYLES).toHaveLength(6);
    expect(new Set(HOUSE_STYLES.map((s) => s.name)).size).toBe(6);
    for (const s of HOUSE_STYLES) expect(s.name.length).toBeLessThanOrEqual(8);
    expect(houseStyle(0)).toBeNull();
    expect(houseStyle(1)?.name).toBe(HOUSE_STYLES[0]!.name);
    expect([0, 1, 6].every(isHouseStyle)).toBe(true);
    expect([-1, 7, 1.5, '2', null].some(isHouseStyle)).toBe(false);
  });

  test('styles 1–6 are deterministic: the seed changes nothing but the lean', () => {
    for (let style = 1; style <= 6; style++) {
      for (let color = 0; color < 8; color++) {
        const strip = (seed: number): object => {
          const { lean, ...rest } = personalityOf(seed, color, 'cottage', 3, false, style);
          expect(lean).toBeGreaterThanOrEqual(-1);
          return rest;
        };
        const a = strip(1);
        for (const seed of [2, 77, 123456, 0xdeadbeef]) expect(strip(seed)).toEqual(a);
        // A rustic house far out of town keeps the chosen look.
        const { lean: _l, ...rustic } = personalityOf(9, color, 'cottage', 3, true, style);
        expect(rustic).toEqual(a);
        expect(personalityOf(5, color, undefined, 1, false, style)).toEqual(personalityOf(5, color, undefined, 1, false, style));
      }
    }
  });

  test('the six are distinct in every wall colour', () => {
    for (let color = 0; color < 8; color++) {
      const looks = HOUSE_STYLES.map((_, i) => {
        const p = personalityOf(1, color, 'cottage', 1, false, i + 1);
        return `${p.roofColor}|${p.family}|${p.door}|${p.rustic}|${p.plankUpper}|${p.storeyBands}|${p.timberGable}`;
      });
      expect(new Set(looks).size).toBe(6);
      // And by roof colour alone, at least five of six (one fallback may share where the first choice clashes).
      expect(new Set(HOUSE_STYLES.map((_, i) => personalityOf(1, color, 'cottage', 1, false, i + 1).roofColor)).size).toBeGreaterThanOrEqual(5);
    }
  });

  test('a role that dictates part of the look still wins for that part', () => {
    for (let style = 1; style <= 6; style++) {
      const chapel = personalityOf(3, 2, 'chapel', 6, false, style);
      expect([chapel.family, chapel.door, chapel.roof, chapel.cover]).toEqual(['arched', 'arched', 1, 'shingles']);
      const keeper = personalityOf(3, 2, 'keepers-cottage', 2, false, style);
      expect([keeper.roof, keeper.cover]).toEqual([0, 'shingles']);
      const glass = personalityOf(3, 2, 'greenhouse', 2, false, style);
      expect([glass.cover, glass.door]).toEqual(['glass', 'glazed']);
      const hall = personalityOf(3, 2, 'town-hall', 8, false, style);
      expect([hall.family, hall.door, hall.storeyBands]).toEqual(['tall', 'panel', true]);
      // The rest is the style's.
      expect(keeper.family).toBe(HOUSE_STYLES[style - 1]!.family);
      expect(hall.rustic).toBe(HOUSE_STYLES[style - 1]!.walls);
    }
  });
});
