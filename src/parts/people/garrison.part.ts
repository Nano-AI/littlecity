// L36, L37: the garrison and the rider are drawn by the garrison system
// (src/life/people/garrison.system.ts), piece by piece like residents; their
// actors in the plan are only the fact that they exist. These parts draw
// nothing, so the town shows no marker for them.

import { definePart } from '@/gen/api';

export const garrison = definePart({
  actor: 'garrison',
  build(_item, ctx) {
    return { mesh: ctx.mesh().build(), animated: true };
  },
});

export const rider = definePart({
  actor: 'rider',
  build(_item, ctx) {
    return { mesh: ctx.mesh().build(), animated: true };
  },
});
