// Doors (Houses owner; catalogue J06–J08, J26). A door is a framed leaf in
// the structure's accent colour with a stone step; the structure's
// personality picks the look (boards, panels, a round head, a glazed top).
// Main doors may get a small canopy. `door.steps` adds a stoop: a flight of
// steps down to lower ground outside (J08).
//
// Frame: the wall plane (see lib.ts), the storey's floor at y = 0. The
// 'door' socket is the threshold on the ground outside, +Z out. A shop door
// also owns 'awning-mount' (over the shopfront) and 'sign-bracket' (beside
// it at head height).

import { compose, rotationX, translation, type Mat4Like } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { doorway, doubleLeaf, doubleOutline, hatchFrame, hatchLid, houseLeaf, houseLeafOutline, shopLeaf, shopLeafOutline } from './door-leaf';
import { archPts, bar, face, personaOf, plate, rectPts, slab } from './lib';

/** Height of one stoop step. Five make a storey. */
export const STEP_RISE = 0.16;
const STEP_RUN = 0.1;

/** The step, or a flight of `steps` more going down and out to the ground. */
function stoop(b: MeshBuilder, width: number, steps: number, cx = 0): number {
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'step' }, () => {
    slab(b, cx - width / 2, cx + width / 2, 0, 0.05, 0, 0.17, ['n', 'bottom']);
    for (let i = 1; i <= steps; i++) {
      const top = 0.05 - i * STEP_RISE;
      slab(b, cx - width / 2, cx + width / 2, top - STEP_RISE, top, 0, 0.17 + i * STEP_RUN, ['n', 'bottom']);
    }
  });
  return 0.17 + steps * STEP_RUN;
}

export default definePart({
  feature: 'door',
  build(item, ctx) {
    const b = ctx.mesh();
    const p = personaOf(ctx);
    const variant = item.variant ?? 'plain';
    const steps = Math.max(0, Math.round(item.params?.steps ?? 0));
    const main = item.params?.main === 1;
    const anchors: Record<string, Mat4Like> = {};

    // The leaf is the 'door-leaf' actor's when that part exists (it swings open): a dark doorway here then.
    const moving = ctx.parts.has('actor', 'door-leaf');

    if (variant === 'hatch') {
      // A trapdoor in a terrace floor: the frame is the cell's floor centre.
      hatchFrame(b, p.trim, moving);
      if (!moving) hatchLid(b);
      return { mesh: b.build(), anchors: { door: translation(0, 0.05, 0) } };
    }

    b.setColor(p.trim).setInk('frame');
    if (variant === 'double') {
      // Chapel: a tall round-headed doorway with two boarded leaves and iron straps.
      const frame = archPts(0.5, 0.38, 0);
      plate(b, frame, 0, 0.05);
      if (moving) doorway(b, doubleOutline(), 0.051);
      else doubleLeaf(b, 'both');
      anchors['sign-bracket'] = translation(0.36, 0.66, 0);
      // R-H01: a chapel door stands in a small gabled porch on two posts.
      if (ctx.structure && ctx.plan.roles.get(ctx.structure.id)?.role === 'chapel') {
        const out = 0.27, eave = 0.5, peak = 0.73, e = 0.37;
        b.with({ color: PALETTE.wood, ink: 'porch-posts' }, () => {
          for (const x of [-0.3, 0.3]) b.box([x - 0.02, 0.05, out - 0.06], [x + 0.02, eave, out - 0.02], { skip: ['bottom', 'top'] });
          b.box([-0.32, eave - 0.035, out - 0.065], [0.32, eave, out - 0.015], { skip: ['top'] });
        });
        b.with({ color: p.roofColor, pattern: PATTERN.shingles, ink: 'porch-roof' }, () => {
          b.quad([e, eave - 0.02, out], [e, eave - 0.02, 0], [0, peak, 0], [0, peak, out]);
          b.quad([-e, eave - 0.02, 0], [-e, eave - 0.02, out], [0, peak, out], [0, peak, 0]);
        });
        b.with({ color: p.trim, ink: 'porch-trim' }, () => {
          const t = 0.04;
          b.quad([0, peak - t, out], [e, eave - 0.02 - t, out], [e, eave - 0.02, out], [0, peak, out]);
          b.quad([-e, eave - 0.02 - t, out], [0, peak - t, out], [0, peak, out], [-e, eave - 0.02, out]);
          // undersides, seen under the far slope
          b.quad([e, eave - 0.02 - t, out], [0, peak - t, out], [0, peak - t, 0], [e, eave - 0.02 - t, 0]);
          b.quad([0, peak - t, out], [-e, eave - 0.02 - t, out], [-e, eave - 0.02 - t, 0], [0, peak - t, 0]);
        });
      }
      const out = stoop(b, 0.62, steps);
      anchors.door = translation(0, -steps * STEP_RISE, out + 0.2);
    } else if (variant === 'shop') {
      // A shopfront: glazed door on the left, display window on the right, one signboard over both.
      plate(b, rectPts(0.8, 0.52, 0), 0, 0.045);
      if (moving) doorway(b, shopLeafOutline());
      else shopLeaf(b, p.accent);
      b.with({ color: p.accent, ink: 'riser' }, () => face(b, rectPts(0.47, 0.1, 0.03, 0.13), 0.049));
      b.with({ color: PALETTE.glass, pattern: PATTERN.glass }, () => face(b, rectPts(0.47, 0.31, 0.16, 0.13), 0.049));
      bar(b, 0.13, 0.16, 0.13, 0.47, 0.022, 0.052);
      b.with({ color: p.accent, ink: 'board' }, () => slab(b, -0.42, 0.42, 0.52, 0.62, 0, 0.06));
      const out = stoop(b, 0.3, steps, -0.26); // the step belongs under the door, not the window
      anchors.door = translation(-0.26, -steps * STEP_RISE, out + 0.2);
      anchors['awning-mount'] = translation(0, 0.62, 0.06);
      anchors['sign-bracket'] = translation(0.405, 0.7, 0);
    } else {
      const look = variant === 'deck' ? 'glazed' : p.door;
      const arched = look === 'arched';
      const frame = arched ? archPts(0.34, 0.37, 0) : rectPts(0.34, 0.55, 0);
      plate(b, frame, 0, 0.045);
      if (moving) doorway(b, houseLeafOutline(look));
      else houseLeaf(b, look, p.accent);
      anchors['sign-bracket'] = translation(0.3, 0.66, 0); // an inn hangs its sign here
      if (variant !== 'deck') {
        const out = stoop(b, 0.46, steps);
        anchors.door = translation(0, -steps * STEP_RISE, out + 0.2);
      } else {
        anchors.door = translation(0, 0, 0.3);
      }
      // A small canopy over some main doors: a board roof on two brackets.
      // (Not under a grand doorway (U09): its pediment is the door's hood.)
      const grand = (ctx.structure ? (ctx.plan.featuresByStructure.get(ctx.structure.id) ?? []) : []).some((f) => f.type === 'vista' && f.variant === 'doorway' && f.cell === item.cell && f.dir === item.dir);
      if (main && variant === 'plain' && !grand && ctx.rand('canopy') < 0.45) {
        const y0 = arched ? 0.6 : 0.6;
        b.with({ color: p.roofColor, pattern: PATTERN.shingles, ink: 'canopy' }, () => {
          b.at(compose(translation(0, y0, 0), rotationX(0.42)), () => b.box([-0.25, 0, 0], [0.25, 0.03, 0.2]));
        });
        b.with({ color: PALETTE.wood, ink: 'canopy-brackets' }, () => {
          for (const x of [-0.2, 0.2]) {
            b.quad([x - 0.012, y0 - 0.12, 0], [x + 0.012, y0 - 0.12, 0], [x + 0.012, y0 - 0.06, 0.14], [x - 0.012, y0 - 0.06, 0.14]);
            b.tri([x + 0.012, y0 - 0.12, 0], [x + 0.012, y0 - 0.02, 0], [x + 0.012, y0 - 0.06, 0.14]);
            b.tri([x - 0.012, y0 - 0.02, 0], [x - 0.012, y0 - 0.12, 0], [x - 0.012, y0 - 0.06, 0.14]);
          }
        });
      }
    }
    return { mesh: b.build(), anchors };
  },
});
