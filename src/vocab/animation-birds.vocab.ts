// Vocabulary the birds need beyond src/vocab/animation.vocab.ts (Animation
// owner, birds). Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    // L12. The cell the flock feeds round (its pigeons' own spots are the free plaza cells nearest it).
    'pigeon.spot': number;
    // L13. The cell at the foot of what the swift loops round (a structure's lowest cell, or a street cell).
    'swift.home': number;

    // Gallery only: hold one drawing instead of living. The actor must be anchored to a cell.
    //   'sit' wings folded · 'spread' gliding · 'up' and 'down' the two ends of a wing beat
    'gull.hold': 'sit' | 'spread' | 'up' | 'down';
    'pigeon.hold': 'sit' | 'spread' | 'up' | 'down';
    'swift.hold': 'sit' | 'spread' | 'up' | 'down';
  }
}
