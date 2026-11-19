// Vocabulary added by the life-depth owner (Stage 4): the rest of catalogue
// part L that is not people. Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    // L03. A windmill's cap (hood, crown ball, windshaft) at its 'mill-hub' socket; life turns it to the wind.
    'mill-cap': true;

    // L29. Mechanisms at the sockets their generators already declare.
    'bell': true; //                at a belfry's 'bell' socket: the pivot under the beam
    'clock-hands': true; //         at a 'clock-hands' socket; the actor is the hour hand
    'clock-hands/minute': true; //  spawned: the minute hand
    'clock-hands.radius': number;
    'water-jet': true; //           at a 'water-jet' socket (+Y the way the water sets off)
    'water-jet/arc': true; //       spilling or spouting: out along +Y, falling along −Z
    'water-jet/up': true; //        a jet shooting straight up and falling back round itself
    'water-jet/bead': true; //      spawned: a bead of water travelling the stream
    'water-jet.reach': number;
    'water-jet.drop': number;
  }
}
