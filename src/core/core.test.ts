import { describe, expect, test } from 'vitest';
import { ALL_KINDS, AUTO_KINDS, KINDS, placedInfo } from './kinds';
import { compose, det3, identity, invertAffine, multiply, rotationX, rotationY, rotationZ, scaling, transformDir, transformPoint, translation } from './mat4';
import { allStyles, defineStyle, resetStyles, setStyle, styleVersion } from './style';

const close = (a: ArrayLike<number>, b: ArrayLike<number>): void => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i]!, 9);
};

describe('mat4', () => {
  test('rotations are right-handed', () => {
    close(transformDir(rotationY(Math.PI / 2), [0, 0, 1]), [1, 0, 0]);
    close(transformDir(rotationX(Math.PI / 2), [0, 1, 0]), [0, 0, 1]);
    close(transformDir(rotationZ(Math.PI / 2), [1, 0, 0]), [0, 1, 0]);
  });
  test('multiply applies the right-hand matrix first', () => {
    const m = multiply(translation(10, 0, 0), scaling(2));
    close(transformPoint(m, [1, 1, 1]), [12, 2, 2]);
    close(transformPoint(compose(translation(1, 2, 3), rotationY(Math.PI / 2)), [0, 0, 1]), [2, 2, 3]);
  });
  test('invertAffine undoes a transform', () => {
    const m = compose(translation(3, -2, 5), rotationY(0.7), rotationX(-0.3), scaling(2, 3, 0.5));
    close(multiply(m, invertAffine(m)), identity());
    expect(det3(scaling(-1, 1, 1))).toBeLessThan(0);
  });
});

describe('kinds', () => {
  test('the table matches the design glossary', () => {
    const solid = ALL_KINDS.filter((k) => KINDS[k].solid);
    expect(solid.sort()).toEqual(['arch', 'dock', 'house', 'lighthouse', 'marble', 'pillar', 'tower']);
    const building = ALL_KINDS.filter((k) => KINDS[k].building);
    expect(building.sort()).toEqual(['house', 'lighthouse', 'marble', 'tower', 'windmill']);
    expect(ALL_KINDS.filter((k) => KINDS[k].autoTarget)).toEqual([...AUTO_KINDS]);
    expect(placedInfo('auto').solid && placedInfo('auto').building).toBe(true);
    expect(ALL_KINDS.filter((k) => KINDS[k].variedColor).sort()).toEqual(['house', 'tower']);
    expect(ALL_KINDS.filter((k) => KINDS[k].keepsFloor).sort()).toEqual(['arch', 'fence', 'fountain', 'stall', 'tree', 'wall']);
  });
});

describe('style', () => {
  test('values are live, listed, and changes bump the version', () => {
    const S = defineStyle('test-style', { eave: 0.12, tint: '#ffffff' }, { eave: [0, 1, 0.01] });
    expect(allStyles().find((s) => s.name === 'test-style')?.ranges.eave).toEqual([0, 1, 0.01]);
    const before = styleVersion();
    setStyle('test-style', 'eave', 0.3);
    expect(S.eave).toBe(0.3);
    expect(styleVersion()).toBeGreaterThan(before);
    expect(defineStyle('test-style', { eave: 9, tint: 'x' })).toBe(S);
    expect(() => setStyle('test-style', 'nope', 1)).toThrow();
    resetStyles();
    expect(S.eave).toBe(0.12);
  });
});
