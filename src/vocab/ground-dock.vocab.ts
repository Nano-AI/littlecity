// Vocabulary added by the Ground owner for docks and the shoreline
// (R-D01, J23, J28). Types only: merged into the registries of
// src/core/vocab.ts by module augmentation.
//
// Frames: every feature here has `cell` = the DOCK cell (level 0) and a
// `dir`, so its frame is the bottom centre of that cell face, +Z out of the
// face. The deck is at y = CELL_H in that frame; the sea at y = SEA_Y.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface FeatureVocab {
    // J23: which kind of mooring point a bollard is, and whether a tyre fender hangs under it.
    'bollard/post': true; //   a wooden post wound with rope (jetties and piers)
    'bollard/iron': true; //   a cast-iron mushroom bollard (quays)
    'bollard.fender': 0 | 1; // default 0

    // J23 on a quay (R-D01): a stack of goods on the deck against side `dir`.
    'dock-goods': true;
    'dock-goods/crates': true;
    'dock-goods/barrels': true;

    // J23 on a quay of 8+ cells (R-D01): a timber hoist. dir = out over the water.
    // Owns socket 'perch' (the tip of the jib).
    'dock-crane': true;

    // J28: mooring piles standing in the water off side `dir` of a dock cell.
    // Owns socket 'perch' (the top of the taller pile).
    'dock-pile': true;
  }
}
