// Which game each court plays, how many it needs, who plays it, and where
// the players stand to begin. Read by the field chain.

import type { Court, FieldRole } from '@/rules/roles/field.lib';
import { basketball } from './basketball';
import { tennis } from './tennis';
import type { Athlete, Game } from './kit';

export interface Sport {
  /** Fewest and most players. */
  min: number;
  max: number;
  /** The errand tag players wear (the racket and the mallet are drawn from it). */
  tag: 'field:play' | 'field:racket' | 'field:mallet';
  /** Who comes: grown-ups, children, or both. */
  who: 'all' | 'adults' | 'children';
  make(court: Court, athletes: readonly Athlete[], opts: { seed: number; length?: number; ball?: { x: number; z: number } }): Game;
  /** Where player i of n (team i % 2) stands to begin, in court terms. */
  spot(court: Court, i: number, n: number): [number, number];
}

/** Two lines facing each other across the middle, team 0 on the −u side. */
function lines(c: Court, i: number, n: number, back = 0.45): [number, number] {
  const side = i % 2 === 0 ? -1 : 1;
  const k = Math.floor(i / 2), per = Math.ceil(n / 2);
  const v = (k - (per - 1) / 2) * Math.min(0.42, (c.hw * 1.6) / Math.max(1, per));
  return [side * Math.min(back, c.hl * 0.6), v];
}

export const SPORTS: Partial<Record<FieldRole, Sport>> = {
  'basketball-court': {
    min: 4,
    max: 6,
    tag: 'field:play',
    who: 'all',
    make: (c, a, o) => basketball(c, a, o),
    spot: (c, i, n) => lines(c, i, n),
  },
  'tennis-court': {
    min: 2,
    max: 4,
    tag: 'field:racket',
    who: 'adults',
    make: (c, a, o) => tennis(c, a, o),
    // The first two at the baselines, partners up at the net.
    spot: (c, i) => [(i % 2 === 0 ? -1 : 1) * (i < 2 ? c.hl - 0.1 : c.hl * 0.35), i < 2 ? 0.1 : -0.2],
  },
};
