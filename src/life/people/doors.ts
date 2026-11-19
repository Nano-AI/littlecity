// Doors that open (L29; design section 13, "Doors and thresholds"). Pure.
//
// The crowd owns one of these. Every step it says which doors somebody is
// about to go through (claim), and the table swings each door toward open
// or shut. The crowd lets nobody into a doorway until its door is open
// (ready), so nobody passes through a closed leaf; the door-leaf behaviour
// (src/life/doors/door-leaf.behaviour.ts) only draws the angle.
//
// A door is keyed by its NavDoor's `feature` (the door feature's id, or
// `hatch@<cell>` for a hatch the graph derived): the same id the door-leaf
// actor reads from its socket, and stable across edits.
//
//   open      0 shut … 1 fully open; moves at 1 / DOORS.openTime a second
//             opening, 1 / DOORS.shutTime closing (draw it eased)
//   hold      seconds it stays open after the last claim (DOORS.linger), so
//             two people in quick succession hold it open between them
//   standing  a shop's door by day: open with nobody about. It follows the
//             day after its own seeded delay, so a street's shops do not all
//             open on the same frame.

import { DOORS } from '@/style/animation';

export interface DoorState {
  open: number;
  hold: number;
  /** Claimed this step. */
  claimed: boolean;
  /** People on the doorway piece this step, going in and coming out. */
  goingIn: number;
  comingOut: number;
  /** Stands open (a shop by day), and what it is about to do once `delay` runs out. */
  standing: boolean;
  wantStanding: boolean;
  delay: number;
}

export interface DoorTable {
  readonly states: ReadonlyMap<string, DoorState>;
  /** 0 shut … 1 open (not eased). 0 for a door nobody has ever claimed. */
  open(key: string): number;
  /** Fully open: somebody may step through. */
  ready(key: string): boolean;
  /** Somebody needs this door open now. */
  claim(key: string): void;
  /** Somebody is on its doorway, going in (true) or coming out. */
  passing(key: string, inward: boolean): void;
  /** Who was on its doorway at the last step. */
  goingIn(key: string): number;
  comingOut(key: string): number;
  /** A door that stands open while `want` (a shop by day), changing `delay` seconds after `want` does. */
  stand(key: string, want: boolean, delay: number): void;
  /** From now until the next step, doors seen for the first time start as they should already be (a town just opened or edited). */
  settle(): void;
  step(dt: number): void;
}

export function createDoors(): DoorTable {
  const states = new Map<string, DoorState>();
  let settling = true;
  const get = (key: string): DoorState => {
    let s = states.get(key);
    if (!s) {
      s = { open: 0, hold: 0, claimed: false, goingIn: 0, comingOut: 0, standing: false, wantStanding: false, delay: 0 };
      states.set(key, s);
    }
    return s;
  };
  // Counts for the step being taken, and those of the step before (which the crowd reads while moving).
  const inNow = new Map<string, number>();
  const outNow = new Map<string, number>();
  return {
    states,
    open: (key) => states.get(key)?.open ?? 0,
    ready: (key) => (states.get(key)?.open ?? 0) >= 1,
    claim(key) {
      const s = get(key);
      s.claimed = true;
      if (settling) s.open = 1;
    },
    passing(key, inward) {
      const m = inward ? inNow : outNow;
      m.set(key, (m.get(key) ?? 0) + 1);
    },
    goingIn: (key) => states.get(key)?.goingIn ?? 0,
    comingOut: (key) => states.get(key)?.comingOut ?? 0,
    stand(key, want, delay) {
      const s = get(key);
      if (settling && s.open === 0 && !s.claimed) {
        s.standing = s.wantStanding = want;
        s.open = want ? 1 : 0;
        return;
      }
      if (want !== s.wantStanding) {
        s.wantStanding = want;
        s.delay = delay;
      }
    },
    settle() {
      settling = true;
    },
    step(dt) {
      settling = false;
      for (const [key, s] of states) {
        s.goingIn = inNow.get(key) ?? 0;
        s.comingOut = outNow.get(key) ?? 0;
        if (s.wantStanding !== s.standing) {
          s.delay -= dt;
          if (s.delay <= 0) s.standing = s.wantStanding;
        }
        if (s.claimed) s.hold = DOORS.linger;
        else if (s.hold > 0) s.hold = Math.max(0, s.hold - dt);
        const want = s.claimed || s.hold > 0 || s.standing;
        s.open = want ? Math.min(1, s.open + dt / DOORS.openTime) : Math.max(0, s.open - dt / DOORS.shutTime);
        s.claimed = false;
      }
      inNow.clear();
      outNow.clear();
    },
  };
}
