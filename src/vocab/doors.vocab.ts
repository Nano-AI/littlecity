// Vocabulary added by animation polish (2026-11-19, "doors that open"). Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    // L29. The leaf of a door, at its 'door' socket (a derived roof hatch: at the hatch's cell). Drawn by
    // src/parts/actors/doors/door-leaf.part.ts, swung by src/life/doors/door-leaf.behaviour.ts; while the
    // part exists the door's own part leaves the leaf out and draws a dark doorway.
    'door-leaf': true;
    'door-leaf/plain': true; //   a house door (its look from the house's personality)
    'door-leaf/deck': true; //    onto a terrace, deck or bridge: always glazed
    'door-leaf/shop': true; //    the shop's glazed door; stands open by day
    'door-leaf/double': true; //  chapel, boathouse, town hall: the left leaf (the actor spawns the right)
    'door-leaf/double-right': true; // spawned: the right leaf of a double door
    'door-leaf/tower': true; //   a tower's, lighthouse's or keep's round-headed plank door
    'door-leaf/hatch': true; //   a trapdoor in a roof terrace (the frame comes with the lid when derived)
    'door-leaf.steps': number; // the door's stoop steps (the wall is that much farther from the socket)
    'door-leaf.look': number; //  the structure's hash: a repainted house redraws its leaf
    'door-leaf.derived': 0 | 1; // a hatch the walking graph derived: no feature draws its frame
    'door-leaf.frame': 0 | 1; //   spawned: a derived hatch's frame (the lid is the actor)
  }
}
