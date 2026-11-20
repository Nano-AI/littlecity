// The field's shape table (field.lib.ts, R-G03): each shape gives its court,
// near misses fall back sensibly, and growing a field a cell or a row at a
// time changes it only as documented. Also: placing and saving a field.

import { describe, expect, test } from 'vitest';
import { key, type CellKey } from '@/core/grid';
import { flatTerrain, TownBuilder } from '@/scenario';
import { resolveShape } from '@/resolve/index';
import { decodeTown, encodeTown } from '@/world/save';
import { applyEdit, canApply, emptyWorld } from '@/world/world';
import { courtFor, readField, type FieldRole } from './field.lib';

const rect = (x0: number, z0: number, w: number, d: number): CellKey[] => {
  const out: CellKey[] = [];
  for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) out.push(key(x, 1, z));
  return out;
};

describe('the table', () => {
  const table: [number, number, FieldRole][] = [
    [1, 1, 'kickabout-green'], [1, 2, 'kickabout-green'], [1, 3, 'boules-court'], [1, 4, 'boules-court'], [1, 5, 'running-track'], [1, 9, 'running-track'],
    [2, 2, 'kickabout-green'], [2, 3, 'basketball-court'], [2, 4, 'tennis-court'], [2, 6, 'tennis-court'], [2, 7, 'running-track'],
    [3, 3, 'basketball-court'], [3, 4, 'basketball-court'], [3, 5, 'tennis-court'], [3, 6, 'tennis-court'], [3, 7, 'football-pitch'],
    [4, 4, 'bowling-green'], [4, 5, 'croquet-lawn'], [4, 6, 'football-pitch'], [5, 5, 'football-pitch'], [8, 12, 'football-pitch'],
  ];
  test.each(table)('%i × %i is a %s, either way round', (a, b, role) => {
    expect(courtFor(a, b)).toBe(role);
    expect(courtFor(b, a)).toBe(role);
    expect(readField(rect(10, 10, a, b)).role).toBe(role);
    expect(readField(rect(10, 10, b, a)).role).toBe(role);
  });

  test('a court runs along its long side', () => {
    expect(readField(rect(10, 10, 5, 2)).along).toBe(0);
    expect(readField(rect(10, 10, 2, 5)).along).toBe(1);
  });
});

describe('near misses and growing', () => {
  test('a cell more or less round a court leaves the court as it was, in a grass apron', () => {
    const court = rect(10, 10, 4, 3);
    const bump = [...court, key(14, 1, 11)];
    const notch = court.filter((c) => c !== key(10, 1, 10));
    expect(readField(bump)).toMatchObject({ role: 'basketball-court', rect: { x0: 10, z0: 10, w: 4, d: 3 } });
    // A notch out of a 4 × 3 leaves a 4 × 2 or 3 × 3: still something sensible to play on, never nothing.
    expect(readField(notch).role).not.toBe('kickabout-green');
  });

  test('a tree standing in a corner is played round', () => {
    const court = rect(10, 10, 5, 2);
    const r = readField(court, (c) => c !== key(10, 1, 10));
    expect(r.role).toBe('tennis-court');
    expect(r.rect).toMatchObject({ w: 4, d: 2 });
  });

  test('an odd shape with no big enough rectangle is a kickabout green', () => {
    const l = [key(10, 1, 10), key(11, 1, 10), key(12, 1, 10), key(10, 1, 11), key(10, 1, 12)];
    expect(readField(l).role).toBe('kickabout-green');
    const diag = [key(10, 1, 10), key(11, 1, 11), key(12, 1, 12)];
    expect(readField(diag).role).toBe('kickabout-green');
  });

  test('growing a strip a cell at a time: green, boules, then a track', () => {
    const seen: FieldRole[] = [];
    for (let n = 1; n <= 7; n++) seen.push(readField(rect(10, 10, n, 1)).role);
    expect(seen).toEqual(['kickabout-green', 'kickabout-green', 'boules-court', 'boules-court', 'running-track', 'running-track', 'running-track']);
  });

  test('growing a court a row at a time walks the table: basketball, tennis, football', () => {
    const seen: FieldRole[] = [];
    for (let n = 3; n <= 8; n++) seen.push(readField(rect(10, 10, 3, n)).role);
    expect(seen).toEqual(['basketball-court', 'basketball-court', 'tennis-court', 'tennis-court', 'football-pitch', 'football-pitch']);
  });

  test('adding single cells to a court never changes it until a whole row is there', () => {
    const court = rect(10, 10, 4, 3);
    let cells = court.slice();
    for (let x = 10; x < 13; x++) {
      cells = [...cells, key(x, 1, 13)];
      expect(readField(cells).role).toBe('basketball-court');
    }
    cells = [...cells, key(13, 1, 13)];
    expect(readField(cells).role).toBe('bowling-green');
  });
});

describe('placing and saving', () => {
  const t = flatTerrain(3);

  test('a field is painted like a path and gets its court', () => {
    const b = new TownBuilder(emptyWorld(3), t);
    b.floor('field', 10, 10, 13, 12);
    const shape = resolveShape(b.world, t);
    const id = shape.floorAt.get(key(10, 1, 10))!;
    expect(shape.roles.get(id)?.role).toBe('basketball-court');
    expect(canApply(b.world, t, { type: 'placeFloor', cell: key(10, 1, 10), floor: 'field' }).ok).toBe(false);
    expect(canApply(b.world, t, { type: 'placeFloor', cell: key(10, 1, 10), floor: 'plaza' }).ok).toBe(true);
  });

  test('a town with a field saves and loads; a town with none encodes as before', () => {
    const b = new TownBuilder(emptyWorld(3), t);
    b.path(8, 8, 14, 8).house(9, 6);
    const before = encodeTown(b.world);
    let w = b.world;
    w = applyEdit(w, t, { type: 'placeFloor', cell: key(10, 1, 10), floor: 'field' });
    const code = encodeTown(w);
    const back = decodeTown(code);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.world.floors.get(key(10, 1, 10))).toBe('field');
    // Without the field the code is the old one, byte for byte (the field's code, 3, was unused before).
    w = applyEdit(w, t, { type: 'eraseFloor', cell: key(10, 1, 10) });
    expect(encodeTown(w)).toBe(before);
  });
});
