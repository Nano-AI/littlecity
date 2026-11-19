// The little person as geometry: sound meshes, two ink groups, a small
// triangle count, seeded looks, and poses that keep the figure together.

import { describe, expect, test } from 'vitest';
import { transformPoint } from '@/core/mat4';
import { inkGroups, triangleCount, validateMesh } from '@/gen/checks';
import { MeshBuilder, meshBounds } from '@/gen/mesh';
import { PERSON } from '@/style/people';
import { assemblePerson, buildPerson, lookOf, PIECES, rigOf } from './person';
import { POSES, poseOf, rigMatrices, sitDrop } from './pose';

const whole = (seed: number, pose = poseOf('stand', 0), child = false) => {
  const look = lookOf(seed, child);
  const m = rigMatrices(look, pose);
  const b = new MeshBuilder({ ink: seed });
  assemblePerson(buildPerson(look, seed), [0, 1, 2, 3, 4].map((i) => m.subarray(i * 16, i * 16 + 16)), b);
  return { look, mesh: b.build() };
};

describe('the person', () => {
  test('every piece of every look is a sound mesh', () => {
    for (let seed = 0; seed < 60; seed++) {
      const look = lookOf(seed * 7919, seed % 6 === 0);
      const meshes = buildPerson(look, seed);
      for (const piece of PIECES) expect(validateMesh(meshes[piece]), `${piece} of look ${seed}`).toEqual([]);
    }
  });

  test('a person is two ink groups (the head, and everything below the neck) and under 500 triangles', () => {
    for (let seed = 1; seed < 40; seed++) {
      const { mesh } = whole(seed * 31);
      expect(inkGroups(mesh).size).toBe(2);
      expect(triangleCount(mesh)).toBeLessThan(500);
      expect(triangleCount(mesh)).toBeGreaterThan(150);
    }
  });

  test('an adult stands about PERSON.height tall on the ground; a child is smaller', () => {
    const adult = whole(11);
    const { min, max } = meshBounds(adult.mesh);
    expect(min[1]).toBeCloseTo(0, 2);
    expect(max[1]).toBeGreaterThan(PERSON.height - 0.01);
    expect(max[1]).toBeLessThan(PERSON.height + 0.09); // hair, a bun or a hat on top
    expect(lookOf(11, true).scale).toBeLessThan(lookOf(11, false).scale * 0.85);
  });

  test('looks are seeded: the same seed draws the same person, and a crowd is varied', () => {
    expect(lookOf(1234)).toEqual(lookOf(1234));
    const looks = Array.from({ length: 80 }, (_, i) => lookOf(i * 104729));
    expect(new Set(looks.map((l) => l.top)).size).toBeGreaterThan(6);
    expect(new Set(looks.map((l) => l.skin)).size).toBeGreaterThan(4);
    expect(new Set(looks.map((l) => l.hairStyle)).size).toBe(5);
    expect(new Set(looks.map((l) => l.hat)).size).toBe(4);
    expect(looks.filter((l) => l.dress).length).toBeGreaterThan(10);
    expect(looks.every((l) => l.top !== l.bottom)).toBe(true);
  });
});

describe('poses', () => {
  test('every pose keeps the figure in one piece and on the ground', () => {
    const look = lookOf(5);
    const rig = rigOf(look);
    for (const name of POSES) {
      for (const phase of [0, 0.25, 0.5, 0.75, 1.3, 2.9]) {
        const pose = poseOf(name, phase);
        const m = rigMatrices(look, pose, undefined, name === 'sit' ? sitDrop(rig, 0) : 0, rig);
        expect([...m].every(Number.isFinite), name).toBe(true);
        // Shoulders stay on the body: each arm's pivot is where the body's shoulder is.
        const body = m.subarray(0, 16);
        for (const [i, x] of [[3, -rig.shoulderX], [4, rig.shoulderX]] as const) {
          const want = transformPoint(body, [x, rig.shoulderY, 0]);
          expect(m[i * 16 + 12]).toBeCloseTo(want[0], 5);
          expect(m[i * 16 + 13]).toBeCloseTo(want[1], 5);
          expect(m[i * 16 + 14]).toBeCloseTo(want[2], 5);
        }
        const { mesh } = whole(5, pose);
        const { min } = meshBounds(mesh);
        if (name !== 'sit' && name !== 'hop') expect(min[1], name).toBeGreaterThan(-0.03);
      }
    }
  });

  test('the walk is drawn on twos: four held drawings a stride, legs opposite, arms opposite the legs', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = poseOf('walk', i / 200);
      seen.add(`${p.legL.toFixed(3)},${p.lift.toFixed(3)}`);
      expect(p.legL).toBeCloseTo(-p.legR, 9);
      expect(p.armL * p.legL).toBeLessThanOrEqual(0);
    }
    expect(seen.size).toBe(Math.round(PERSON.walkPoses) - 1); // contact left, passing (twice the same), contact right
    const contact = poseOf('walk', 0.25), passing = poseOf('walk', 0.5);
    expect(contact.legL).toBeCloseTo(PERSON.stride, 9);
    expect(passing.legL).toBeCloseTo(0, 9);
    expect(passing.lift).toBeGreaterThan(contact.lift);
  });

  test('a seated figure has its hips at the seat and its feet out in front', () => {
    const look = lookOf(9);
    const rig = rigOf(look);
    const m = rigMatrices(look, poseOf('sit', 0), undefined, sitDrop(rig, 0.1), rig);
    expect(m[16 + 13]).toBeCloseTo(0.1 + 0.03, 5); // the hip pivot, just above the seat
    const foot = transformPoint(m.subarray(16, 32), [0, -rig.leg, 0]);
    expect(foot[2]).toBeGreaterThan(0.1);
  });
});
