// Docks: the generator's geometry (J23) and the dock rules (R-D01–R-D04,
// J23, J28). The rules and parts under test are imported by name, so these
// tests do not depend on what the other owners have discovered.

import { describe, expect, test } from 'vitest';
import { CELL_H, key, keyX, keyZ, SEA_Y } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { collectParts } from '@/gen/discover';
import { MeshBuilder, PATTERN, triangleCount, type MeshData } from '@/gen/mesh';
import { resolveTown } from '@/resolve/index';
import type { ShapePlan, Structure } from '@/resolve/plan';
import J23 from '@/rules/joinery/J23.dock-body.rule';
import J28 from '@/rules/joinery/J28.shoreline.rule';
import { boardwalkOf, dockLine, dockSide, pierOf, quayOf } from '@/rules/roles/dock-shape';
import RD01 from '@/rules/roles/R-D01.quay.rule';
import RD02, { ladderSide } from '@/rules/roles/R-D02.pier.rule';
import RD03 from '@/rules/roles/R-D03.boardwalk.rule';
import RD04 from '@/rules/roles/R-D04.jetty.rule';
import { TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import dockGenerator, { drawDock } from './dock.gen';

const RULES = [RD01, RD02, RD03, RD04, J23, J28];
const parts = collectParts(import.meta.glob('/src/parts/ground/{ramp,pier-head,bollard,dock-*}.part.ts', { eager: true }));

/** A beach along z = 29 with the sea south of it, a cove at x 36–38 and a bank at x 26–31. */
function town(build: (b: TownBuilder) => void, seed = 5): ShapePlan {
  const t = new TerrainBuilder(seed);
  t.flat(1).water(4, 30, 43, 43).water(36, 24, 38, 29).rect(26, 26, 31, 29, 2);
  const terrain = t.build();
  const b = new TownBuilder(emptyWorld(seed), terrain);
  build(b);
  return resolveTown(b.world, terrain, { rules: RULES }).shape;
}
const docks = (b: TownBuilder, cells: readonly (readonly [number, number])[]): void => cells.forEach(([x, z]) => b.block('dock', x, 0, z));
const run = (x0: number, z0: number, x1: number, z1: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) out.push([x, z]);
  return out;
};
const at = (plan: ShapePlan, x: number, z: number): Structure => plan.structures.get(plan.structureAt.get(key(x, 0, z))!)!;
const roleAt = (plan: ShapePlan, x: number, z: number): string | undefined => plan.roles.get(at(plan, x, z).id)?.role;
const draw = (plan: ShapePlan, s: Structure) => dockGenerator.build(s, plan, parts);
/** The dock's own timber, without its fitted features. */
const timber = (plan: ShapePlan, s: Structure): MeshData => {
  const b = new MeshBuilder({ ink: s.id });
  drawDock(b, s, plan);
  return b.build();
};
const inkOf = (s: Structure, group: string): number => new MeshBuilder({ ink: s.id }).inkOf(group);

interface Tri {
  ink: number;
  pattern: number;
  /** Centroid and normal. */
  c: [number, number, number];
  n: [number, number, number];
  ys: [number, number, number];
}
function tris(mesh: MeshData): Tri[] {
  const out: Tri[] = [];
  const p = mesh.position;
  for (let t = 0; t < p.length / 9; t++) {
    const v = (i: number, k: number): number => p[t * 9 + i * 3 + k]!;
    out.push({
      ink: mesh.inkId[t * 3]!,
      pattern: mesh.pattern[t * 3]!,
      c: [(v(0, 0) + v(1, 0) + v(2, 0)) / 3, (v(0, 1) + v(1, 1) + v(2, 1)) / 3, (v(0, 2) + v(1, 2) + v(2, 2)) / 3],
      n: [mesh.normal[t * 9]!, mesh.normal[t * 9 + 1]!, mesh.normal[t * 9 + 2]!],
      ys: [v(0, 1), v(1, 1), v(2, 1)],
    });
  }
  return out;
}

const SHAPES: Record<string, [number, number][]> = {
  'a lone block': [[10, 30]],
  'a line of five': run(10, 30, 10, 34),
  'an L': [...run(10, 30, 10, 32), [11, 32], [12, 32]],
  'a T': [...run(10, 30, 10, 33), [9, 33], [11, 33]],
  'a 2 × 3 block': run(10, 31, 11, 33),
  'a ring': [...run(10, 31, 12, 31), [10, 32], [12, 32], ...run(10, 33, 12, 33)],
  'a quay of nine under the bank': run(24, 30, 32, 30),
  'a boardwalk': run(36, 26, 38, 26),
};

describe('dock generator (J23)', () => {
  for (const [name, cells] of Object.entries(SHAPES)) {
    test(`${name}: a sound mesh, no doubled faces, inside its triangle budget`, () => {
      const plan = town((b) => docks(b, cells));
      const s = at(plan, cells[0]![0], cells[0]![1]);
      expect(s.cells.length).toBe(cells.length); // touching docks are one structure
      const { mesh } = draw(plan, s);
      expect(validateMesh(mesh)).toEqual([]);
      expect(findDuplicateFaces(mesh)).toBe(0);
      const own = timber(plan, s);
      expect(validateMesh(own)).toEqual([]);
      expect(findDuplicateFaces(own)).toBe(0);
      // Budget. The timber itself (deck, frame, piles, sills): at most 100 triangles plus 100 a cell
      // (a lone block is 168, a five-cell pier 456, an eight-cell ring 788). With every fitting
      // (bollards, ladder, pier head, crane, goods, mooring piles): at most 300 plus 250 a cell,
      // and under 1,800 for anything here (the nine-cell quay with its crane is about 1,500).
      expect(triangleCount(own)).toBeLessThanOrEqual(100 + 100 * cells.length);
      expect(triangleCount(mesh)).toBeLessThan(Math.min(1800, 300 + 250 * cells.length));
    });
  }

  test('the deck is one surface: one ink group across merged cells, its top exactly one cell high', () => {
    const cells = SHAPES['a 2 × 3 block']!;
    const plan = town((b) => docks(b, cells));
    const s = at(plan, 10, 31);
    const own = tris(timber(plan, s));
    const deck = inkOf(s, 'deck');
    const planks = own.filter((t) => t.pattern === PATTERN.planks || t.pattern === PATTERN.planksAcross);
    expect(planks.length).toBeGreaterThan(0);
    expect(new Set(planks.map((t) => t.ink))).toEqual(new Set([deck]));
    // Its top covers every cell at exactly CELL_H ...
    const tops = planks.filter((t) => t.n[1] > 0.99);
    for (const t of tops) for (const y of t.ys) expect(y).toBeCloseTo(CELL_H, 6);
    for (const [x, z] of cells) expect(tops.some((t) => Math.abs(t.c[0] - (x + 0.5)) < 0.5 && Math.abs(t.c[2] - (z + 0.5)) < 0.5)).toBe(true);
    // ... and nothing of the deck or the frame stands between merged cells.
    const frame = inkOf(s, 'frame');
    const inside = own.filter((t) => (t.ink === deck || t.ink === frame) && Math.abs(t.n[1]) < 0.5 && t.c[0] > 10.01 && t.c[0] < 11.99 && t.c[2] > 31.01 && t.c[2] < 33.99);
    expect(inside).toEqual([]);
    // The whole dock is a handful of surfaces: deck, frame, piles (no sills: it touches no land).
    expect(inkGroups(timber(plan, s)).size).toBe(3);
  });

  test('planks run along the dock, and each arm of an L keeps its own run', () => {
    const along = (cells: [number, number][], x: number, z: number): number => {
      const plan = town((b) => docks(b, cells));
      const s = at(plan, x, z);
      const top = tris(timber(plan, s)).find((t) => t.ink === inkOf(s, 'deck') && t.n[1] > 0.99 && Math.abs(t.c[0] - (x + 0.5)) < 0.4 && Math.abs(t.c[2] - (z + 0.5)) < 0.4)!;
      return top.pattern;
    };
    expect(along(run(10, 30, 10, 34), 10, 32)).toBe(PATTERN.planksAcross); // a run along z
    expect(along(run(8, 32, 12, 32), 10, 32)).toBe(PATTERN.planks); // a run along x
    const L = SHAPES['an L']!;
    expect(along(L, 10, 30)).toBe(PATTERN.planksAcross);
    expect(along(L, 12, 32)).toBe(PATTERN.planks);
    // The body of a wide deck is all one way.
    const wide = run(10, 31, 13, 33);
    expect(new Set(wide.map(([x, z]) => along(wide, x, z)))).toEqual(new Set([PATTERN.planks]));
  });

  test('stilts stand in the water under open edges, and not where the dock meets land or a cliff', () => {
    const plan = town((b) => docks(b, [...run(10, 30, 10, 34), ...run(24, 30, 32, 30)]));
    const pier = at(plan, 10, 30);
    const piles = tris(timber(plan, pier)).filter((t) => t.ink === inkOf(pier, 'piles'));
    expect(piles.length).toBeGreaterThan(0);
    expect(Math.min(...piles.flatMap((t) => t.ys))).toBeLessThan(SEA_Y - 0.1); // they run on down under the surface
    expect(piles.every((t) => t.c[2] > 30.5)).toBe(true); // none at the beach end
    // The free end has corner posts that rise above the deck; the long sides only stilts under it.
    const proud = piles.filter((t) => Math.max(...t.ys) > CELL_H + 0.1);
    expect(proud.length).toBeGreaterThan(0);
    expect(proud.every((t) => t.c[2] > 34.5)).toBe(true);
    // The quay under the bank: no stilt against the cliff, and no frame beam on that side.
    const quay = at(plan, 28, 30);
    const own = tris(timber(plan, quay));
    expect(own.filter((t) => t.ink === inkOf(quay, 'piles')).every((t) => t.c[2] > 30.5)).toBe(true);
    expect(own.filter((t) => t.ink === inkOf(quay, 'frame')).every((t) => t.c[2] > 30.5 || t.c[0] < 24.01 || t.c[0] > 32.99)).toBe(true);
  });

  test('a corner post does not come up through a house standing on the dock', () => {
    const free = town((b) => docks(b, run(10, 31, 11, 32)));
    const built = town((b) => {
      docks(b, run(10, 31, 11, 32));
      b.block('house', 11, 1, 32);
    });
    const high = (plan: ShapePlan): Tri[] => {
      const s = at(plan, 10, 31);
      return tris(timber(plan, s)).filter((t) => t.ink === inkOf(s, 'piles') && Math.max(...t.ys) > CELL_H + 0.05 && t.c[0] > 11.5 && t.c[2] > 32.5);
    };
    expect(high(free).length).toBeGreaterThan(0);
    expect(high(built)).toEqual([]);
    expect(at(built, 10, 31).hash).not.toBe(at(free, 10, 31).hash);
  });

  test('a sill lies where the deck meets level ground, and a ramp takes its place on a beach end', () => {
    const plan = town((b) => docks(b, [...run(10, 30, 13, 30), ...run(18, 30, 18, 32)]));
    const quay = at(plan, 10, 30), pier = at(plan, 18, 30);
    expect(tris(timber(plan, quay)).filter((t) => t.ink === inkOf(quay, 'sill')).length).toBeGreaterThan(0);
    expect(plan.featuresByStructure.get(pier.id)!.some((f) => f.type === 'ramp')).toBe(true);
    expect(tris(timber(plan, pier)).filter((t) => t.ink === inkOf(pier, 'sill'))).toEqual([]);
  });

  test('sockets get real frames: the pier end and seat on the deck, moorings on the water', () => {
    const plan = town((b) => docks(b, run(10, 30, 10, 34)));
    const s = at(plan, 10, 30);
    const { anchors } = draw(plan, s);
    const frameOf = (type: string): [number, number, number] => positionOf(anchors[plan.sockets.find((k) => k.type === type && k.structure === s.id)!.id]!);
    const lamp = frameOf('pier-end'), seat = frameOf('fishing-spot'), mooring = frameOf('mooring');
    expect(lamp[1]).toBeCloseTo(CELL_H, 6);
    expect(lamp[2]).toBeGreaterThan(34.5); // on the end cell, toward the sea
    expect(lamp[2]).toBeLessThan(35);
    expect(seat[1]).toBeGreaterThan(CELL_H + 0.1);
    expect(seat[1]).toBeLessThan(CELL_H + 0.25);
    expect(mooring[1]).toBeCloseTo(SEA_Y, 6);
    expect(Math.abs(mooring[0] - 10.5)).toBeGreaterThan(0.5); // off the side of the deck
    // The ladder is drawn by the generator itself: no part, no placeholder.
    expect(parts.has('feature', 'ladder')).toBe(false);
    const ladder = plan.features.find((f) => f.type === 'ladder')!;
    expect(inkGroups(draw(plan, s).mesh).has(inkOf(s, `ladder:${ladder.id}`))).toBe(true);
  });

  test('the same dock always draws the same mesh; a dock elsewhere does not change it', () => {
    const a = town((b) => docks(b, SHAPES['an L']!));
    const again = town((b) => docks(b, SHAPES['an L']!));
    const more = town((b) => docks(b, [...SHAPES['an L']!, ...run(20, 30, 20, 33)]));
    expect(Array.from(draw(a, at(a, 10, 30)).mesh.position)).toEqual(Array.from(draw(again, at(again, 10, 30)).mesh.position));
    expect(at(more, 10, 30).hash).toBe(at(a, 10, 30).hash);
    expect(Array.from(draw(more, at(more, 10, 30)).mesh.position)).toEqual(Array.from(draw(a, at(a, 10, 30)).mesh.position));
  });
});

describe('dock shapes', () => {
  const plan = town((b) => docks(b, [...run(10, 30, 10, 33), ...run(15, 30, 18, 30), ...run(36, 26, 38, 26), ...run(21, 32, 21, 34)]));
  test('what lies on each side of a dock cell', () => {
    expect(dockSide(plan, key(10, 0, 30), 0)).toBe('land');
    expect(dockSide(plan, key(10, 0, 30), 2)).toBe('dock');
    expect(dockSide(plan, key(10, 0, 30), 1)).toBe('open');
    const cliff = town((b) => {
      docks(b, [[28, 30], [29, 30]]);
      b.block('marble', 30, 0, 30);
    });
    expect(dockSide(cliff, key(28, 0, 30), 0)).toBe('cliff');
    expect(dockSide(cliff, key(29, 0, 30), 1)).toBe('solid');
  });
  test('lines, piers, boardwalks and quays', () => {
    const cells = (x: number, z: number): readonly number[] => at(plan, x, z).cells;
    expect(dockLine(plan, cells(10, 30))?.axis).toBe('z');
    expect(pierOf(plan, cells(10, 30), 3)?.seaward).toBe(2);
    expect(pierOf(plan, cells(10, 30), 3)?.cells.map(keyZ)).toEqual([30, 31, 32, 33]);
    expect(pierOf(plan, cells(10, 30), 5)).toBeNull();
    expect(pierOf(plan, cells(15, 30), 3)).toBeNull(); // along the shore
    expect(pierOf(plan, cells(21, 32), 3)).toBeNull(); // leads from nowhere
    expect(quayOf(plan, cells(15, 30), 4)?.landward).toBe(0);
    expect(quayOf(plan, cells(15, 30), 4)?.cells.map(keyX)).toEqual([15, 16, 17, 18]);
    expect(quayOf(plan, cells(10, 30), 4)).toBeNull();
    expect(boardwalkOf(plan, cells(36, 26), 2)?.axis).toBe('x');
    expect(boardwalkOf(plan, cells(10, 30), 2)).toBeNull();
  });
  test('a ladder hangs on the side the default view sees', () => {
    expect(ladderSide(2)).toBe(1); // a pier running south: east side
    expect(ladderSide(0)).toBe(1);
    expect(ladderSide(1)).toBe(2); // a pier running east: south side
    expect(ladderSide(3)).toBe(2);
  });
});

describe('dock rules', () => {
  test('R-D01 to R-D04: quay, pier, boardwalk, else jetty (first match wins)', () => {
    const plan = town((b) => docks(b, [...run(10, 30, 10, 33), ...run(15, 30, 18, 30), ...run(36, 26, 38, 26), ...run(21, 32, 21, 34), [23, 30], ...run(24, 30, 32, 30).slice(4)]));
    expect(roleAt(plan, 10, 30)).toBe('pier');
    expect(roleAt(plan, 15, 30)).toBe('quay');
    expect(roleAt(plan, 36, 26)).toBe('boardwalk');
    expect(roleAt(plan, 21, 32)).toBe('jetty');
    expect(roleAt(plan, 23, 30)).toBe('jetty');
    expect(roleAt(plan, 28, 30)).toBe('quay'); // five under the bank
    // Every dock has exactly one role, and each role came from its own rule.
    for (const s of plan.structures.values()) if (s.kind === 'dock') expect(plan.roles.get(s.id)).toBeDefined();
    expect(plan.roles.get(at(plan, 10, 30).id)!.rule).toBe('R-D02.pier');
    expect(plan.roles.get(at(plan, 21, 32).id)!.rule).toBe('R-D04.jetty');
  });

  test('R-D02: the pier head, its sockets and the ladder sit on the seaward end', () => {
    const plan = town((b) => docks(b, run(10, 30, 10, 33)));
    const s = at(plan, 10, 30);
    const fs = plan.featuresByStructure.get(s.id)!;
    const head = fs.find((f) => f.type === 'pier-head')!;
    expect([head.cell, head.dir]).toEqual([key(10, 0, 33), 2]);
    expect(plan.socketsByOwner.get(head.id)!.map((k) => k.type).sort()).toEqual(['fishing-spot', 'pier-end']);
    expect(fs.find((f) => f.type === 'ladder')).toMatchObject({ cell: key(10, 0, 33), dir: 1 });
    // No bollard takes the ladder's place or stands on the head.
    expect(fs.filter((f) => f.type === 'bollard').every((f) => f.cell !== key(10, 0, 33))).toBe(true);
  });

  test('R-D01 and J23: a quay gets iron bollards on the water side, goods, and a crane from 8 cells', () => {
    const plan = town((b) => docks(b, [...run(10, 30, 13, 30), ...run(24, 30, 32, 30)]));
    const short = plan.featuresByStructure.get(at(plan, 10, 30).id)!, long = plan.featuresByStructure.get(at(plan, 24, 30).id)!;
    expect(short.filter((f) => f.type === 'bollard').every((f) => f.variant === 'iron' && f.dir === 2)).toBe(true);
    expect(short.some((f) => f.type === 'dock-goods')).toBe(true);
    expect(short.some((f) => f.type === 'dock-crane')).toBe(false);
    const crane = long.find((f) => f.type === 'dock-crane')!;
    expect(crane.dir).toBe(2);
    // The crane has its cell to itself, and everything fitted claimed its place on the deck.
    expect(long.filter((f) => f.cell === crane.cell).map((f) => f.type)).toEqual(['dock-crane']);
    expect(plan.claims.get(`floor:${key(keyX(crane.cell!), 1, 30)}:c`)).toBe('J23.dock-body');
    for (const f of [...short, ...long]) if (f.type === 'bollard') expect(plan.socketsByOwner.get(f.id)!.map((k) => k.type)).toEqual(['mooring']);
  });

  test('R-D03: rope railings on both open sides of a boardwalk, on the deck level', () => {
    const plan = town((b) => docks(b, run(36, 26, 38, 26)));
    const rails = plan.featuresByStructure.get(at(plan, 36, 26).id)!.filter((f) => f.type === 'railing');
    expect(rails.length).toBe(6);
    expect(rails.every((f) => f.variant === 'rope' && (f.dir === 0 || f.dir === 2) && f.cell! >> 12 === 1)).toBe(true);
    expect(plan.features.some((f) => f.type === 'bollard')).toBe(false);
  });

  test('J28: a ramp where a dock steps onto a beach end on; none along the shore, at a cliff or into a house', () => {
    const plan = town((b) => {
      docks(b, [...run(10, 30, 10, 32), ...run(15, 30, 18, 30), [28, 30], [28, 31]]);
      b.put('house', 21, 29);
      docks(b, [[21, 30], [21, 31]]);
    });
    const ramps = plan.features.filter((f) => f.type === 'ramp');
    expect(ramps.map((f) => [f.cell, f.dir])).toEqual([[key(10, 0, 30), 0]]);
    expect(plan.claims.get(`floor:${key(10, 1, 29)}:s`)).toBe('J28.shoreline');
  });

  test('J28: mooring piles stand in free water, clear of bollards, each with a perch', () => {
    let seen = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const plan = town((b) => docks(b, [...run(10, 30, 10, 33), ...run(15, 31, 16, 33)]), seed);
      for (const f of plan.features.filter((x) => x.type === 'dock-pile')) {
        seen++;
        expect(dockSide(plan, f.cell!, f.dir as 0)).toBe('open');
        expect(plan.features.some((o) => o !== f && o.cell === f.cell && o.dir === f.dir)).toBe(false);
        expect(plan.socketsByOwner.get(f.id)!.map((k) => k.type)).toEqual(['perch']);
      }
    }
    expect(seen).toBeGreaterThan(4);
  });
});
