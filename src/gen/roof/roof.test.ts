// The roof height field: one rule (pitch × distance to the nearest eave)
// gives gables, hips and lean-tos on any right-angled footprint.

import { describe, expect, test } from 'vitest';
import { key, neighbor, type CellKey, type Dir4 } from '@/core/grid';
import { findDuplicateFaces, validateMesh } from '@/gen/checks';
import { MeshBuilder, meshBounds, PATTERN } from '@/gen/mesh';
import { emitRoof, roofField, type EdgeMode, type RoofInput } from './roof';

const cellsOf = (pairs: readonly (readonly [number, number])[]): CellKey[] => pairs.map(([x, z]) => key(x, 1, z));
const rect = (w: number, d: number): CellKey[] => {
  const out: CellKey[] = [];
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) out.push(key(10 + x, 1, 10 + z));
  return out;
};
const input = (cells: CellKey[], mode: (c: CellKey, d: Dir4) => EdgeMode, more: Partial<RoofInput> = {}): RoofInput => ({
  cells,
  mode,
  base: 2,
  rise: [0.5, 0.75, 0.95],
  lift: 0,
  sag: 0,
  tilt: 0,
  eave: 0.06,
  rake: 0.04,
  into: 0.07,
  ...more,
});
const hip = (): EdgeMode => 'eave';
const gableX = (_c: CellKey, d: Dir4): EdgeMode => (d === 1 || d === 3 ? 'rake' : 'eave');
const look = { color: '#e47a66', pattern: PATTERN.shingles, ink: 'roof', thick: 0.05, fascia: '#ffffff', fasciaInk: 'fascia' };

describe('roof field', () => {
  test('a gable on one cell: eaves at the base, a ridge half a cell in, the same along its length', () => {
    const c = key(10, 1, 10);
    const f = roofField(input([c], gableX));
    expect(f.span).toBeCloseTo(0.5);
    expect(f.rise).toBeCloseTo(0.5);
    expect(f.heightAt(c, 10.5, 10)).toBeCloseTo(2); // the eave line at the cell edge
    expect(f.heightAt(c, 10.5, 10.5)).toBeCloseTo(2.5); // the ridge
    expect(f.heightAt(c, 10, 10.5)).toBeCloseTo(2.5); // and it runs level to the gable end
    expect(f.heightAt(c, 10.5, 9.94)).toBeCloseTo(2 - 0.06); // the overhang keeps sloping
    expect(f.heightAt(c, 9.96, 10.25)).toBeCloseTo(f.heightAt(c, 10, 10.25)); // the rake overhang does not
    expect(f.crest(c).y).toBeCloseTo(2.5);
  });

  test('a hip on a 3 × 2: planes rise from all four sides to a one-cell ridge', () => {
    const cells = rect(3, 2);
    const f = roofField(input(cells, hip));
    expect(f.span).toBeCloseTo(1);
    expect(f.heightAt(key(11, 1, 10), 11.5, 11)).toBeCloseTo(2 + f.rise); // ridge
    expect(f.heightAt(key(10, 1, 10), 10.5, 10.5)).toBeCloseTo(2 + f.rise / 2); // half-way up the hip
    expect(f.heightAt(key(10, 1, 10), 10, 10)).toBeCloseTo(2); // the corner
    // Square distance: the same height along a line parallel to the nearest eave.
    expect(f.heightAt(key(11, 1, 10), 11.2, 10.3)).toBeCloseTo(f.heightAt(key(11, 1, 10), 11.8, 10.3));
  });

  test('a lean-to climbs from its one eave to the wall behind', () => {
    const cells = rect(3, 1);
    const mode = (_c: CellKey, d: Dir4): EdgeMode => (d === 2 ? 'eave' : d === 0 ? 'wall' : 'rake');
    const f = roofField(input(cells, mode, { pitch: 0.4 }));
    const c = key(11, 1, 10);
    expect(f.heightAt(c, 11.5, 11)).toBeCloseTo(2); // the eave, south
    expect(f.heightAt(c, 11.5, 10)).toBeCloseTo(2.4); // the wall, north
    expect(f.heightAt(c, 11.5, 9.93)).toBeCloseTo(2.428); // and on into the wall
  });

  test('the field is continuous across cells on an L, a U and a ring', () => {
    const shapes: Record<string, CellKey[]> = {
      L: cellsOf([[10, 10], [11, 10], [12, 10], [10, 11], [10, 12]]),
      U: cellsOf([[10, 10], [11, 10], [12, 10], [10, 11], [12, 11], [10, 12], [12, 12]]),
      ring: cellsOf([[10, 10], [11, 10], [12, 10], [10, 11], [12, 11], [10, 12], [11, 12], [12, 12]]),
    };
    for (const [name, cells] of Object.entries(shapes)) {
      const f = roofField(input(cells, hip));
      const set = new Set(cells);
      for (const c of cells) {
        for (const d of [1, 2] as Dir4[]) {
          const n = neighbor(c, d);
          if (!set.has(n)) continue;
          // Along the shared edge both cells give the same height.
          for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const x = (c & 63) + (d === 1 ? 1 : t), z = ((c >> 6) & 63) + (d === 2 ? 1 : t);
            expect(f.heightAt(c, x, z), `${name} edge`).toBeCloseTo(f.heightAt(n, x, z), 6);
          }
        }
        // A one-cell-wide arm is a little ridge down its middle.
        expect(f.crest(c).y, name).toBeGreaterThan(2.2);
      }
    }
  });

  test('sag lowers the middle of the ridge and leaves the eaves alone', () => {
    const cells = rect(4, 1);
    const flat = roofField(input(cells, gableX));
    const sagged = roofField(input(cells, gableX, { sag: 0.06 }));
    const mid = key(12, 1, 10);
    expect(sagged.heightAt(mid, 12, 10.5)).toBeCloseTo(flat.heightAt(mid, 12, 10.5) - 0.06);
    expect(sagged.heightAt(mid, 12, 10)).toBeCloseTo(flat.heightAt(mid, 12, 10));
    expect(sagged.heightAt(key(10, 1, 10), 10, 10.5)).toBeCloseTo(flat.heightAt(key(10, 1, 10), 10, 10.5));
    // The shading planes ignore it.
    expect(sagged.planeAt(mid, 12, 10.5)).toBeCloseTo(flat.heightAt(mid, 12, 10.5));
  });
});

describe('roof mesh', () => {
  test('every type on every shape is a sound mesh with no doubled faces, inside its overhang', () => {
    const shapes: CellKey[][] = [
      rect(1, 1),
      rect(2, 4),
      rect(3, 3),
      cellsOf([[10, 10], [11, 10], [12, 10], [10, 11], [10, 12]]),
      cellsOf([[10, 10], [11, 10], [12, 10], [10, 11], [12, 11], [10, 12], [11, 12], [12, 12]]),
    ];
    for (const cells of shapes) {
      for (const mode of [hip, gableX]) {
        const b = new MeshBuilder({ ink: 1 });
        emitRoof(b, roofField(input(cells, mode, { sag: 0.04, tilt: 0.02 })), look);
        const m = b.build();
        expect(validateMesh(m)).toEqual([]);
        expect(findDuplicateFaces(m)).toBe(0);
        const { min, max } = meshBounds(m);
        expect(min[0]).toBeGreaterThanOrEqual(10 - 0.06 - 1e-6);
        expect(min[2]).toBeGreaterThanOrEqual(10 - 0.06 - 1e-6);
        expect(max[1]).toBeLessThan(3.2);
        // The top of every triangle of the surface faces up.
        for (let v = 0; v < m.pattern.length; v++) if (m.pattern[v] === PATTERN.shingles) expect(m.normal[v * 3 + 1]).toBeGreaterThan(0);
      }
    }
  });

  test('a plain gable on one cell is a handful of triangles', () => {
    const b = new MeshBuilder({ ink: 1 });
    emitRoof(b, roofField(input(rect(1, 1), gableX)), look);
    expect(b.triangleCount).toBeLessThan(90);
  });
});
