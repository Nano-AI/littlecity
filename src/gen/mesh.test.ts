import { describe, expect, test } from 'vitest';
import { rotationY, scaling, translation } from '@/core/mat4';
import { findDuplicateFaces, inkGroups, validateMesh } from './checks';
import { EDGE_FAR, emptyMesh, mergeMeshes, MeshBuilder, meshBounds, parseColor, PATTERN, transformMesh, triangleCount, triangulate, vertexCount } from './mesh';

const normalAt = (m: { normal: Float32Array }, v: number): number[] => [...m.normal.slice(v * 3, v * 3 + 3)].map((n) => Math.round(n * 1000) / 1000 + 0);

/** Every triangle's stored normal agrees with its winding (front faces are counter-clockwise). */
function windingMatchesNormals(m: { position: Float32Array; normal: Float32Array }): boolean {
  const p = m.position;
  for (let t = 0; t < p.length; t += 9) {
    const ux = p[t + 3]! - p[t]!, uy = p[t + 4]! - p[t + 1]!, uz = p[t + 5]! - p[t + 2]!;
    const vx = p[t + 6]! - p[t]!, vy = p[t + 7]! - p[t + 1]!, vz = p[t + 8]! - p[t + 2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * m.normal[t]! + ny * m.normal[t + 1]! + nz * m.normal[t + 2]! <= 0) return false;
  }
  return true;
}

/** Signed volume: positive when faces point outward. */
function volume(m: { position: Float32Array }): number {
  const p = m.position;
  let v = 0;
  for (let t = 0; t < p.length; t += 9) {
    v +=
      (p[t]! * (p[t + 4]! * p[t + 8]! - p[t + 5]! * p[t + 7]!) -
        p[t + 1]! * (p[t + 3]! * p[t + 8]! - p[t + 5]! * p[t + 6]!) +
        p[t + 2]! * (p[t + 3]! * p[t + 7]! - p[t + 4]! * p[t + 6]!)) / 6;
  }
  return v;
}

describe('MeshBuilder primitives', () => {
  test('a box is 12 outward triangles with the current colour, pattern and ink', () => {
    const b = new MeshBuilder({ ink: 7 });
    b.setColor('#f6d77c').setPattern(PATTERN.stone).setInk('walls');
    const m = b.box([0, 0, 0], [1, 0.8, 2]).build();
    expect(triangleCount(m)).toBe(12);
    expect(vertexCount(m)).toBe(36);
    expect(b.triangleCount).toBe(12);
    expect(validateMesh(m)).toEqual([]);
    expect(windingMatchesNormals(m)).toBe(true);
    expect(volume(m)).toBeCloseTo(1.6, 6);
    expect([...m.color.slice(0, 3)]).toEqual([0xf6, 0xd7, 0x7c]);
    expect(new Set(m.pattern)).toEqual(new Set([PATTERN.stone]));
    expect(new Set(m.inkId)).toEqual(new Set([b.inkOf('walls')]));
    expect(new Set(m.edge)).toEqual(new Set([EDGE_FAR]));
    expect(meshBounds(m)).toEqual({ min: [0, 0, 0], max: [1, expect.closeTo(0.8, 6), 2] });
  });

  test('box faces can be skipped or picked, and named by compass side', () => {
    expect(new MeshBuilder().box([0, 0, 0], [1, 1, 1], { skip: ['bottom', 'n'] }).triangleCount).toBe(8);
    const east = new MeshBuilder().box([0, 0, 0], [1, 1, 1], { only: ['e'] }).build();
    expect(normalAt(east, 0)).toEqual([1, 0, 0]);
    expect(normalAt(new MeshBuilder().box([0, 0, 0], [1, 1, 1], { only: ['n'] }).build(), 0)).toEqual([0, 0, -1]);
    expect(normalAt(new MeshBuilder().box([0, 0, 0], [1, 1, 1], { only: ['top'] }).build(), 0)).toEqual([0, 1, 0]);
    const at = new MeshBuilder().boxAt([5, 1, 5], [2, 3, 4]).build();
    expect(meshBounds(at)).toEqual({ min: [4, 1, 3], max: [6, 4, 7] });
  });

  test('bevelTop marks the distance below the top edge on the sides', () => {
    const m = new MeshBuilder().box([0, 0, 0], [1, 2, 1], { only: ['s'], bevelTop: true }).build();
    for (let v = 0; v < 6; v++) expect(m.edge[v]).toBeCloseTo(2 - m.position[v * 3 + 1]!, 6);
  });

  test('quad and tri compute flat normals; degenerate faces are dropped', () => {
    const b = new MeshBuilder();
    b.quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]);
    b.tri([0, 0, 0], [0, 0, 0], [1, 1, 1]);
    const m = b.build();
    expect(triangleCount(m)).toBe(2);
    expect(normalAt(m, 0)).toEqual([0, 0, 1]);
  });

  test('per-vertex colours, edges and normals', () => {
    const m = new MeshBuilder()
      .quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], {
        colors: [0xff0000, 0x00ff00, 0x0000ff, '#ffffff'],
        edge: [0, 0, 1, 1],
        normals: [[0, 0, 2], [0, 0, 2], [0, 1, 0], [0, 1, 0]],
      })
      .build();
    expect([...m.color.slice(0, 9)]).toEqual([255, 0, 0, 0, 255, 0, 0, 0, 255]);
    expect([...m.edge]).toEqual([0, 0, 1, 0, 1, 1]);
    expect(normalAt(m, 0)).toEqual([0, 0, 1]);
    expect(normalAt(m, 2)).toEqual([0, 1, 0]);
  });

  test('extrude builds a closed prism from any simple outline, either winding', () => {
    const L: [number, number][] = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
    for (const outline of [L, [...L].reverse()]) {
      const m = new MeshBuilder().extrude(outline, 0, 0.8).build();
      expect(validateMesh(m)).toEqual([]);
      expect(windingMatchesNormals(m)).toBe(true);
      expect(volume(m)).toBeCloseTo(3 * 0.8, 6);
      expect(triangleCount(m)).toBe(6 * 2 + 4 * 2);
    }
    expect(new MeshBuilder().extrude(L, 0, 1, { cap: 'none' }).triangleCount).toBe(12);
    expect(new MeshBuilder().extrude(L, 0, 1, { cap: 'top' }).triangleCount).toBe(16);
    expect(triangulate(L)).toHaveLength(4);
  });

  test('lathe makes round and faceted solids of revolution', () => {
    const cylinder = new MeshBuilder().lathe([[0.5, 0], [0.5, 2]], { segments: 24, capTop: true, capBottom: true }).build();
    expect(validateMesh(cylinder)).toEqual([]);
    expect(windingMatchesNormals(cylinder)).toBe(true);
    expect(volume(cylinder)).toBeCloseTo(Math.PI * 0.25 * 2, 1);
    expect(triangleCount(cylinder)).toBe(24 * 2 + 24 * 2);
    // Smooth: side normals are radial. Faceted: one flat normal per side.
    expect(Math.hypot(cylinder.normal[0]!, cylinder.normal[2]!)).toBeCloseTo(1, 6);
    const pyramid = new MeshBuilder().lathe([[1, 0], [0, 1]], { segments: 4, smooth: false, start: Math.PI / 4 }).build();
    expect(triangleCount(pyramid)).toBe(4);
    expect(windingMatchesNormals(pyramid)).toBe(true);
    expect(normalAt(pyramid, 0)).toEqual(normalAt(pyramid, 1));
    const cone = new MeshBuilder().lathe([[0.4, 0], [0, 0.6]], { segments: 8 }).build();
    expect(triangleCount(cone)).toBe(8);
    expect(windingMatchesNormals(cone)).toBe(true);
  });

  test('polygon triangulates a flat outline facing its winding', () => {
    const m = new MeshBuilder().polygon([[0, 1, 0], [0, 1, 2], [2, 1, 2], [1, 1, 1], [2, 1, 0]]).build();
    expect(triangleCount(m)).toBe(3);
    expect(normalAt(m, 0)).toEqual([0, 1, 0]);
    expect(windingMatchesNormals(m)).toBe(true);
  });
});

describe('MeshBuilder state', () => {
  test('equal ink groups share an id; different groups and different builders do not', () => {
    const a = new MeshBuilder({ ink: 12 });
    const b = new MeshBuilder({ ink: 13 });
    expect(a.inkOf('walls')).toBe(a.inkOf('walls'));
    expect(a.inkOf('walls')).not.toBe(a.inkOf('roof'));
    expect(a.inkOf('walls')).not.toBe(b.inkOf('walls'));
    expect(new MeshBuilder({ ink: 12 }).inkOf('walls')).toBe(a.inkOf('walls'));
    expect(a.inkOf('x')).toBeGreaterThan(0);
    // Two boxes in one group read as one surface; a third in another group gets a seam.
    a.setInk('walls').box([0, 0, 0], [1, 1, 1]).box([1, 0, 0], [2, 1, 1]).setInk('roof').box([0, 1, 0], [2, 2, 1]);
    expect(inkGroups(a.build()).size).toBe(2);
    // A part can join its host's surface.
    b.setInkId(a.inkOf('walls')).box([2, 0, 0], [3, 1, 1]);
    expect([...inkGroups(b.build()).keys()]).toEqual([a.inkOf('walls')]);
  });

  test('with() scopes state changes', () => {
    const b = new MeshBuilder().setColor(0x112233).setPattern(PATTERN.grass);
    b.with({ color: '#ffffff', pattern: PATTERN.planks, edge: 0.5, sway: 1 }, () => b.tri([0, 0, 0], [1, 0, 0], [0, 1, 0]));
    b.tri([0, 0, 0], [1, 0, 0], [0, 1, 0]);
    const m = b.build();
    expect([m.color[0], m.pattern[0], m.edge[0], m.sway[0]]).toEqual([255, PATTERN.planks, 0.5, 1]);
    expect([m.color[9], m.pattern[3], m.edge[3], m.sway[3]]).toEqual([0x11, PATTERN.grass, EDGE_FAR, 0]);
  });

  test('sway can vary by local position and is clamped', () => {
    const m = new MeshBuilder().setSway((_x, y) => y * 2).box([0, 0, 0], [1, 1, 1], { only: ['s'] }).build();
    for (let v = 0; v < 6; v++) expect(m.sway[v]).toBe(Math.min(1, m.position[v * 3 + 1]! * 2));
  });

  test('parseColor accepts numbers, hex strings and triples', () => {
    expect(parseColor(0x3a2f2a)).toEqual([0x3a, 0x2f, 0x2a]);
    expect(parseColor('#3a2f2a')).toEqual([0x3a, 0x2f, 0x2a]);
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor([1, 2, 3])).toEqual([1, 2, 3]);
    expect(() => parseColor('tomato')).toThrow();
  });
});

describe('MeshBuilder transforms', () => {
  test('the transform stack moves positions and turns normals', () => {
    const b = new MeshBuilder();
    b.push().translate(10, 0, 0).rotateY(Math.PI / 2).box([0, 0, 0], [1, 1, 1], { only: ['s'] }).pop();
    b.box([0, 0, 0], [1, 1, 1], { only: ['s'] });
    const m = b.build();
    expect(normalAt(m, 0)).toEqual([1, 0, 0]); // +Z turned to +X
    expect(meshBounds(m).max[0]).toBeCloseTo(11, 6);
    expect(normalAt(m, 6)).toEqual([0, 0, 1]); // after pop: untransformed
    expect(() => new MeshBuilder().pop()).toThrow();
  });

  test('at() scopes a transform', () => {
    const b = new MeshBuilder();
    b.at(translation(0, 5, 0), () => b.box([0, 0, 0], [1, 1, 1]));
    b.box([0, 0, 0], [1, 1, 1]);
    expect(meshBounds(b.build())).toEqual({ min: [0, 0, 0], max: [1, 6, 1] });
  });

  test('non-uniform scale keeps normals perpendicular; mirroring keeps faces outward', () => {
    const squashed = new MeshBuilder().scale(1, 0.25, 1).lathe([[1, 0], [0, 1]], { segments: 16 }).build();
    expect(validateMesh(squashed)).toEqual([]);
    expect(windingMatchesNormals(squashed)).toBe(true);
    const mirrored = new MeshBuilder().scale(-1, 1, 1).box([0, 0, 0], [1, 1, 1]).build();
    expect(windingMatchesNormals(mirrored)).toBe(true);
    expect(volume(mirrored)).toBeCloseTo(1, 6);
  });

  test('add() appends another mesh under a transform and keeps its attributes', () => {
    const part = new MeshBuilder({ ink: 'part' }).setColor(0xff0000).setInk('g').box([0, 0, 0], [1, 1, 1]).build();
    const host = new MeshBuilder({ ink: 'host' }).box([0, 0, 0], [1, 1, 1]);
    host.add(part, translation(3, 0, 0)).add(part, scaling(-1, 1, 1));
    const m = host.build();
    expect(triangleCount(m)).toBe(36);
    expect(validateMesh(m)).toEqual([]);
    expect(windingMatchesNormals(m)).toBe(true);
    expect(m.inkId[36]).toBe(part.inkId[0]);
    expect(meshBounds(m)).toEqual({ min: [-1, 0, 0], max: [4, 1, 1] });
  });
});

describe('mesh utilities', () => {
  test('mergeMeshes concatenates; transformMesh places a copy', () => {
    const a = new MeshBuilder().box([0, 0, 0], [1, 1, 1]).build();
    const b = transformMesh(a, rotationY(Math.PI));
    const m = mergeMeshes([a, b, emptyMesh()]);
    expect(triangleCount(m)).toBe(24);
    expect(validateMesh(m)).toEqual([]);
    expect(meshBounds(b).min[0]).toBeCloseTo(-1, 6);
    expect(triangleCount(a)).toBe(12); // the input is untouched
  });

  test('findDuplicateFaces catches coincident faces between merged cells', () => {
    const naive = new MeshBuilder().box([0, 0, 0], [1, 1, 1]).box([1, 0, 0], [2, 1, 1]).build();
    expect(findDuplicateFaces(naive)).toBe(2); // the shared wall: 2 triangles on each side
    const merged = new MeshBuilder().box([0, 0, 0], [1, 1, 1], { skip: ['e'] }).box([1, 0, 0], [2, 1, 1], { skip: ['w'] }).build();
    expect(findDuplicateFaces(merged)).toBe(0);
  });

  test('validateMesh reports broken data', () => {
    const m = new MeshBuilder().box([0, 0, 0], [1, 1, 1]).build();
    m.normal[0] = 5;
    m.position[4] = Number.NaN;
    expect(validateMesh(m).length).toBe(2);
  });
});
