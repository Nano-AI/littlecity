// Vocabulary added by the Dressing owner in Stage 4 (depth): the urban-fill
// rules that change how a house is drawn (U09 to U12), the fence footing fix,
// and the rest of part D. Types only: merged into the registries by module
// augmentation (see the header of src/core/vocab.ts).

import '@/core/vocab';

declare module '@/core/vocab' {
  interface FeatureVocab {
    // U09: the facade cell a long straight street runs into. cell + dir, drawn on the wall plane
    // (origin at the bottom centre of the storey on the wall, +Z out). One of:
    'vista': true;
    'vista/clock': true; //   a clock in a stone roundel high on the storey; owns socket 'clock-hands'
    'vista/niche': true; //   a round-headed niche with a little painted saint on a ledge
    'vista/doorway': true; // a grand surround round the main door: pilasters and a pediment
    'vista/oriel': true; //   a corbelled bay window standing out of an upper storey
    'vista.look': number;

    // U10: a round corner turret on the upper storeys of a house at a street junction. `cell` = the
    // lowest storey it starts on, `dir` = the side whose RIGHT-hand corner (facing the wall) it
    // stands on. `storeys` = how many storeys its body climbs (it ends in a cone above the eave).
    'corner-oriel': true;
    'corner-oriel.storeys': number;
    'corner-oriel.look': number;

    // U11: one bay of the town hall's arcade, in front of a ground-storey wall on the square.
    // cell + dir, wall plane. `left`, `right`: 1 if the arcade ends at that side of the bay (a
    // corner pier closes it), 0 if it runs on into the next bay.
    'arcade': true;
    'arcade.left': 0 | 1;
    'arcade.right': 0 | 1;

    // Fence fix: an edge piece of a fence run with nothing flat to stand on either side of it (round
    // the eaves of a pitched roof, in mid-air). The generator leaves it out. `edge` = the piece.
    'run-bare': true;
  }
  interface RoleVocab {
    // U11: a big house on a square: arcaded ground storey, balcony over the door, clock, flag.
    'town-hall': 'house';
  }
  interface TagVocab {
    // U12 (edge half): a house far out from every floor of the town: thatch, timber, rough stone.
    'rustic': true;
  }
}
