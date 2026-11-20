// Vocabulary added by the living-town owner (catalogue L50 and up): the
// town's chains, errands and events. Types only: see src/core/vocab.ts.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    // The poses added for the scuffle (L50) and the builders (L53), for the people sheet.
    'figure/cheer': true;
    'figure/cover': true;
    'figure/dust': true;
    'figure/shake': true;
    'figure/hammer': true;
  }
}
