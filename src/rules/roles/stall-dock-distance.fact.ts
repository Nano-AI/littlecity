// Steps from every column to the nearest dock (4-connected column steps, a
// dock's own column is 0; NONE where the town has no dock). For R-S01: a
// stall near a dock sells fish.

import { key } from '@/core/grid';
import { defineFact } from '@/resolve/facts/api';
import { columnDistance, type ColumnDistance } from '@/resolve/facts/lib';

export const stallDistToDock = defineFact<ColumnDistance>('stallDistToDock', (f) =>
  columnDistance((x, z) => f.kinds.get(key(x, 0, z)) === 'dock'),
);
