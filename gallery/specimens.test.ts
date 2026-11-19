// The gallery's automatic specimens: every kind gets a town with pieces of
// that kind in it, and every part gets a town whose gallery rule emits it.

import { describe, expect, test } from 'vitest';
import { ALL_KINDS, FLOOR_KINDS, isFloorKind } from '@/core/kinds';
import { buildScenario, resolveScenario } from '@/scenario';
import { generatorSpecimen, layerSpecimen, partSpecimen, type SpecimenKind } from './specimens';

describe('automatic gallery specimens', () => {
  test.each<SpecimenKind>(['auto', ...ALL_KINDS, ...FLOOR_KINDS])('a specimen for %s holds pieces of that kind', (kind) => {
    const { world, cameras } = buildScenario(generatorSpecimen(kind));
    if (isFloorKind(kind as never)) {
      expect([...world.floors.values()].filter((f) => f === kind).length).toBeGreaterThan(3);
    } else {
      expect([...world.blocks.values()].filter((b) => b.kind === kind).length).toBeGreaterThan(0);
    }
    if (kind === 'fence' || kind === 'wall') expect([...world.edges.values()].filter((e) => e === kind).length).toBeGreaterThan(3);
    expect(cameras.length).toBeGreaterThan(0);
  });

  test('a part specimen emits exactly that feature, prop or actor through its own rule', () => {
    const door = resolveScenario(partSpecimen('feature', 'door'));
    const doors = door.shape.features.filter((f) => f.rule === 'X-G01.gallery-feature');
    expect(doors.map((f) => f.type)).toEqual(['door', 'door', 'door']);
    // On a ground-floor wall, on an upstairs wall, and on a roof cell with no side.
    expect(doors.map((f) => f.dir === undefined)).toEqual([false, false, true]);

    const lamp = resolveScenario(partSpecimen('prop', 'lamp'));
    expect(lamp.dressing.props.filter((p) => p.rule === 'X-G02.gallery-prop').map((p) => p.type)).toEqual(['lamp', 'lamp', 'lamp']);

    const gull = resolveScenario(partSpecimen('actor', 'gull'));
    expect(gull.dressing.actors.filter((a) => a.rule === 'X-G03.gallery-actor').map((a) => a.type)).toEqual(['gull', 'gull', 'gull']);
  });

  test('a layer specimen is an island with nothing built by hand', () => {
    const { scenario } = buildScenario(layerSpecimen('terrain'));
    expect(scenario.terrain).toBe('generated');
  });
});
