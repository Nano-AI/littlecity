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

    // L34. A sheep that wanders the open meadow; a chicken by a vegetable patch.
    'sheep': true;
    'sheep.look': number;
    'chicken': true;
    'chicken.look': number;

    // L31. Clouds drifting with the wind (at = null), each a few lobes and a shadow, spawned by the behaviour.
    'cloud': true;
    'cloud/shadow': true;
    'cloud.look': number;
    'cloud.index': number;
    // L30. Rarely, a hot-air balloon drifting across far behind the island (at = null).
    'balloon': true;
    'balloon.look': number;

    // L14 sparrows and L15 characters: small birds that perch, hop, circle or paddle.
    'small-bird': true;
    'small-bird/sparrow': true; //  L14, on a street
    'small-bird/dove': true; //     L15, at a dovecote's perch
    'small-bird/stork': true; //    L15, on its nest on a tower's tip
    'small-bird/owl': true; //      L15, at night, on the tallest tree or the observatory
    'small-bird/crow': true; //     L15, on the scarecrow
    'small-bird/duck': true; //     L15, on sheltered water, with ducklings
    'small-bird/duckling': true; // spawned by the duck
    'small-bird.height': number; // how high over its anchor it perches, world units

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
