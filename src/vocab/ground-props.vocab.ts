// Vocabulary added by the Ground owner for the fountain and the stall
// (R-F01, R-S01). Types only: see src/core/vocab.ts, "HOW TO EXTEND IT".

import '@/core/vocab';

declare module '@/core/vocab' {
  interface SocketVocab {
    // Where water leaves a fountain: the tip of a jet, a spout, the lip of an
    // overflowing bowl. Origin at that point; +Y is the way the water sets
    // off (up for a jet, outward and level for a spout or a lip).
    // Declared by R-F01 with `structure` set and a `name`; the fountain
    // generator supplies the frame. For the Animation owner's water.
    'water-jet': true;
    // The centre of a pool of still water (a basin, a bowl, a well, a
    // birdbath dish), on its surface; +Y up. For rings and ripples.
    'water-surface': true;
  }
  interface TagVocab {
    // What a market stall sells (R-S01), chosen by the structure's seed.
    'goods:fruit': true;
    'goods:bread': true;
    'goods:cheese': true;
    'goods:pots': true;
    'goods:cloth': true;
    // Which side a stall's counter faces (R-S01): toward the street, the
    // square or the open ground beside it. Later rules can stand a customer there.
    'front:n': true;
    'front:e': true;
    'front:s': true;
    'front:w': true;
  }
}
