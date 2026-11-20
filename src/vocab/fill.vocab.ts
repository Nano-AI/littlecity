// Vocabulary added by the fill builder in discovery round 1: urban fill and
// decoration (U13 onward, D35 onward). Types only: merged into the
// registries by module augmentation (see the header of src/core/vocab.ts).

import '@/core/vocab';

declare module '@/core/vocab' {
  interface SocketVocab {
    // A person stands here and does something; `name` says what ('dance', 'fetch-water', 'vend',
    // 'browse', 'hang-washing', 'pick', 'basket', 'ford'). +Z faces the work. Emitted by the fill
    // rules for the life builder (docs/swarm/requests/disc1-fill.md).
    'activity': true;
  }
  interface PropVocab {
    // U13 country lanes. A hedgerow is the hedge prop's 'wild' variant: taller, shaggy, with a few
    // flowers in it (same frame: an edge slot, +Z into the cell, the hedge on the cell line).
    'hedge/wild': true;
    'hedge.face': number; //          the anchor's face, so the wild hedge's flat tones turn with it
    // A stone milestone at the lane's edge. Frame: a floor slot, +Z toward `face` (the lane).
    'milestone': true;
    'milestone.look': number;
    // A five-bar field gate between two posts, on the cell line, shut or standing open. Frame: an
    // edge slot, +Z into the field cell (as the hedge).
    'field-gate': true;
    'field-gate.open': 0 | 1;
    'field-gate.look': number;

    // U14 burgage plots (and U23 orchard). A small fruit tree at a floor slot, square to the world;
    // `fruit` 0 apples, 1 pears. A compost bin at an edge slot against a fence, +Z away from it.
    'fruit-tree': true;
    'fruit-tree.fruit': 0 | 1;
    'fruit-tree.look': number;
    'compost': true;
    'compost.look': number;

    // U15 village green. Sward: one cell of mown lawn at the centre slot, square to the world; `mask`
    // bit d set where the green runs on past side d; `stripe` 0 or 1 (the mown band). Maypole: at a
    // floor slot; anchor 'dance' at its foot. Ring bench: at a tree cell's centre slot, round the
    // trunk; sockets 'seat-0'…'seat-3'. Village sign: an edge slot, +Z toward the street.
    'sward': true;
    'sward.mask': number;
    'sward.stripe': 0 | 1;
    'sward.level': number; //          the terrain level it lies on (its grass colour and surface)
    'maypole': true;
    'maypole.look': number;
    'ring-bench': true;
    'ring-bench.look': number;
    'village-sign': true;
    'village-sign.look': number;
  }
}
