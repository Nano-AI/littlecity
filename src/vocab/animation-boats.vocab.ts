// Vocabulary the boats need beyond src/vocab/animation.vocab.ts (Animation
// owner, the boats work). Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    // Which way a sail's belly is built: 1 bows toward +X of the sail's frame, −1 toward −X. A sail is
    // drawn as two instances, one of each, and the behaviour shows the one on the lee side (mirroring
    // one mesh with a negative scale would turn its shading inside out).
    'boat-sail.side': number;
  }
}
