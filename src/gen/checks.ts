// Mesh checks for generator and part tests (Stage 0, real; treat as frozen).
//
//   expect(validateMesh(mesh)).toEqual([]);
//   expect(findDuplicateFaces(mesh)).toBe(0);      // no doubled walls between merged cells
//   expect(triangleCount(mesh)).toBeLessThan(600); // the triangle budget
//   expect(inkGroups(mesh).size).toBe(3);          // walls, roof, trim

import { triangleCount, type MeshData } from './mesh';

/** Problems with a mesh's data: wrong lengths, non-finite positions, non-unit normals, ink id 0. Empty if fine. */
export function validateMesh(mesh: MeshData): string[] {
  const problems: string[] = [];
  const n = mesh.position.length / 3;
  if (!Number.isInteger(n / 3)) problems.push(`position holds ${mesh.position.length} numbers, not whole triangles`);
  const want: [string, number, number][] = [
    ['normal', mesh.normal.length, n * 3],
    ['color', mesh.color.length, n * 3],
    ['pattern', mesh.pattern.length, n],
    ['inkId', mesh.inkId.length, n],
    ['edge', mesh.edge.length, n],
    ['sway', mesh.sway.length, n],
  ];
  for (const [name, got, expected] of want) if (got !== expected) problems.push(`${name} has ${got} entries, expected ${expected}`);
  let badPos = 0, badNormal = 0, zeroInk = 0;
  for (let i = 0; i < mesh.position.length; i++) if (!Number.isFinite(mesh.position[i]!)) badPos++;
  for (let v = 0; v < mesh.normal.length / 3; v++) {
    const len = Math.hypot(mesh.normal[v * 3]!, mesh.normal[v * 3 + 1]!, mesh.normal[v * 3 + 2]!);
    if (!(Math.abs(len - 1) < 1e-3)) badNormal++;
  }
  for (let v = 0; v < mesh.inkId.length; v++) if (mesh.inkId[v] === 0) zeroInk++;
  if (badPos) problems.push(`${badPos} position values are not finite`);
  if (badNormal) problems.push(`${badNormal} normals are not unit length`);
  if (zeroInk) problems.push(`${zeroInk} vertices have ink id 0`);
  return problems;
}

/**
 * The number of doubled faces: pairs of triangles on the same three points,
 * or pairs of quads on the same four points (whatever their winding or
 * diagonal). Merged cells must not leave any: a doubled wall between two
 * cells z-fights and wastes triangles.
 */
export function findDuplicateFaces(mesh: MeshData, precision = 1e-4): number {
  const p = mesh.position;
  const q = (v: number): number => Math.round(v / precision);
  const corner = (v: number): string => `${q(p[v * 3]!)},${q(p[v * 3 + 1]!)},${q(p[v * 3 + 2]!)}`;
  const tris = p.length / 9;
  const triSeen = new Map<string, number>();
  const quadSeen = new Map<string, number>();
  let pairs = 0;
  const note = (seen: Map<string, number>, k: string): boolean => {
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return n > 0;
  };
  for (let t = 0; t < tris; t++) {
    const a = [corner(t * 3), corner(t * 3 + 1), corner(t * 3 + 2)];
    const triDup = note(triSeen, [...a].sort().join('|'));
    // Two consecutive triangles with four distinct corners between them and one normal are a quad.
    let quadDup = false;
    if (t % 2 === 0 && t + 1 < tris) {
      const all = new Set([...a, corner(t * 3 + 3), corner(t * 3 + 4), corner(t * 3 + 5)]);
      const n = mesh.normal;
      const dot = n[t * 9]! * n[t * 9 + 9]! + n[t * 9 + 1]! * n[t * 9 + 10]! + n[t * 9 + 2]! * n[t * 9 + 11]!;
      if (all.size === 4 && Math.abs(dot) > 0.999) quadDup = note(quadSeen, [...all].sort().join('|'));
    }
    if (triDup) pairs++;
    else if (quadDup) pairs += 2;
  }
  return pairs;
}

/** Triangle count per ink id: one entry per surface that will be outlined separately. */
export function inkGroups(mesh: MeshData): Map<number, number> {
  const groups = new Map<number, number>();
  for (let v = 0; v < mesh.inkId.length; v += 3) groups.set(mesh.inkId[v]!, (groups.get(mesh.inkId[v]!) ?? 0) + 1);
  return groups;
}

export { triangleCount };
