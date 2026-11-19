// Who is at home (catalogue L25, for L07's window lights). The seam between
// the crowd and anything that wants to know which houses have somebody in.
//
// Two ways to read it, both keyed by the Signals object a behaviour or a
// system already has (one life runtime, one Signals, one census):
//
//   import { homeCensus } from '@/life/people/home';
//   const census = homeCensus(signals);
//   census.ready                     false until the crowd has seen a town
//   census.at(structureId)           residents inside that house right now
//   census.lit(structureId)          somebody is in (ready and at > 0)
//   census.version                   goes up whenever any count changes
//
//   signals.on('residentHome', ({ home, count }) => ...)   the same, as events
//
// Before the crowd has seen its first town `ready` is false and `at` is 0,
// so a window-light behaviour that wants lights without people (a scenario
// with no L21 rule) should treat `!ready` as "light them all".

import type { Signals } from '@/life/api';
import type { StructureId } from '@/resolve/plan';

declare module '@/life/api' {
  interface SignalEvents {
    /** The number of residents inside a home changed (somebody came in or went out). */
    residentHome: { home: StructureId; count: number };
    /** L08: the lamplighter reached a lamp. `lamp` is the lamp prop's id. */
    lampReached: { lamp: string };
    /** L23: the bell ringer went in to ring at dusk. The steeple, campanile or chapel. */
    bellRung: StructureId;
  }
}

export interface HomeCensus {
  /** True once the crowd has placed its residents. */
  ready: boolean;
  /** Bumped on every change. */
  version: number;
  /** Residents inside a home right now. */
  at(home: StructureId): number;
  /** Somebody is home. */
  lit(home: StructureId): boolean;
  /** Every home with its count. */
  readonly homes: ReadonlyMap<StructureId, number>;
}

interface Writable extends HomeCensus {
  counts: Map<StructureId, number>;
}

const censuses = new WeakMap<object, Writable>();

function censusFor(signals: object): Writable {
  let c = censuses.get(signals);
  if (!c) {
    const counts = new Map<StructureId, number>();
    c = {
      ready: false,
      version: 0,
      counts,
      homes: counts,
      at: (home) => counts.get(home) ?? 0,
      lit: (home) => (counts.get(home) ?? 0) > 0,
    };
    censuses.set(signals, c);
  }
  return c;
}

/** The census of the life runtime these signals belong to. */
export function homeCensus(signals: Signals): HomeCensus {
  return censusFor(signals);
}

/** The crowd's side: record a count. */
export function recordHome(signals: Signals, home: StructureId, count: number): void {
  const c = censusFor(signals);
  if (c.counts.get(home) === count) return;
  c.counts.set(home, count);
  c.version++;
}
export function markCensusReady(signals: Signals): void {
  const c = censusFor(signals);
  if (!c.ready) {
    c.ready = true;
    c.version++;
  }
}
