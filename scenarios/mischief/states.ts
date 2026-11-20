// The damage states the mischief galleries line up, west to east (design
// section 13b). Shared by the gallery scenarios; not a scenario itself.

import type { TownBuilder } from '@/scenario';
import { packRuin } from '@/world/damage';

export const STATES: readonly { name: string; ruin: number }[] = [
  { name: 'sound', ruin: 0 },
  { name: 'scorched', ruin: packRuin({ stage: 1, cause: 'fire' }) },
  { name: 'half-burnt', ruin: packRuin({ stage: 2, cause: 'fire' }) },
  { name: 'burnt out', ruin: packRuin({ stage: 3, cause: 'fire' }) },
  { name: 'cracked', ruin: packRuin({ stage: 1, cause: 'blast' }) },
  { name: 'half-wrecked', ruin: packRuin({ stage: 2, cause: 'blast' }) },
  { name: 'rubble', ruin: packRuin({ stage: 3, cause: 'blast' }) },
  { name: 'clearing rubble', ruin: packRuin({ stage: 3, cause: 'blast', mending: true, progress: 2 }) },
  { name: 'walls going up', ruin: packRuin({ stage: 3, cause: 'fire', mending: true, progress: 10 }) },
  { name: 'rafters', ruin: packRuin({ stage: 3, cause: 'fire', mending: true, progress: 18 }) },
  { name: 'tiles', ruin: packRuin({ stage: 3, cause: 'fire', mending: true, progress: 22 }) },
  { name: 'painting', ruin: packRuin({ stage: 3, cause: 'fire', mending: true, progress: 29 }) },
];

/** Damages every block of a w × d × floors box whose lowest north-west cell is (x, y, z). */
export function ruinBox(b: TownBuilder, x: number, y: number, z: number, w: number, d: number, floors: number, value: number): void {
  if (!value) return;
  for (let dx = 0; dx < w; dx++) {
    for (let dz = 0; dz < d; dz++) {
      for (let f = 0; f < floors; f++) b.edit({ type: 'setRuin', cell: b.cell(x + dx, y + f, z + dz), ruin: value });
    }
  }
}
