// The numbers in the Auto block rules K1–K5 (design section 8). Owner: Logic.

import { defineStyle } from '@/core/style';

export const AUTO = defineStyle('auto', {
  /** K2: longest valid span. */
  spanMax: 6,
  /** K3: free run needed for a lighthouse. */
  lighthouseRun: 4,
  /** K3: how near open water must be, in columns. */
  lighthouseWater: 4,
  /** K4: free run needed for a tower. */
  towerRun: 3,
});
