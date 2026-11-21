// Vocabulary added by soft ink (round things drawn as one smooth mass). Types only: see
// src/core/vocab.ts, "HOW TO EXTEND IT".

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    // One drawing of life's small things held still for a gallery, which otherwise only appear while
    // something happens (a scuffle's cloud and swearing, a chat bubble, a dog's poses, what people carry).
    // No rule of the game emits it. variant = what; params: n (which one of them), and the camera's yaw
    // and pitch (degrees) for the drawings that turn to face it.
    'specimen': true;
    'specimen/cloud': true;
    'specimen/swear': true;
    'specimen/chat': true;
    'specimen/pop': true;
    'specimen/daze': true;
    'specimen/dog': true;
    'specimen/load': true;
    'specimen/animal': true;
    'specimen.n': number;
    'specimen.yaw': number;
    'specimen.pitch': number;
  }
}
