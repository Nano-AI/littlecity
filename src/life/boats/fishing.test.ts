// L18 on its fixture: through a whole day, at fixed steps.

import { describe, expect, test } from 'vitest';
import { columnIndex, inColumnBounds } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import { resolveScenario } from '@/scenario';
import scn from '../../../scenarios/rules/L18.fishing-boat.scenario';
import gull from '../birds/gull.behaviour';
import { createLife } from '../runtime';
import { createSignals, partPhases } from '../signals';
import { recordingStage, step } from '../testing/stage';
import fishing, { fishingBoatOf } from './fishing-boat.behaviour';

describe('the fishing boat (L18)', () => {
  test('home at night, out by day, never on land, home again after dusk with the gulls about it', () => {
    const town = resolveScenario(scn);
    const rec = recordingStage(town);
    const signals = createSignals(scn.seed);
    const life = createLife(rec.stage, signals, { behaviours: [fishing, gull], systems: [] });
    signals.setPhase(partPhases().night.mid);
    life.sync(town);
    const boat = town.dressing.actors.find((a) => a.type === 'fishing-boat')!;
    const p = boat.params as { berthX: number; berthZ: number };
    const fromBerth = (): number => {
      const [x, , z] = positionOf(rec.of(boat.id).matrix);
      return Math.hypot(x - p.berthX, z - p.berthZ);
    };
    const afloat = (): boolean => {
      const [x, , z] = positionOf(rec.of(boat.id).matrix);
      const cx = Math.floor(x), cz = Math.floor(z);
      return !inColumnBounds(cx, cz) || town.shape.terrain.height[columnIndex(cx, cz)] === 0;
    };
    step(life, signals, 2, 20);
    expect(fromBerth()).toBeLessThan(0.3);
    // Run the clock from the middle of the night round to the next one.
    let farthest = 0;
    let homeward = 0;
    let gullsNear = 0;
    for (let t = 0; t < 480; t += 1) {
      step(life, signals, 1, 20);
      expect(afloat(), `on the water at ${t} s`).toBe(true);
      farthest = Math.max(farthest, fromBerth());
      const news = fishingBoatOf(rec.stage);
      if (news?.homeward) {
        homeward++;
        const [bx, , bz] = positionOf(rec.of(boat.id).matrix);
        for (const g of town.dressing.actors.filter((a) => a.type === 'gull')) {
          const [x, , z] = positionOf(rec.of(g.id).matrix);
          if (Math.hypot(x - bx, z - bz) < 5) gullsNear++;
        }
      }
    }
    expect(farthest).toBeGreaterThan(4);
    expect(homeward).toBeGreaterThan(5);
    expect(gullsNear).toBeGreaterThan(0);
    // Back at its berth for the night.
    expect(signals.time.isNight).toBe(true);
    expect(fromBerth()).toBeLessThan(0.3);
  });
});
