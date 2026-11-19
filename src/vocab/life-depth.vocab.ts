// Vocabulary added by the life-depth owner (Stage 4): the rest of catalogue
// part L that is not people. Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    // L03. A windmill's cap (hood, crown ball, windshaft) at its 'mill-hub' socket; life turns it to the wind.
    'mill-cap': true;

    // L18. The fishing boat's berth by the docks (world x, z and the yaw it lies at there).
    'fishing-boat.berthX': number;
    'fishing-boat.berthZ': number;
    'fishing-boat.berthYaw': number;

    // L05. One per tree: a leaf (or a fruit tree's petal) that now and then lets go and flutters down.
    'leaf': true;
    'leaf/leaf': true;
    'leaf/petal': true;
    'leaf.height': number; //       how high over its cell the crown is, world units
    'leaf.look': number;

    // L35. Over gardens by day, and by flower boxes and beds.
    'insect': true;
    'insect/butterfly': true;
    'insect/bee': true;
    'insect.look': number;

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
