// L36: a door's leaf as its own instance, so life can swing it open
// (src/life/doors/door-leaf.behaviour.ts). The drawing is the still door's
// own (src/parts/openings/door-leaf.ts, towerLeaf in the monuments'
// openings), with a back and edges added so it reads once it has swung round.
// While this part exists the door parts draw a dark doorway in its place.
//
// Frame: the door's 'door' socket (the threshold outside); the leaf is drawn
// on the wall behind it (wallInSocket). A derived roof hatch: the terrace
// cell's floor centre, and the actor draws the frame too (variant 'hatch'
// with param frame = 1, spawned by the behaviour; the lid is the actor).

import { definePart, type PartContext } from '@/gen/api';
import { towerLeaf, towerLeafColor } from '@/parts/monuments/openings';
import { PALETTE } from '@/style/palette';
import {
  doubleLeaf,
  doubleLeafOutline,
  hatchFrame,
  hatchLid,
  houseLeaf,
  houseLeafOutline,
  leafBody,
  shopLeaf,
  shopLeafOutline,
  towerLeafOutline,
  wallInSocket,
  type DoorLook,
  type LeafKind,
} from '@/parts/openings/door-leaf';
import { personaOf } from '@/parts/openings/lib';

export default definePart({
  actor: 'door-leaf',
  build(item, ctx) {
    const b = ctx.mesh();
    const variant = item.variant ?? 'plain';
    const kind: LeafKind = variant === 'double-right' ? 'double' : variant;
    const steps = Math.max(0, Math.round(item.params?.steps ?? 0));
    const structure = item.home === undefined ? undefined : ctx.plan.structures.get(item.home);
    const persona = (): ReturnType<typeof personaOf> => personaOf({ ...ctx, structure } as PartContext);
    if (kind === 'hatch') {
      if (item.params?.frame === 1) hatchFrame(b, PALETTE.trunk, true);
      else b.at(item.params?.derived === 1 ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : wallInSocket('hatch', 0), () => hatchLid(b));
      return { mesh: b.build(), animated: true };
    }
    b.at(wallInSocket(kind, steps), () => {
      switch (variant) {
        case 'shop': {
          const accent = persona().accent;
          shopLeaf(b, accent);
          leafBody(b, shopLeafOutline(), accent);
          break;
        }
        case 'double':
        case 'double-right': {
          const side = variant === 'double' ? -1 : 1;
          doubleLeaf(b, side === -1 ? 'left' : 'right');
          leafBody(b, doubleLeafOutline(side), PALETTE.wood, 0.054);
          break;
        }
        case 'tower': {
          const color = towerLeafColor(structure?.kind ?? 'tower', structure?.seed ?? 0);
          towerLeaf(b, color);
          leafBody(b, towerLeafOutline(), color, 0.05);
          break;
        }
        default: {
          const p = persona();
          const look: DoorLook = variant === 'deck' ? 'glazed' : p.door;
          houseLeaf(b, look, p.accent);
          leafBody(b, houseLeafOutline(look), p.accent);
        }
      }
    });
    return { mesh: b.build(), animated: true };
  },
});
