import { describe, expect, test } from 'vitest';
import { CELL_H, key, NO_CELL } from '@/core/grid';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { pickCell } from './pick';

const terrain = flatTerrain(1);
const town = new TownBuilder(emptyWorld(1), terrain).house(10, 10, { floors: 2 }).world;
const down = (x: number, z: number) => ({ origin: [x, 50, z] as const, dir: [0, -1, 0] as const });

describe('pickCell', () => {
  test('straight down onto grass targets the cell above the ground', () => {
    const p = pickCell(down(20.5, 20.5), town, terrain)!;
    expect(p).toMatchObject({ hit: 'terrain', cell: key(20, 0, 20), normal: [0, 1, 0], target: key(20, 1, 20), from: null });
    expect(p.point[1]).toBeCloseTo(CELL_H, 6);
  });

  test('onto a block targets the cell above it and remembers the block', () => {
    expect(pickCell(down(10.5, 10.5), town, terrain)).toMatchObject({ hit: 'block', cell: key(10, 2, 10), target: key(10, 3, 10), from: key(10, 2, 10) });
  });

  test('a side face targets the cell beside it', () => {
    const fromEast = { origin: [30, 1.5 * CELL_H, 10.5] as const, dir: [-1, 0, 0] as const };
    expect(pickCell(fromEast, town, terrain)).toMatchObject({ hit: 'block', cell: key(10, 1, 10), normal: [1, 0, 0], target: key(11, 1, 10) });
    const diagonal = { origin: [40, 30, 35] as const, dir: [-1, -1, -1].map((v) => v / Math.sqrt(3)) as unknown as readonly [number, number, number] };
    expect(pickCell(diagonal, town, terrain)?.hit).toBe('terrain');
  });

  test('open water targets (x, 0, z)', () => {
    const p = pickCell(down(1.5, 2.5), town, terrain)!;
    expect(p).toMatchObject({ hit: 'water', cell: key(1, 0, 2), target: key(1, 0, 2), from: null, normal: [0, 1, 0] });
    expect(p.point[1]).toBeCloseTo(CELL_H / 2, 6);
  });

  test('a ray that misses the map picks nothing; the top of the grid has no cell above', () => {
    expect(pickCell({ origin: [-10, 5, -10], dir: [0, 1, 0] }, town, terrain)).toBeNull();
    expect(pickCell({ origin: [100, 50, 100], dir: [0, -1, 0] }, town, terrain)).toBeNull();
    let w = new TownBuilder(emptyWorld(1), terrain);
    w = w.stack('pillar', 5, 5, { floors: 31 });
    expect(pickCell(down(5.5, 5.5), w.world, terrain)).toMatchObject({ hit: 'block', cell: key(5, 31, 5), target: NO_CELL });
  });
});
