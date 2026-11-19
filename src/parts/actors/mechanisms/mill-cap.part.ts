// L03: a windmill's cap as an actor, so life can turn it to face the wind
// (src/life/mechanisms/mill-cap.behaviour.ts). The shape is the windmill
// generator's own (src/gen/windmill/cap.ts); while this part exists the
// generator leaves the cap out of the baked mill.
//
// Frame: the 'mill-hub' socket. The cap is drawn in the tower's neck frame
// and carried back from the hub, so it sits exactly where the baked one did.

import { invertAffine } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { capRoof, hubInNeck, millCap } from '@/gen/windmill/cap';
import { WINDMILL } from '@/style/houses';

export default definePart({
  actor: 'mill-cap',
  build(item, ctx) {
    const b = ctx.mesh();
    const seed = item.home === undefined ? 0 : (ctx.plan.structures.get(item.home)?.seed ?? 0);
    b.at(invertAffine(hubInNeck(WINDMILL.neckR)), () => millCap(b, WINDMILL.neckR, capRoof(seed)));
    return { mesh: b.build(), animated: true };
  },
});
