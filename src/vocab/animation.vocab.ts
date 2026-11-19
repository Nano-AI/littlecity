// Vocabulary added by the Animation owner (Stage 3): the moving things of
// catalogue part L that the tier-1 list in src/core/vocab.ts did not name,
// and the params the behaviours in src/life read. Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    // L02. How many storeys of house stand under the chimney (a taller house draws a longer plume).
    'smoke.size': number;

    // L03. A weathervane on a 'tower-top' socket: an arrow that swings to the wind.
    'weathervane': true;
    'weathervane/arrow': true;
    'weathervane/cock': true;

    // L06. What the ring goes round: decides its radius.
    'water-ring/stilt': true; //   a dock or house stilt
    'water-ring/pillar': true; //  a placed pillar or pier standing in the sea
    'water-ring/hull': true; //    spawned under a boat at run time
    'water-ring.radius': number; // world units; default by variant

    // L07. One per house: the structure's windows as a whole (the page lights the panes one by one;
    // the behaviour decides whether anyone is home and when the house goes to bed).
    'window-light.bedtime': number; // 0–1 through the night: when a home goes to bed (L07: the first half of the night)
    'window-light.inn': 0 | 1; //     an inn: lit all night
    'window-light.baker': 0 | 1; //   the bakery: lights first, before dawn
    'window-light.owl': 0 | 1; //     up late: lit through the night, now and then going out for a while
    'window-light.early': number; //  0–1 through dawn when an early riser lights up; above 1 = sleeps in
    'window-light.storeys': number; // storeys of the house (upstairs goes dark last)
    'window-light.windows': number; // how many windows the house has
    'window-light.look': number; //    changes when the house's shop windows do (so the panes are redrawn)

    // L09. Length of the shaft in world units (set from the lighthouse's height).
    'lighthouse-beam.reach': number;
    // L09. The pool of light the beam lays on the sea: a second actor at the same socket.
    'beam-glow': true;
    'beam-glow.reach': number;
    'beam-glow.drop': number; //       world units from the lantern down to the waterline

    // L11. Where the gull likes to sit: a 'perch' or 'mooring' socket id, or '' for none.
    'gull.perch': string;
    'gull.count': number; //           size of its flock (for spacing round the circle)
    // L12. The plaza region the pigeon belongs to, and its flock's size.
    'pigeon.plaza': number;
    'pigeon.count': number;
    'pigeon.perch': string;
    // L13.
    'swift.count': number;
    'swift.height': number; //         top of the structure it loops, in levels

    // Wings are drawn apart from the body so they can beat. Spawned at run time by the bird
    // behaviours, never by rules. Variant = the species.
    'bird-wing': true;
    'bird-wing/gull': true;
    'bird-wing/pigeon': true;
    'bird-wing/swift': true;
    'bird-wing.side': number; //       -1 left, 1 right

    // L17. Which way round the boat lies and what it is painted.
    'rowboat.look': number;
    'rowboat.line': number; //         length of the mooring line, world units
    // L19.
    'sailboat.count': number; //       boats sharing the loop
    'sailboat.look': number;
    // L18 (tier 2): the mesh ships now, the rule later.
    'fishing-boat': true;
    'fishing-boat.look': number;

    // Boat pieces that move apart from the hull. Spawned at run time, never by rules.
    'boat-sail': true;
    'boat-sail/main': true;
    'boat-sail/jib': true;
    'boat-sail.look': number;
    'mooring-line': true; //           a unit length of rope along +X; the behaviour stretches it

    // Run-time effects (spawned by feedback and wind behaviours, never by rules).
    'dust-ring.size': number;
    'sparkle.look': number;
    'puff/dust': true;
    'puff/smoke': true;
    'puff/pop': true;
    'puff/mist': true; //              a soft wash with no outline (smoke, cloud): MIST in src/gen/airborne.ts
    'puff.look': number; //            which of a few hand-drawn puff shapes
  }
}
