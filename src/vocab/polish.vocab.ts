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
  interface ActorVocab {
    // L20: a rowboat with someone at the oars that waits by one pier end and now and then rows across
    // to another, through open water. Free-roaming (at = null), home = the first pier. Its two
    // waiting places, as water column centres: (ax, az) by the home pier, (bx, bz) by the other.
    'rower': true;
    'rower.look': number;
    'rower.ax': number;
    'rower.az': number;
    'rower.bx': number;
    'rower.bz': number;
  }
}
