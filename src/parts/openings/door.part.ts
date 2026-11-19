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
import { archPts, bar, bead, face, personaOf, plate, rectPts, shrink, slab } from './lib';

/** Height of one stoop step. Five make a storey. */
export const STEP_RISE = 0.16;
const STEP_RUN = 0.1;

function knob(b: MeshBuilder, x: number, y: number, z: number): void {
  b.with({ color: PALETTE.yellow, ink: 'knob' }, () => bead(b, x, y, z, 0.02));
}

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

    if (variant === 'hatch') {
      // A trapdoor in a terrace floor: the frame is the cell's floor centre.
      b.with({ color: p.trim, ink: 'hatch-frame' }, () => b.boxAt([0, 0, 0], [0.42, 0.035, 0.42], { skip: ['bottom'] }));
      b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'hatch' }, () => b.boxAt([0, 0.035, 0], [0.34, 0.015, 0.34], { skip: ['bottom'] }));
      b.with({ color: PALETTE.metal, ink: 'hatch-ring' }, () => b.boxAt([0.1, 0.05, 0], [0.05, 0.012, 0.09], { skip: ['bottom'] }));
      return { mesh: b.build(), anchors: { door: translation(0, 0.05, 0) } };
    }

    b.setColor(p.trim).setInk('frame');
    if (variant === 'double') {
      // Chapel: a tall round-headed doorway with two boarded leaves and iron straps.
      const frame = archPts(0.5, 0.38, 0);
      plate(b, frame, 0, 0.05);
      const leaf = shrink(frame, 0.05).map(([x, y]) => [x, Math.max(y, 0.0)] as const);
      b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'leaf' }, () => face(b, leaf, 0.054));
      b.with({ color: PALETTE.metal, ink: 'leaf' }, () => {
        bar(b, 0, 0.02, 0, 0.55, 0.014, 0.058);
        for (const y of [0.14, 0.34]) {
          bar(b, -0.19, y, -0.05, y, 0.022, 0.058);
          bar(b, 0.05, y, 0.19, y, 0.022, 0.058);
        }
      });
      knob(b, -0.035, 0.25, 0.062);
      knob(b, 0.035, 0.25, 0.062);
      anchors['sign-bracket'] = translation(0.36, 0.66, 0);
      const out = stoop(b, 0.62, steps);
      anchors.door = translation(0, -steps * STEP_RISE, out + 0.2);
    } else if (variant === 'shop') {
      // A shopfront: glazed door on the left, display window on the right, one signboard over both.
      plate(b, rectPts(0.8, 0.52, 0), 0, 0.045);
      b.with({ color: p.accent, ink: 'leaf' }, () => face(b, rectPts(0.2, 0.46, 0.02, -0.26), 0.049));
      b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'leaf' }, () => face(b, rectPts(0.13, 0.22, 0.21, -0.26), 0.052));
      knob(b, -0.19, 0.2, 0.056);
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
      const leaf = arched ? archPts(0.26, 0.37, 0.0) : rectPts(0.26, 0.505, 0);
      b.with({ color: p.accent, pattern: look === 'plank' ? PATTERN.planksAcross : PATTERN.none, ink: 'leaf' }, () => face(b, leaf, 0.049));
      if (look === 'glazed') {
        b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'leaf' }, () => face(b, rectPts(0.17, 0.2, 0.26), 0.052));
        b.with({ ink: 'leaf' }, () => bar(b, 0, 0.26, 0, 0.46, 0.02, 0.055));
      } else if (look === 'panel') {
        // Two raised panels: the same paint, so they read by their edges alone.
        b.with({ color: p.accent, ink: 'leaf' }, () => {
          slab(b, -0.085, 0.085, 0.3, 0.45, 0.049, 0.062);
          slab(b, -0.085, 0.085, 0.07, 0.24, 0.049, 0.062);
        });
      } else if (look === 'plank') {
        // A small diamond light.
        b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'leaf' }, () =>
          face(b, [[0, 0.33], [0.045, 0.385], [0, 0.44], [-0.045, 0.385]], 0.052));
      } else {
        // arched: a fanlight in the round head
        b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'leaf' }, () => face(b, archPts(0.2, 0, 0.39, 0, 6), 0.052));
        b.with({ ink: 'leaf' }, () => bar(b, 0, 0.39, 0, 0.485, 0.018, 0.055));
      }
      knob(b, 0.085, 0.24, 0.058);
      anchors['sign-bracket'] = translation(0.3, 0.66, 0); // an inn hangs its sign here
      if (variant !== 'deck') {
        const out = stoop(b, 0.46, steps);
        anchors.door = translation(0, -steps * STEP_RISE, out + 0.2);
      } else {
        anchors.door = translation(0, 0, 0.3);
      }
      // A small canopy over some main doors: a board roof on two brackets.
      if (main && variant === 'plain' && ctx.rand('canopy') < 0.45) {
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
