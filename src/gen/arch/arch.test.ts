import { describe, expect, test } from 'vitest';
import { CELL_H, key } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allGenerators, allParts } from '@/gen/discover';
import { MeshBuilder, meshBounds, triangleCount } from '@/gen/mesh';
import { inksWhere, town } from '@/parts/monuments/testing';
import { archRuns } from '@/rules/joinery/J15.arch-runs.fact';
import type { TerrainBuilder } from '@/scenario';

const channel = (t: TerrainBuilder): void => {
  t.flat(1);
  t.water(4, 16, 43, 18);
};

describe('arch runs (J15, S1)', () => {
  test('a run of 2+ sets the axis; a lone arch follows the floor through it, or its neighbours', () => {
    const t = town((b) => {
      for (let z = 10; z <= 12; z++) b.put('arch', 10, z); // a run along z
      b.path(14, 8, 14, 12).put('arch', 14, 10); // a path along z through a lone arch
      b.put('marble', 18, 9).put('marble', 18, 11).put('arch', 18, 10); // blocks north and south
      b.put('arch', 22, 10);
    });
    const runs = archRuns(t.plan.facts);
    expect(runs.at(key(10, 1, 11))?.axis).toBe('z');
    expect(runs.at(key(10, 1, 11))?.run.cells.length).toBe(3);
    expect(runs.at(key(14, 1, 10))?.axis).toBe('x'); // spans across the path
    expect(runs.at(key(18, 1, 10))?.axis).toBe('z'); // spans between the blocks
    expect(runs.at(key(22, 1, 10))?.axis).toBe('x'); // nothing says otherwise
  });

  test('spans: one arch up to 3, a centre pier for 4 to 6', () => {
    for (const [len, piers, arches] of [[1, 0, 1], [2, 0, 1], [3, 0, 1], [4, 1, 2], [5, 1, 2], [6, 1, 2]] as const) {
      const t = town(
        (b) => {
          for (let z = 0; z < len; z++) b.block('arch', 10, 0, 16 + z);
        },
        { terrain: (tb) => tb.flat(1).water(4, 16, 43, 15 + len) },
      );
      const run = archRuns(t.plan.facts).runs[0]!;
      expect(run.piers.length, `piers under ${len}`).toBe(piers);
      expect(run.openings.length, `arches over ${len}`).toBe(arches);
      expect(run.stretches[0]).toMatchObject({ anchoredLo: true, anchoredHi: true, overWater: true });
      if (piers) expect(run.piers[0]!.at).toBe(len / 2);
      // The arches are equal and never longer than three cells.
      const widths = run.openings.map((o) => o.hi - o.lo);
      expect(Math.max(...widths)).toBeLessThanOrEqual(3);
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1e-6);
    }
  });

  test('a run anchored at one end hangs as a half arch for 2 cells, with a pier under each cell beyond', () => {
    const t = town((b) => {
      b.stack('marble', 10, 10, { floors: 2 });
      for (let x = 11; x <= 14; x++) b.block('arch', x, 2, 10);
      b.stack('marble', 10, 14, { floors: 2 }).block('arch', 11, 2, 14).block('arch', 12, 2, 14);
    });
    const long = archRuns(t.plan.facts).at(key(11, 2, 10))!.run;
    expect(long.piers.map((p) => p.at)).toEqual([2.5, 3.5]);
    expect(long.piers.every((p) => p.depth === 1 && !p.water)).toBe(true);
    const short = archRuns(t.plan.facts).at(key(11, 2, 14))!.run;
    expect(short.piers.length).toBe(0);
    expect(short.openings.length).toBe(1);
    expect(short.openings[0]).toMatchObject({ lo: 0, hi: 4, half: 'hi' }); // the crown is at the free end
  });

  test('a run with no anchor stands on a pier at each end', () => {
    const t = town((b) => {
      for (let x = 10; x <= 13; x++) b.block('arch', x, 3, 10);
    });
    const run = archRuns(t.plan.facts).runs[0]!;
    expect(run.piers.map((p) => p.at)).toEqual([0.5, 3.5]);
    expect(run.piers.every((p) => p.depth === 2)).toBe(true);
  });
});

describe('arch generator', () => {
  test('a standing arch: a sound mesh with an opening you can see through', () => {
    const t = town((b) => b.put('arch', 10, 10));
    const s = t.at(10, 1, 10);
    const mesh = t.draw(s);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(triangleCount(mesh)).toBeLessThan(500);
    const { min, max } = meshBounds(mesh);
    expect(min[1]).toBeCloseTo(CELL_H, 6);
    expect(max[1]).toBeLessThan(2 * CELL_H + 0.3); // the parapet
    expect(max[1]).toBeGreaterThan(2 * CELL_H + 0.05);
    // No stone in the middle of the passage below the spring line.
    const inPassage = inksWhere(mesh, (x, y) => Math.abs(x - 10.5) < 0.2 && y < CELL_H + 0.3 && y > CELL_H + 0.01);
    expect(inPassage.size).toBe(0);
  });

  test('a run is one surface: no faces between its cells, one body group, one cornice, one parapet', () => {
    const t = town((b) => {
      for (let x = 10; x <= 14; x++) b.put('arch', x, 10);
    });
    const s = t.at(10, 1, 10);
    const mesh = t.draw(s);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    const ink = new MeshBuilder({ ink: s.id });
    const groups = inkGroups(mesh);
    const names = ['body', 'cornice', 'parapet'].map((n) => ink.inkOf(n));
    for (const id of names) expect(groups.has(id)).toBe(true);
    // Besides those three: one voussoir ring and one coping for the whole run, and the keystones.
    expect(groups.has(ink.inkOf('ring'))).toBe(true);
    expect(groups.has(ink.inkOf('coping'))).toBe(true);
    expect(groups.size).toBe(5 + 5 * 2);
    // Nothing lies in the planes between cells above the openings (a wall there would be a doubled face).
    for (let x = 11; x <= 14; x++) {
      const between = inksWhere(mesh, (px, py) => Math.abs(px - x) < 1e-4 && py > CELL_H + 0.7 && py < 2 * CELL_H - 0.07);
      expect(between.size, `plane x = ${x}`).toBe(0);
    }
    expect(triangleCount(mesh)).toBeLessThan(5 * 500);
  });

  test('tiers: no cornice between them, one on top', () => {
    const t = town((b) => {
      for (let x = 10; x <= 12; x++) b.put('arch', x, 10).block('arch', x, 2, 10);
    });
    const s = t.at(10, 1, 10);
    expect(s.cells.length).toBe(6);
    const mesh = t.draw(s);
    expect(findDuplicateFaces(mesh)).toBe(0);
    const cornice = new MeshBuilder({ ink: s.id }).inkOf('cornice');
    let lowest = Infinity;
    for (let v = 0; v < mesh.inkId.length; v++) if (mesh.inkId[v] === cornice) lowest = Math.min(lowest, mesh.position[v * 3 + 1]!);
    expect(lowest).toBeGreaterThan(3 * CELL_H - 0.1); // only at the very top
  });

  test('stone bridge: one arch over three cells, humped, with end posts and a lamp socket', () => {
    const t = town(
      (b) => {
        for (let z = 16; z <= 18; z++) b.block('arch', 10, 0, z);
      },
      { terrain: channel },
    );
    const s = t.at(10, 0, 17);
    expect(t.plan.roles.get(s.id)?.role).toBe('stone-bridge');
    const out = allGenerators().build(s, t.plan, allParts());
    expect(validateMesh(out.mesh)).toEqual([]);
    expect(findDuplicateFaces(out.mesh)).toBe(0);
    expect(triangleCount(out.mesh)).toBeLessThan(3 * 600);
    // The parapet is highest over the middle cell.
    const parapet = new MeshBuilder({ ink: s.id }).inkOf('parapet');
    let mid = 0, end = 0;
    for (let v = 0; v < out.mesh.inkId.length; v++) {
      if (out.mesh.inkId[v] !== parapet) continue;
      const y = out.mesh.position[v * 3 + 1]!, z = out.mesh.position[v * 3 + 2]!;
      if (Math.abs(z - 17.5) < 0.3) mid = Math.max(mid, y);
      if (z < 16.05) end = Math.max(end, y);
    }
    expect(mid).toBeGreaterThan(end + 0.08);
    // The deck itself stays level, so floors and people stay on the grid: every upward body face is at the cell's top.
    const body = new MeshBuilder({ ink: s.id }).inkOf('body');
    let decks = 0;
    for (let v = 0; v < out.mesh.inkId.length; v += 3) {
      if (out.mesh.inkId[v] !== body || out.mesh.normal[v * 3 + 1]! < 0.9) continue;
      for (let k = 0; k < 3; k++) expect(out.mesh.position[(v + k) * 3 + 1]).toBeCloseTo(CELL_H, 6);
      decks++;
    }
    expect(decks).toBe(3 * 2);
    const ends = t.plan.sockets.filter((k) => k.type === 'bridge-end' && k.structure === s.id);
    expect(ends.length).toBe(2);
    for (const e of ends) expect(positionOf(out.anchors[e.id]!)[1]).toBeGreaterThan(CELL_H + 0.2);
    const crown = t.plan.sockets.find((k) => k.type === 'arch-crown' && k.structure === s.id)!;
    const c = positionOf(out.anchors[crown.id]!);
    expect(c[2]).toBeCloseTo(17.5, 5);
    expect(c[1]).toBeLessThan(CELL_H);
  });

  test('a pier goes down to the seabed, and two bridges side by side share one surface', () => {
    const t = town(
      (b) => {
        for (let z = 16; z <= 19; z++) b.block('arch', 10, 2, z).block('arch', 11, 2, z);
      },
      { terrain: (tb) => tb.flat(3).water(4, 16, 43, 19) },
    );
    const s = t.at(10, 2, 16);
    expect(s.cells.length).toBe(8);
    const mesh = t.draw(s);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(meshBounds(mesh).min[1]).toBeCloseTo(0, 6);
    // No wall between the two parallel runs.
    const between = inksWhere(mesh, (px, py) => Math.abs(px - 11) < 1e-4 && py > 2 * CELL_H + 0.01 && py < 3 * CELL_H - 0.01);
    expect(between.size).toBe(0);
  });
});
