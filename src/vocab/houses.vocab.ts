// Vocabulary added by the Houses owner (Stage 2). Types only: see the header
// of src/core/vocab.ts for how extension files work.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface FeatureVocab {
    // J09: a small round window high in a gable end. cell + dir = a facade cell of the gable
    // end; the house generator centres it in the gable.
    'window/round': true;

    // R-H14 (and D12): a weathervane on a ridge end.
    'finial/vane': true;

    // J11: the side (Dir4) of the taller wall a tall flue climbs, as a brick breast against it.
    // Without it a tall flue stands free.
    'chimney.against': number;

    // R-H04: a stove pipe instead of a brick stack.
    'chimney/pipe': true;

    // J27: a house cell carried on brackets; the generator draws its walls (and those of the
    // cells stacked on it) half-timbered. `cell` = the jettied cell.
    'jetty': true;

    // J10: something on a pitched roof over an eave. `cell` = the roof cell, `dir` = the eave it
    // looks out over.
    'dormer': true;
    'dormer/gabled': true; //       a small gabled window house on the slope
    'dormer/cross-gable': true; //  the wall over the main door carried up into a gable of its own
    'dormer/skylight': true; //     a roof light lying on the slope

    // J05/J19 seam: a roof-terrace side that carries a railing or an edge piece. The house leaves
    // its parapet out there and caps the wall with a low coping. `cell` = the roof cell, `dir` = the side.
    'coping': true;

    // R-H09: a portico with two small columns at the main door. cell + dir as the door.
    'portico': true;
  }
  interface ActorVocab {
    // Sail length from the hub in world units (set from the mill's height). Default 0.78.
    'windmill-sails.size': number;
  }
  interface TagVocab {
    'glass-walls': true; //   greenhouse (R-H13)
    'white-walls': true; //   keeper's cottage (R-H02)
    'stone-ground': true; //  cliff house (R-H12): the ground storey is stone
    'weathervane': true; //   lookout cottage (R-H14)
  }
}
