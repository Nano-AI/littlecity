// Vocabulary added by the Polish owner: small bulbs on a square's bunting
// (L10) and the rower (L20). Types only: merged into the registries by
// module augmentation (see the header of src/core/vocab.ts).

import '@/core/vocab';

declare module '@/core/vocab' {
  interface PropVocab {
    // D04 on a square: 1 hangs a small bulb between every two flags. Its glass is PATTERN.glow, so
    // the dusk lamps system (which lights every 'bunting') makes the string glow softly at night.
    'bunting.bulbs': number;
  }
}
