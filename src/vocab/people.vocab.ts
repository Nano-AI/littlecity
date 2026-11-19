// Vocabulary added by the People owner (Stage 3; L21–L28, L32). Types only:
// see src/core/vocab.ts, "HOW TO EXTEND IT".

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    // L21 (already in the core vocabulary): 'resident', '.index', '.look'.
    // A child (L28): smaller, and runs.
    'resident/child': true;
    // A resident of a house whose door opens onto nothing walkable: at home for good, never drawn,
    // not counted toward the cap. They still light the windows.
    'resident/indoors': true;
    // L23: the job this resident does (they are still a resident of `home`), and the structure they work at.
    'resident.job': string;
    'resident.work': number;

    // A little person standing still in one pose. No rule of the game emits
    // it: it is for gallery sheets and for looking at poses.
    // variant = the pose (src/parts/people/pose.ts); params: look seed, pose time, 1 for a child.
    'figure': true;
    'figure/stand': true;
    'figure/walk': true;
    'figure/run': true;
    'figure/sit': true;
    'figure/tend': true;
    'figure/look': true;
    'figure/wave': true;
    'figure/chat': true;
    'figure/fish': true;
    'figure/hop': true;
    'figure/hat': true;
    'figure/carry': true;
    'figure/sweep': true;
    'figure.look': number;
    'figure.phase': number;
    'figure.child': 0 | 1;
  }

  interface SocketVocab {
    // L22: somewhere a resident may go and linger. `cell` is the walking-graph
    // cell they stand in. With `dir`: the way they face. With `structure`:
    // the building it belongs to (the shop, the house visited).
    'haunt-square': true; //     a cell of a plaza: stand about, chat
    'haunt-shop': true; //       in front of a shop door: look in, or go in
    'haunt-cafe': true; //       a café table seat (from a 'seat' socket Dressing made)
    'haunt-bench': true; //      a bench or step seat (a 'seat' socket); `name` is that socket's id
    'haunt-pier': true; //       a pier end or fishing spot: stand and fish
    'haunt-garden': true; //     a garden cell: tend the beds
    'haunt-fountain': true; //   beside a fountain, facing it
    'haunt-viewpoint': true; //  a high, open cell with a drop in front: look out
    'haunt-visit': true; //      another house's door: go in for a while
    // L25: where the few who stay out at night go (the viewpoint, a fishing spot).
    'haunt-night': true;
    // L32: within two cells of a stranded home's door; `structure` is that home.
    'haunt-stoop': true;
    // L24: the open end of a single-file stretch (a narrow flight, carved steps, a gate): people wait here.
    'queue-point': true;
    // L27: where newcomers to `structure` (a home) come ashore: the nearest dock or beach cell with a route to its door.
    'arrival': true;
    // L27: where a resident whose home is gone walks off: the end of a street, a dock, a beach.
    'way-out': true;
  }
}
