// The stats strip: how the town's mood moves, and what the silly counts are called.

import { defineStyle } from "@/core/style";

export type MoodCause =
  | "scene"
  | "market"
  | "festival"
  | "mend"
  | "fire"
  | "bomb"
  | "nuke"
  | "lightning"
  | "mallet"
  | "ruin"
  | "scuffle"
  | "raid"
  | "sunk";

export type SillyKey =
  | "loaves"
  | "fish"
  | "weddings"
  | "nukes"
  | "bombs"
  | "lightning"
  | "fires"
  | "ruined"
  | "scuffles"
  | "raids"
  | "burning";

export const MOOD = defineStyle(
  "stats-mood",
  {
    /** Where the mood settles when left alone (0 to 100), and the seconds it takes to close 63% of the gap. */
    rest: 70,
    recoverySeconds: 90,
  },
  { rest: [0, 100, 1], recoverySeconds: [10, 300, 5] },
);

/** What one of each thing does to the mood. Bombs are unpopular; weddings less so. */
export const MOOD_WEIGHTS: Record<MoodCause, number> = {
  scene: 6,
  market: 3,
  festival: 8,
  mend: 2,
  fire: -6,
  bomb: -10,
  nuke: -45,
  lightning: -4,
  mallet: -2,
  ruin: -1,
  scuffle: -3,
  raid: -15,
  sunk: -5,
};

/** The silly counts and their labels. The order here is the order they rotate in. */
export const SILLY: Record<SillyKey, string> = {
  loaves: "Loaves delivered",
  fish: "Fish landed",
  weddings: "Weddings",
  nukes: "Times nuked",
  bombs: "Bombs dropped",
  lightning: "Lightning strikes",
  fires: "Fires started",
  ruined: "Buildings ruined",
  scuffles: "Scuffles",
  raids: "Raids survived",
  burning: "On fire right now",
};
