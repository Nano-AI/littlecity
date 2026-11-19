// Vocabulary added by the Ground owner for floors and gardens (J21, J22,
// R-G01). Types only: merged into the registries of src/core/vocab.ts by
// module augmentation.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface FeatureVocab {
    // J21: what one side of a floor cell meets that its own region cannot see (a floor
    // generator may read only its own cells). cell + dir; `structure` = the floor region
    // that draws it. The variant names what lies on the other side:
    'floor-link': true;
    'floor-link/path': true; //    on a plaza or garden cell: a path arrives here (a hedge or border opens)
    'floor-link/plaza': true; //   on a path cell: the path runs to the edge and ends in a flush kerb
    'floor-link/garden': true; //  on a path cell: the path runs to the garden's edge
    'floor-link/stairs': true; //  on a path cell: the foot or the head of a stairs flight
    'floor-link/door': true; //    on a path cell: a door; the path widens into a doorstep
    'floor-link/deck': true; //    on a path cell: a deck, quay or bridge the path leads onto

    // J22: the paving of a plaza region. No cell needed for the border (cell = the region's
    // first cell); the motif sits on `cell`, the middle of the region's largest square.
    'plaza-border': true; //       a border course along the region's outer edge
    'plaza-motif': true; //        a radial centre motif in a region containing a 5 × 5
    'plaza-motif/compass': true; // rings and an eight-pointed star
    'plaza-motif/rings': true; //   plain rings
    'plaza-motif.size': number; //  side of the square it is centred in, in cells (odd: centred on the cell; even: on its south-east corner)

    // R-G01: one seeded ornament of a garden region, on `cell`.
    'garden-piece': true;
    'garden-piece/scarecrow': true; // wheat field
    'garden-piece/sundial': true; //   herb garden
    'garden-piece/bed': true; //       park lawn: a round flower bed
  }
}
