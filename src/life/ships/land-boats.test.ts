// Shaping the land under boats and ships: filling the water a boat floats in
// goes through the same path as building on it (it is nudged aside or sails
// off), and water dug out of the land is water they may use. Nothing throws,
// no hull is drawn at another size, every boat ends in free water or gone.

import { describe, expect, test } from 'vitest';
import { columnIndex } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import type { Edit, World } from '@/core/world';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { lowObstacles } from '@/rules/life/L41.river-barge.rule';
import { seaField } from '@/rules/life/ship-routes';
import { resolveScenario } from '@/scenario';
import { landEditable } from '@/terrain/land';
import { applyEdit, canApply } from '@/world/world';
import scn from '../../../scenarios/rules/L38.galleon.scenario';
import fishing from '../boats/fishing-boat.behaviour';
import rowboat from '../boats/rowboat.behaviour';
import sailboat from '../boats/sailboat.behaviour';
import { createLife } from '../runtime';
import { createSignals, partPhases } from '../signals';
import { recordingStage } from '../testing/stage';
import ferry, { leaversOf } from './ferry.system';
import harbourSystem from './harbour.system';
import { harbourOf } from './visit';

type Town = ReturnType<typeof resolveScenario>;

/** The columns a boat or a ship is over now, and their neighbours (what a player filling under it would raise). */
function under(points: readonly [number, number][]): number[] {
  const out = new Set<number>();
  for (const [x, z] of points) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (landEditable(Math.floor(x) + dx, Math.floor(z) + dz)) out.add(columnIndex(Math.floor(x) + dx, Math.floor(z) + dz));
  }
  return [...out];
}

function edit(world: World, base: Town, e: Edit): World {
  return canApply(world, base.terrain, e).ok ? applyEdit(world, base.terrain, e) : world;
}

describe('boats and ships on reshaped water', () => {
  test('filling the water under the boats and ships nudges them aside or sends them off; dug water is sailed', () => {
    const full = resolveScenario(scn);
    let world = full.world;
    let current = { shape: full.shape, dressing: full.dressing };
    const rec = recordingStage(current);
    const signals = createSignals(scn.seed);
    signals.setPhase(partPhases().day.start + 0.02);
    signals.hold('run');
    const life = createLife(rec.stage, signals, { behaviours: [sailboat, fishing, rowboat], systems: [harbourSystem, ferry] });
    life.sync(current);
    const harbour = harbourOf(rec.stage)!;
    const dt = 1 / 20;
    const sync = (): void => {
      const shape = resolveShape(world, full.terrain);
      current = { shape, dressing: resolveDressing(shape) };
      rec.setTown(current.shape, current.dressing);
      life.sync(current);
    };
    let filled = 0;
    for (let t = 0; t < 360; t += dt) {
      if (Math.abs(t - 150) < dt / 2) {
        // Under every hull afloat: the ships' and every small boat's.
        const at: [number, number][] = harbour.ships.filter((s) => s.body).map((s) => [s.pose.x, s.pose.z]);
        for (const a of current.dressing.actors) {
          if (!['sailboat', 'fishing-boat', 'rowboat'].includes(a.type)) continue;
          const m = rec.of(a.id)?.matrix;
          if (m) at.push([positionOf(m)[0], positionOf(m)[2]]);
        }
        const before = world;
        world = edit(world, full, { type: 'land', up: under(at), down: [] });
        filled = world === before ? 0 : under(at).length;
        sync();
      }
      if (Math.abs(t - 200) < dt / 2) {
        // A channel dug inland from the harbour.
        const cols: number[] = [];
        for (let z = 12; z <= 22; z++) cols.push(columnIndex(24, z));
        world = edit(world, full, { type: 'land', up: [], down: cols });
        sync();
      }
      life.update(signals.advance(dt));
    }
    expect(filled).toBeGreaterThan(0);
    const low = seaField(lowObstacles(current.shape.facts));
    for (const l of leaversOf(rec.stage)) expect(low.at(l.x, l.z), `${l.type} ${l.mode}`).toBeGreaterThan(0.1);
    for (const a of current.dressing.actors) {
      if (!['sailboat', 'fishing-boat', 'rowboat'].includes(a.type)) continue;
      const m = rec.of(a.id)?.matrix;
      if (!m) continue;
      const [x, , z] = positionOf(m);
      expect(current.shape.terrain.height[columnIndex(Math.floor(x), Math.floor(z))], `${a.id} afloat`).toBe(0);
    }
  }, 120_000);
});
