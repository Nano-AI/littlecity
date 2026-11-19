// The dusk cycle (design section 12): one loop is 8 minutes. Owner: Look.

import { defineStyle } from '@/core/style';

export const TIME = defineStyle('time', {
  /** Seconds of each stretch, in loop order: day, dusk, night, dawn. */
  day: 270,
  dusk: 60,
  night: 105,
  dawn: 45,
  /** Life never steps further than this in one frame, in seconds (plan Review Focus 4). */
  maxStep: 0.1,
});
