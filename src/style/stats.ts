// The stats strip: how the town's mood moves, and what the silly counts are called.

import { defineStyle } from "@/core/style";

export type MoodCause =
  | "scene"
  | "market"
  | "festival"
  | "mend"
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
    /** How far the settling point drops while every resident's home burns (scaled by the share whose homes do). */
    fireDrag: 40,
  },
  { rest: [0, 100, 1], recoverySeconds: [10, 300, 5], fireDrag: [0, 100, 1] },
);

/**
 * What one of each thing does to the mood. Flat ones are heard by the whole town; ruin, lightning and
 * mallet are scaled by the share (0 to 1) of residents whose homes were touched. Fires drag it instead (MOOD.fireDrag).
 */
export const MOOD_WEIGHTS: Record<MoodCause, number> = {
  scene: 4,
  market: 2,
  festival: 6,
  mend: 1,
  bomb: -1,
  nuke: -4,
  lightning: -40,
  mallet: -40,
  ruin: -60,
  scuffle: -1,
  raid: -8,
  sunk: -2,
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
