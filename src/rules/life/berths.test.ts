// Berths and the ways in and out of them (berths.fact.ts, ship-routes.ts).

import { describe, expect, test } from 'vitest';
import { resolveScenario } from '@/scenario';
import { SHIPS } from '@/style/ships';
import galleonScn from '../../../scenarios/rules/L38.galleon.scenario';
import { findBerths, harbour, hullSize, mooredClear, planningField } from './berths.fact';
import { mooringAt, planArrival, planDeparture } from './ship-routes';

describe('debug', () => {
  test('L38 berths', () => {
    const town = resolveScenario(galleonScn);
    const f = town.shape.facts;
    const berths = findBerths(f);
    console.log(berths.map((b) => `${b.key} cells ${b.cells} level ${b.level} face ${JSON.stringify(b.face)}`));
    const b = berths[0]!;
    const field = planningField(f, b);
    const h = hullSize('galleon');
    for (const dir of [1, -1] as const) {
      const m = mooringAt(h, b.face, dir, SHIPS.alongside, SHIPS.warpGap);
      console.log(dir, JSON.stringify(m), 'moored', mooredClear(field, h, m), 'field at', field.at(m.x, m.z));
      const a = planArrival(field, h, m, SHIPS.edgeIn, 0.22);
      console.log('arrive', a ? a.path.length : null);
      const d = planDeparture(field, h, m, SHIPS.edgeIn, 0.22);
      console.log('depart', d ? d.path.length : null);
    }
    console.log(harbour(f).galleon);
    expect(berths.length).toBeGreaterThan(0);
  });
});
