// TEST SUPPORT (Dressing): the doorsteps of a scenario and close camera poses on each (doors.mjs).

import { CELL_H } from '@/core/grid';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { buildTown, doorsteps } from './doorsteps';

export interface DoorView {
  id: string;
  at: readonly [number, number, number];
  params: Record<string, number>;
  poses: { name: string; yaw: number; pitch: number; zoom: number; target: [number, number, number] }[];
}

export function list(name: string): DoorView[] {
  const scn = findScenario(name);
  if (!scn) throw new Error(`no scenario named '${name}'`);
  const built = buildScenario(scn);
  const opts = scenarioResolveOptions(scn);
  const shape = resolveShape(built.world, built.terrain, opts);
  const town = buildTown(shape, resolveDressing(shape, opts));
  return doorsteps(town).map((d) => {
    const yaw = (Math.atan2(d.out[0], d.out[2]) * 180) / Math.PI;
    const target: [number, number, number] = [d.at[0] - d.out[0] * 0.1, (d.at[1] + 0.1) / CELL_H, d.at[2] - d.out[2] * 0.1];
    return {
      id: d.id,
      at: d.at,
      params: d.params,
      poses: [
        { name: 'left', yaw: yaw - 40, pitch: 32, zoom: 14, target },
        { name: 'right', yaw: yaw + 40, pitch: 32, zoom: 14, target },
        { name: 'low', yaw: yaw + 10, pitch: 14, zoom: 14, target },
      ],
    };
  });
}
