// Errands (the living town, L51 and up): what the crowd needs to know to send
// a resident on a piece of visible work. The work itself (who, when, what is
// carried where, what changes at each end) is decided by the town's chains
// (src/life/town); the crowd only walks people there and back.
//
// An errand is a list of steps. Each step is a place to walk to, what is
// carried on the way, and what to do on arrival: stand in a pose for a few
// seconds, or go in at a door for a few seconds. The chain hears of every
// arrival (it sets things down, picks them up, fills a stall) and is asked
// for the next step whenever the walker would choose what to do next.

import type { CellKey } from '@/core/grid';
import type { TimeSignal } from '@/life/api';
import type { PoseName } from '@/parts/people/pose';
import type { Person } from './crowd';

export type { Load } from '@/parts/people/loads';
import type { Load } from '@/parts/people/loads';


export interface ErrandStep {
  /** The walking-graph cell to go to. */
  cell: CellKey;
  /** Where in it to stand (world x, z), or null for its middle; and the heading to face there (NaN: as arrived). */
  spot: { x: number; z: number } | null;
  face: number;
  /** Go in at this door (its feature id) of `structure`, and stay inside `linger` seconds. */
  door: { feature: string; structure: number } | null;
  /** The pose held on arrival (outside), and for how long. */
  pose: PoseName;
  linger: number;
  /** What is carried on the way there. */
  load: Load | null;
  /** Walk briskly (a carter, the watchman trotting over). */
  brisk?: boolean;
  /** The chain's own note on what this step is. */
  readonly tag: string;
}

/** What the crowd asks of the town's chains. */
export interface ErrandHost {
  /** The next step for this person now, or null to choose as anybody would. Asked whenever they would choose. */
  next(p: Person, time: TimeSignal): ErrandStep | null;
  /** They got there (and are standing in the pose, or have gone in). */
  arrived(p: Person, step: ErrandStep): void;
  /** They cannot get there (no route, the place is gone): the chain drops their errand. */
  failed(p: Person, step: ErrandStep): void;
}
