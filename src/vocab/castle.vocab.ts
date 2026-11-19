// Vocabulary for castle life (catalogue L36, L37). Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    // L36. A castle's troop (at = null; home = the castle's first structure). The garrison system
    // (src/life/people/garrison.system.ts) marches it; the part draws nothing of its own.
    'garrison': true;
    'garrison.size': number; //  soldiers: 4, or 6 for a keep with walls
    'garrison.color': number; // index into the cloth colours (the castle's banners'): their tabards
    // L37. The castle's rider and horse, by its gate (at = null; home = the castle).
    'rider': true;
    'rider.color': number;
    'rider.look': number; //     the horse's coat
  }
}
