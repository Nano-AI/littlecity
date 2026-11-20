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

  interface SocketVocab {
    // L51 and up: a post of one of the town's chains, where its work is picked up or set down. `name` is
    // `<chain>|<role>|<ref>` (bread|mill, bread|bakery, bread|sell, water|well, fish|catch, fish|sell…);
    // `cell` is the walking-graph cell the worker stands in; `dir` the way they face there; `structure`
    // the building or stall it belongs to.
    'errand': true;
  }
}
