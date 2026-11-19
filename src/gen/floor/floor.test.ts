import { afterEach, describe, expect, test } from 'vitest';
import { CELL_H, key, keyX, keyZ, S, type CellKey } from '@/core/grid';
import { resetStyles, setStyle } from '@/core/style';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allParts } from '@/gen/discover';
import { PATTERN, triangleCount, type MeshData } from '@/gen/mesh';
import { defineRule } from '@/resolve/engine/api';
import { resolveTown } from '@/resolve/index';
import type { ShapePlan, Structure } from '@/resolve/plan';
import J17 from '@/rules/joinery/J17.terrain-steps.rule';
import J21 from '@/rules/joinery/J21.floors.rule';
import J22, { largestSquareAt } from '@/rules/joinery/J22.plaza-paving.rule';
import RG01 from '@/rules/roles/R-G01.garden.rule';
import { TerrainBuilder, TownBuilder } from '@/scenario';
import { FLOOR } from '@/style/ground';
import { emptyWorld } from '@/world/world';
import gardenGen from './garden.gen';
import pathGen from './path.gen';
import plazaGen from './plaza.gen';

const RULES = [RG01, J17, J21, J22];

/** A test door: every house block gets a door on its south side. */
const doors = defineRule({
  id: 'J-T01.test-door',
  part: 'joinery',
  tier: 1,
  priority: 940,
  find: ({ facts }) => [...facts.kinds].filter(([, k]) => k === 'house').map(([cell]) => ({ anchor: cell, structure: facts.structureAt.get(cell)! })),
  apply: (c, out) => void out.feature({ type: 'door', structure: c.structure!, cell: c.anchor, dir: S, variant: 'plain' }),
});

function town(build: (b: TownBuilder) => void, terrain: (t: TerrainBuilder) => void = (t) => t.flat(1), rules = RULES, seed = 11): ShapePlan {
  const t = new TerrainBuilder(seed);
  terrain(t);
  const ground = t.build();
  const b = new TownBuilder(emptyWorld(seed), ground);
  build(b);
  return resolveTown(b.world, ground, { rules }).shape;
}
function floorAt(plan: ShapePlan, x: number, y: number, z: number): Structure {
  const s = plan.structures.get(plan.floorAt.get(key(x, y, z))!);
  if (!s) throw new Error(`no floor at (${x}, ${y}, ${z})`);
  return s;
}
function draw(plan: ShapePlan, x: number, y: number, z: number): MeshData {
  const s = floorAt(plan, x, y, z);
  const gen = s.kind === 'path' ? pathGen : s.kind === 'plaza' ? plazaGen : gardenGen;
  return gen.build(s, plan, allParts()).mesh;
}
const roleAt = (plan: ShapePlan, x: number, y: number, z: number): string | undefined => plan.roles.get(floorAt(plan, x, y, z).id)?.role;

/** Is the ground point (x, z) under an up-facing triangle of the mesh (at about height y, if given)? */
function covers(mesh: MeshData, x: number, z: number, y?: number): boolean {
  const p = mesh.position, n = mesh.normal;
  for (let t = 0; t < p.length / 9; t++) {
    if (n[t * 9 + 1]! < 0.9) continue;
    if (y !== undefined && Math.abs(p[t * 9 + 1]! - y) > 0.06) continue;
    const ax = p[t * 9]!, az = p[t * 9 + 2]!, bx = p[t * 9 + 3]!, bz = p[t * 9 + 5]!, cx = p[t * 9 + 6]!, cz = p[t * 9 + 8]!;
    const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz);
    const d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz);
    const d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    if (!(neg && pos)) return true;
  }
  return false;
}
/** Vertices of the mesh matching a test. */
function count(mesh: MeshData, test: (v: number) => boolean): number {
  let n = 0;
  for (let v = 0; v < mesh.pattern.length; v++) if (test(v)) n++;
  return n;
}

afterEach(() => resetStyles());

// ───────────────────────────────────────────────────────────────── paths ──

describe('paths (J21)', () => {
  const SHAPES: Record<string, (b: TownBuilder) => void> = {
    'a lone cell': (b) => b.path(20, 20),
    'a straight run': (b) => b.path(20, 20, 24, 20),
    'a corner': (b) => b.path([20, 20], [22, 20], [22, 22]),
    'a tee': (b) => b.path(20, 20, 24, 20).path(22, 21, 22, 22),
    'a cross': (b) => b.path(20, 20, 24, 20).path(22, 18, 22, 19).path(22, 21, 22, 22),
    'a block of four': (b) => b.path(20, 20, 21, 21),
    'a block of nine': (b) => b.path(20, 20, 22, 22),
    'a ring': (b) => b.path(20, 20, 22, 20).path(20, 22, 22, 22).path(20, 21).path(22, 21),
  };

  test.each(Object.keys(SHAPES))('%s: sound, no doubled faces, one ink group, in budget', (name) => {
    setStyle('floor', 'verge', 0);
    const plan = town(SHAPES[name]!);
    const s = floorAt(plan, 20, 1, 20);
    const mesh = draw(plan, 20, 1, 20);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(inkGroups(mesh).size).toBe(1);
    expect(triangleCount(mesh) / s.cells.length).toBeLessThanOrEqual(40);
    // Flat on the ground, a hair above it.
    for (let v = 0; v < mesh.position.length / 3; v++) expect(mesh.position[v * 3 + 1]!).toBeCloseTo(CELL_H + FLOOR.pathLift, 5);
    expect(draw(plan, 20, 1, 20)).toEqual(mesh);
  });

  test('a path is a ribbon: covered down the middle, grass at the cell corners, rounded at its ends', () => {
    const mesh = draw(town(SHAPES['a straight run']!), 20, 1, 20);
    for (let x = 20.3; x < 24.75; x += 0.11) for (const dz of [-0.25, 0, 0.25]) expect(covers(mesh, x, 20.5 + dz), `(${x}, ${20.5 + dz})`).toBe(true);
    for (let x = 20; x <= 25; x += 0.5) {
      expect(covers(mesh, x, 20.07)).toBe(false);
      expect(covers(mesh, x, 20.93)).toBe(false);
    }
    // The end is round: its middle reaches further than its corners.
    expect(covers(mesh, 20.2, 20.5)).toBe(true);
    expect(covers(mesh, 20.2, 20.2)).toBe(false);
    expect(covers(mesh, 24.8, 20.8)).toBe(false);
  });

  test('junctions are poured as one piece: no holes across cell borders, a fillet in each inner corner', () => {
    setStyle('floor', 'pathWobble', 0);
    const mesh = draw(town(SHAPES['a cross']!), 20, 1, 20);
    for (let t = 0.3; t < 4.75; t += 0.07) {
      expect(covers(mesh, 20 + t, 20.5), `along x at ${t}`).toBe(true);
      expect(covers(mesh, 22.5, 18 + t), `along z at ${t}`).toBe(true);
    }
    // Just inside each inner corner of the cross there is path (the fillet); further out there is grass.
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      expect(covers(mesh, 22.5 + sx * 0.37, 20.5 + sz * 0.37)).toBe(true);
      expect(covers(mesh, 22.5 + sx * 0.46, 20.5 + sz * 0.46)).toBe(false);
    }
  });

  test('four cells in a block are filled to the middle; a ring keeps its hole', () => {
    const block = draw(town(SHAPES['a block of four']!), 20, 1, 20);
    expect(covers(block, 21, 21)).toBe(true);
    expect(covers(block, 20.08, 20.08)).toBe(false); // the block's own outer corner is still rounded
    const ring = draw(town(SHAPES['a ring']!), 20, 1, 20);
    expect(covers(ring, 21.5, 21.5)).toBe(false);
  });

  test('it is made of what it lies on: earth on the ground, boards on a dock, cobbles on a bridge deck', () => {
    setStyle('floor', 'verge', 0);
    const plan = town(
      (b) => {
        for (let z = 30; z <= 33; z++) b.block('dock', 20, 0, z);
        b.path(20, 28, 20, 29).path(20, 30, 20, 33);
        b.put('arch', 30, 20).put('arch', 31, 20);
        b.path(30, 20, 31, 20);
      },
      (t) => {
        t.flat(1);
        t.water(4, 30, 43, 43);
      },
    );
    const land = draw(plan, 20, 1, 28), deck = draw(plan, 30, 2, 20);
    const patterns = (m: MeshData): Set<number> => new Set(m.pattern);
    // One path region runs from the beach onto the dock: earth, then boards along the run (z).
    expect(patterns(land)).toEqual(new Set([PATTERN.dirt, PATTERN.planksAcross]));
    expect(inkGroups(land).size).toBe(2);
    expect(patterns(deck)).toEqual(new Set([PATTERN.cobbles]));
  });

  test('a path meeting a plaza runs to the edge and ends in a flush kerb; without the plaza it stops short', () => {
    setStyle('floor', 'verge', 0);
    const lone = draw(town((b) => b.path(20, 20, 22, 20)), 20, 1, 20);
    expect(covers(lone, 22.95, 20.5)).toBe(false);
    const plan = town((b) => b.path(20, 20, 22, 20).plaza(23, 19, 25, 21));
    const mesh = draw(plan, 20, 1, 20);
    expect(covers(mesh, 22.9, 20.5)).toBe(true);
    expect(inkGroups(mesh).size).toBe(2); // the path and its kerb
    const top = Math.max(...Array.from({ length: mesh.position.length / 3 }, (_, v) => mesh.position[v * 3 + 1]!));
    expect(top).toBeCloseTo(CELL_H + FLOOR.plazaLift + 0.004, 4); // flush with the plaza
    expect(findDuplicateFaces(mesh)).toBe(0);
  });

  test('a path at a door widens into a doorstep', () => {
    setStyle('floor', 'verge', 0);
    const build = (b: TownBuilder): void => void b.house(21, 19).path(20, 20, 22, 20);
    const plain = draw(town(build), 20, 1, 20);
    const stepped = draw(town(build, undefined, [...RULES, doors]), 20, 1, 20);
    // Beside the ribbon, close to the house wall: grass without the door, path with it.
    expect(covers(plain, 21.5 + 0.4, 20.08)).toBe(false);
    expect(covers(stepped, 21.5 + 0.4, 20.08)).toBe(true);
    expect(covers(stepped, 21.5, 20.03)).toBe(true);
    expect(findDuplicateFaces(stepped)).toBe(0);
  });

  test('a path climbs a terrace by carved steps (J17): both levels run to the edge and the steps join them', () => {
    setStyle('floor', 'verge', 0);
    const plan = town(
      (b) => b.path(20, 18, 20, 23),
      (t) => {
        t.flat(1);
        t.rect(4, 4, 43, 20, 2);
      },
    );
    const steps = plan.features.filter((f) => f.type === 'terrain-steps');
    expect(steps).toHaveLength(1);
    expect(steps[0]!.cell).toBe(key(20, 1, 21));
    expect(steps[0]!.dir).toBe(0); // north, uphill
    const mesh = draw(plan, 20, 1, 21);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(covers(mesh, 20.5, 20.95, 2 * CELL_H)).toBe(true); // the upper level, at its edge
    expect(covers(mesh, 20.5, 20.5, 2 * CELL_H)).toBe(true);
    // The flight: stone between the two levels, inside the lower cell.
    const stone = count(mesh, (v) => mesh.pattern[v] === PATTERN.stone && mesh.position[v * 3 + 1]! > CELL_H + 0.1 && mesh.position[v * 3 + 1]! < 2 * CELL_H + 0.1);
    expect(stone).toBeGreaterThan(30);
    expect(triangleCount(mesh)).toBeLessThan(6 * 40 + 150);
  });

  test('verges: a clump, a stone or flowers beside some cells, seeded and only on grass', () => {
    const a = draw(town((b) => b.path(10, 20, 30, 20)), 10, 1, 20);
    setStyle('floor', 'verge', 0);
    const bare = draw(town((b) => b.path(10, 20, 30, 20)), 10, 1, 20);
    expect(triangleCount(a)).toBeGreaterThan(triangleCount(bare));
    expect((triangleCount(a) - triangleCount(bare)) / 21).toBeLessThan(40);
  });
});

// ──────────────────────────────────────────────────────────────── plazas ──

describe('plazas (J21, J22)', () => {
  test.each([
    ['a single cell', (b: TownBuilder): void => { b.plaza(20, 20); }],
    ['a 3 × 3', (b: TownBuilder): void => { b.plaza(20, 20, 22, 22); }],
    ['an L', (b: TownBuilder): void => { b.plaza(20, 20, 23, 21).plaza(20, 22, 21, 24); }],
    ['a 7 × 7', (b: TownBuilder): void => { b.plaza(20, 20, 26, 26); }],
  ] as const)('%s: one slab, one ink group, sides only on its outline', (_name, build) => {
    const plan = town(build);
    const s = floorAt(plan, 20, 1, 20);
    const mesh = draw(plan, 20, 1, 20);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(inkGroups(mesh).size).toBe(1);
    const cells = new Set(s.cells);
    // Every upright face lies on a cell side whose neighbour is outside the region.
    const p = mesh.position, n = mesh.normal;
    for (let t = 0; t < p.length / 9; t++) {
      if (Math.abs(n[t * 9 + 1]!) > 0.5) continue;
      const mx = (p[t * 9]! + p[t * 9 + 3]! + p[t * 9 + 6]!) / 3, mz = (p[t * 9 + 2]! + p[t * 9 + 5]! + p[t * 9 + 8]!) / 3;
      const inside = key(Math.floor(mx - n[t * 9]! * 0.1), 1, Math.floor(mz - n[t * 9 + 2]! * 0.1));
      const outside = key(Math.floor(mx + n[t * 9]! * 0.1), 1, Math.floor(mz + n[t * 9 + 2]! * 0.1));
      expect(cells.has(inside) && !cells.has(outside)).toBe(true);
    }
    expect(triangleCount(mesh)).toBeLessThanOrEqual(s.cells.length * 60 + 400);
  });

  test('J22: a border course from four cells, a centre motif from a 5 × 5', () => {
    const has = (plan: ShapePlan, type: string): boolean => plan.features.some((f) => f.type === type);
    const small = town((b) => b.plaza(20, 20, 21, 20));
    expect(has(small, 'plaza-border')).toBe(false);
    const four = town((b) => b.plaza(20, 20, 21, 21));
    expect(has(four, 'plaza-border')).toBe(true);
    expect(has(four, 'plaza-motif')).toBe(false);
    const five = town((b) => b.plaza(20, 20, 24, 24));
    const motif = five.features.find((f) => f.type === 'plaza-motif')!;
    expect(motif.cell).toBe(key(22, 1, 22));
    expect(motif.variant).toBe('rings');
    const seven = town((b) => b.plaza(20, 20, 26, 26));
    expect(seven.features.find((f) => f.type === 'plaza-motif')!.variant).toBe('compass');
    // A fountain on the centre keeps the rings and loses the star.
    const fountain = town((b) => b.plaza(20, 20, 26, 26).put('fountain', 23, 23));
    expect(fountain.features.find((f) => f.type === 'plaza-motif')!.variant).toBe('rings');
    // Bordered and with a star, a plaza is still one ink group, and paler than its border.
    const mesh = draw(seven, 20, 1, 20);
    expect(inkGroups(mesh).size).toBe(1);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(new Set(mesh.pattern).has(PATTERN.cobbles)).toBe(true);
  });

  test('largestSquareAt finds the first largest square', () => {
    const cells: CellKey[] = [];
    for (let z = 10; z < 13; z++) for (let x = 10; x < 16; x++) cells.push(key(x, 1, z));
    expect(largestSquareAt(cells)).toEqual({ x: 10, y: 1, z: 10, size: 3 });
  });
});

// ─────────────────────────────────────────────────────────────── gardens ──

describe('gardens (R-G01)', () => {
  const pond = (t: TerrainBuilder): void => {
    t.flat(1);
    t.water(30, 30, 34, 34);
  };
  const GARDENS: Record<string, { build: (b: TownBuilder) => void; at: [number, number]; terrain?: (t: TerrainBuilder) => void }> = {
    'flower-garden': { build: (b) => b.garden(20, 20, 21, 21), at: [20, 20] },
    'kitchen-garden': { build: (b) => b.house(19, 20).garden(20, 20, 21, 21), at: [20, 20] },
    'wheat-field': { build: (b) => b.stack('windmill', 19, 20, { floors: 2 }).garden(20, 20, 22, 21), at: [20, 20] },
    'herb-garden': { build: (b) => b.garden(20, 20, 21, 21).fenceAround(20, 20, 21, 21, 'wall'), at: [20, 20] },
    'reed-bed': { build: (b) => b.garden(29, 30, 29, 33), at: [29, 30], terrain: pond },
    'park-lawn': { build: (b) => b.garden(20, 20, 22, 22), at: [20, 20] },
  };

  test.each(Object.keys(GARDENS))('%s: the rule gives the role; the mesh is sound and in budget', (role) => {
    const g = GARDENS[role]!;
    const plan = town(g.build, g.terrain);
    expect(roleAt(plan, g.at[0], 1, g.at[1])).toBe(role);
    const s = floorAt(plan, g.at[0], 1, g.at[1]);
    const mesh = draw(plan, g.at[0], 1, g.at[1]);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(triangleCount(mesh) / s.cells.length, `${role}: ${triangleCount(mesh)} triangles on ${s.cells.length} cells`).toBeLessThanOrEqual(400);
    expect(inkGroups(mesh).size).toBeLessThanOrEqual(3 + s.cells.length * 5);
    // Nothing leaves the region's cells by more than a hedge's overhang, and nothing sinks under it.
    const xs = s.cells.map(keyX), zs = s.cells.map(keyZ);
    for (let v = 0; v < mesh.position.length / 3; v++) {
      expect(mesh.position[v * 3]!).toBeGreaterThan(Math.min(...xs) - 0.05);
      expect(mesh.position[v * 3]!).toBeLessThan(Math.max(...xs) + 1.05);
      expect(mesh.position[v * 3 + 2]!).toBeGreaterThan(Math.min(...zs) - 0.05);
      expect(mesh.position[v * 3 + 2]!).toBeLessThan(Math.max(...zs) + 1.05);
      expect(mesh.position[v * 3 + 1]!).toBeGreaterThanOrEqual(CELL_H - 1e-6);
    }
    expect(draw(plan, g.at[0], 1, g.at[1])).toEqual(mesh);
  });

  test('first match wins: a walled garden by the water is a herb garden; a big one by the water is a reed bed', () => {
    const walled = town((b) => b.garden(29, 30, 29, 31).fenceAround(28, 30, 29, 31, 'wall'), pond);
    expect(roleAt(walled, 29, 1, 30)).toBe('herb-garden');
    const big = town((b) => b.garden(26, 30, 29, 33), pond);
    expect(roleAt(big, 29, 1, 30)).toBe('reed-bed');
    // A windmill claims only gardens of four cells or more.
    const scrap = town((b) => b.stack('windmill', 19, 20, { floors: 2 }).garden(20, 20, 21, 20));
    expect(roleAt(scrap, 20, 1, 20)).toBe('flower-garden');
  });

  test('a park hedge is one ink group, and opens exactly where a path arrives', () => {
    const closed = draw(town((b) => b.garden(20, 20, 22, 22)), 20, 1, 20);
    const open = draw(town((b) => b.garden(20, 20, 22, 22).path(21, 23, 21, 24)), 20, 1, 20);
    const top = CELL_H + FLOOR.gardenLift + FLOOR.hedgeHeight;
    const hedgeAt = (m: MeshData, x: number, z: number): boolean => covers(m, x, z, top);
    expect(hedgeAt(closed, 21.5, 22.88)).toBe(true);
    expect(hedgeAt(open, 21.5, 22.88)).toBe(false);
    expect(hedgeAt(open, 20.4, 22.88)).toBe(true);
    expect(hedgeAt(open, 22.88, 21.5)).toBe(true);
    expect(hedgeAt(open, 21.5, 21.5)).toBe(false);
    const hedgeInks = new Set<number>();
    for (let v = 0; v < open.pattern.length; v++) if (open.pattern[v] === PATTERN.leaves && open.position[v * 3 + 1]! > CELL_H + 0.1) hedgeInks.add(open.inkId[v]!);
    expect(hedgeInks.size).toBe(1);
  });

  test('wheat ripples: its ears sway and its foot does not; a field of six cells has a scarecrow', () => {
    const plan = town(GARDENS['wheat-field']!.build);
    expect(plan.features.filter((f) => f.type === 'garden-piece' && f.variant === 'scarecrow')).toHaveLength(1);
    const mesh = draw(plan, 20, 1, 20);
    let ears = 0;
    for (let v = 0; v < mesh.sway.length; v++) {
      const h = mesh.position[v * 3 + 1]! - CELL_H;
      if (h < 0.1 && mesh.pattern[v] !== PATTERN.cloth) expect(mesh.sway[v]!).toBe(0);
      if (mesh.pattern[v] === PATTERN.crops && h > 0.2) ears = Math.max(ears, mesh.sway[v]!);
    }
    expect(ears).toBeGreaterThan(0.4);
  });

  test('planting keeps clear of whatever stands in a cell', () => {
    const empty = draw(town((b) => b.house(19, 20).garden(20, 20)), 20, 1, 20);
    const stall = draw(town((b) => b.house(19, 20).garden(20, 20).put('stall', 20, 20)), 20, 1, 20);
    expect(triangleCount(stall)).toBeLessThan(triangleCount(empty) / 3);
  });
});
