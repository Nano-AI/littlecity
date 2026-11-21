// The raid (design section 13b): the pose of somebody running from raiders, so the people sheet can show it.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface ActorVocab {
    'figure/panic': true;
  }
}
