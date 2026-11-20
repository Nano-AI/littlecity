// Two tiers of tests (docs/swarm/test-diet.md).
//
//   npm run check        the fast gate, run at every merge: every rule, scenario, codec and flow, with
//                        sweeps sized to catch a class of bug, not to show off.
//   npm run check:full   the same plus the big sweeps, long simulations and heavy scans (LC_FULL=1):
//                        before a release or overnight.
//
//   import { FULL, sized } from '../../tests/helpers/tier';     // the path from your test file
//   const SEEDS = sized(20, 200);                             // 20 in the gate, 200 in the full run
//   test.runIf(FULL)('every seed of the old sweep', ...);     // only in the full run
//
// Keep seeds that once exposed a bug in the small set, and keep the invariant the same in both.

/** True in `npm run check:full` (LC_FULL=1). */
export const FULL = process.env.LC_FULL === '1';

/** `fast` in the gate, `full` in the full run. */
export function sized<T>(fast: T, full: T): T {
  return FULL ? full : fast;
}
