import { describe, expect, test } from 'vitest';
import { identity, translation } from '@/core/mat4';
import { airborne, isAirMesh, MIST } from '@/gen/airborne';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { SLOT_AIR, SLOT_LIFTED, SlotTable } from './slots';

describe('what makes the grounding picture stale', () => {
  test('a grounded slot moving sets moved; an air slot does not; a lifted one is urgent', () => {
    const t = new SlotTable();
    const grounded = t.alloc();
    const air = t.alloc();
    const lifted = t.alloc();
    t.setKind(air, SLOT_AIR);
    t.setKind(lifted, SLOT_LIFTED);
    t.moved = t.urgent = false;
    t.setMatrix(air, translation(1, 2, 3));
    t.setVisible(air, false);
    expect(t.moved).toBe(false);
    t.setMatrix(grounded, translation(1, 0, 0));
    expect([t.moved, t.urgent]).toEqual([true, false]);
    t.moved = false;
    t.setMatrix(lifted, identity());
    expect([t.moved, t.urgent]).toEqual([true, true]);
    // A freed slot forgets it was in the air.
    t.release(air);
    const again = t.alloc();
    expect(again).toBe(air);
    t.moved = false;
    t.setMatrix(again, translation(0, 1, 0));
    expect(t.moved).toBe(true);
  });

  test('a mesh is air only when every vertex is airborne, mist or a beam', () => {
    const b = new MeshBuilder();
    b.setPattern(MIST).box([0, 0, 0], [1, 1, 1]);
    expect(isAirMesh(b.build())).toBe(true);
    b.setPattern(airborne(PATTERN.cloth)).box([2, 0, 0], [3, 1, 1]);
    expect(isAirMesh(b.build())).toBe(true);
    b.setPattern(PATTERN.none).box([4, 0, 0], [5, 1, 1]);
    expect(isAirMesh(b.build())).toBe(false);
    expect(isAirMesh(new MeshBuilder().build())).toBe(false);
  });
});
