// The nuke's clock (design section 13b, the owner's nuke), shared by the
// director (which damages each block as the shockwave reaches it) and the
// drawing (nuke.system.ts), so what is seen and what happens agree.
// Owner: Mischief. Pure. Times in seconds from the detonation.

export const NUKE_TIME = {
  /** The page whited out, then the light coming back. */
  whiteout: 0.07,
  lightBack: 0.55,
  /** The shockwave: how far it goes (cells) and how long it takes to get there. */
  waveReach: 26,
  waveTime: 0.85,
  /** The fireball swells on the ground, then lifts. */
  swell: 0.45,
  lift: 0.5,
  /** The rise: fast for the first second or two, slowing to its height (world units above the ground). */
  riseTime: 7,
  height: 14,
  /** The fire inside dies down; the cloud is smoke by this time, and grey a while after. */
  fireOut: 6,
  grey: 12,
  /** It drifts off and thins to nothing. */
  thinFrom: 16,
  gone: 42,
} as const;

/** The shockwave's radius (cells) at `t`: very fast at first, easing as it runs out. */
export function waveRadius(t: number): number {
  if (t <= 0) return 0;
  const u = Math.min(1, t / NUKE_TIME.waveTime);
  return NUKE_TIME.waveReach * (1 - (1 - u) ** 2.4);
}

/** 0 → 1 easing out (fast, then slow). */
export const easeOut = (u: number): number => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3;

/** The fireball's (and then the cap's) height above the ground at `t`. */
export function riseHeight(t: number): number {
  if (t < NUKE_TIME.lift) return 0;
  const u = (t - NUKE_TIME.lift) / NUKE_TIME.riseTime;
  // Most of the climb in the first two seconds.
  return NUKE_TIME.height * (1 - (1 - Math.min(1, u)) ** 3.2) + (u > 1 ? Math.min(1.2, (u - 1) * 0.6) : 0);
}
