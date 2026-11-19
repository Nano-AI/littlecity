// LOOK FIXTURE (not a real generator: those are Stage 2's, in src/gen/house).
// The spike's house, rebuilt with MeshBuilder to prove the look in the real
// renderer: plinth, walls, a trim band per storey, framed windows with sills
// and flower boxes, a door with a step, a shingled gable roof with a round
// window, and a brick chimney. A stack of house cells is one building.
//
// It draws cell by cell and looks only at the cells above and below, so it
// works both while structures are one block each (Stage 0) and once they
// merge. Its ink groups are named by column, so a stack shares its walls.

import { CELL_H, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import { compose, rotationX, rotationY, translation, type Mat4Like } from '@/core/mat4';
import { rand } from '@/core/rand';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { PALETTE, RAMPS, rampColor } from '@/style/palette';
import { bead } from './shapes';

const FLOWERS = [PALETTE.red, PALETTE.pink, PALETTE.yellow, PALETTE.white, PALETTE.magic];
const DOORS = [PALETTE.redDark, PALETTE.glass, PALETTE.wood, PALETTE.leafDark];

/** A window in a wall's frame: origin at the sill's centre on the wall face, +Z out. */
function windowAt(b: MeshBuilder, id: string, flowers: number): void {
  b.with({ color: PALETTE.white, ink: `${id}-frame` }, () => {
    b.boxAt([0, 0, 0.015], [0.22, 0.31, 0.03]);
    b.boxAt([0, -0.02, 0.05], [0.27, 0.03, 0.08]); // the sill
  });
  // The pane, mullion and transom are one ink group: the cross reads by colour, without four more lines.
  b.setInk(`${id}-pane`);
  b.with({ color: PALETTE.glass, pattern: PATTERN.glass }, () => b.boxAt([0, 0.03, 0.017], [0.16, 0.25, 0.034], { skip: ['n', 'bottom'] }));
  b.with({ color: PALETTE.white }, () => {
    b.boxAt([0, 0.03, 0.021], [0.02, 0.25, 0.042], { only: ['s'] });
    b.boxAt([0, 0.15, 0.021], [0.16, 0.02, 0.042], { only: ['s'] });
  });
  if (flowers >= 0) {
    b.with({ color: PALETTE.wood, ink: `${id}-box` }, () => b.boxAt([0, -0.07, 0.085], [0.22, 0.05, 0.07]));
    b.setInk(`${id}-flowers`);
    for (let i = 0; i < 3; i++) b.with({ color: FLOWERS[(flowers + i * 2) % FLOWERS.length]! }, () => bead(b, -0.07 + i * 0.07, -0.01, 0.095, 0.034));
  }
}

function doorAt(b: MeshBuilder, color: string): void {
  b.with({ color: PALETTE.white, ink: 'door-frame' }, () => b.boxAt([0, 0, 0.015], [0.28, 0.45, 0.03]));
  b.with({ color, ink: 'door' }, () => b.boxAt([0, 0, 0.02], [0.21, 0.4, 0.04], { skip: ['n', 'bottom'] }));
  b.with({ color: PALETTE.yellow, ink: 'door-knob' }, () => bead(b, 0.06, 0.2, 0.045, 0.017));
  b.with({ color: PALETTE.stoneShade, ink: 'door-step' }, () => b.boxAt([0, 0, 0.08], [0.36, 0.045, 0.16], { skip: ['bottom'] }));
}

export default defineGenerator({
  kind: 'house',
  build(s, plan, parts) {
    const anchors: Record<string, Mat4Like> = {};
    const out = new MeshBuilder({ ink: s.id });
    const isHouse = (c: CellKey): boolean => plan.kinds.get(c) === 'house';
    for (const cell of s.cells) {
      const x = keyX(cell), y = keyY(cell), z = keyZ(cell);
      const below = isHouse(cell - (1 << 12)), above = plan.kinds.has(cell + (1 << 12));
      const seed = plan.world.seed ^ (x * 73 + z * 151);
      // One builder per column, named by the column, so stacked cells share ink groups.
      const b = new MeshBuilder({ ink: `house:${x}:${z}` });
      const wall = rampColor('house', s.color);
      const y0 = y * CELL_H;
      b.at(translation(x + 0.5, y0, z + 0.5), () => {
        if (!below) b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'plinth' }, () => b.boxAt([0, 0, 0], [0.92, 0.07, 0.92], { skip: ['bottom'] }));
        b.with({ color: wall, pattern: PATTERN.plaster, ink: 'walls' }, () => b.boxAt([0, 0, 0], [0.86, CELL_H, 0.86], { skip: ['top', 'bottom'] }));
        b.with({ color: PALETTE.white, ink: `trim${y}` }, () => b.boxAt([0, CELL_H - 0.05, 0], [0.92, 0.05, 0.92]));
        for (let k = 0; k < 4; k++) {
          // k = 0 is the south face (+Z), then east, north, west.
          b.at(compose(rotationY((k * Math.PI) / 2), translation(0, 0, 0.43)), () => {
            const box = (i: number): number => (rand(seed, 'box', y, k, i) < 0.35 ? Math.floor(rand(seed, 'fl', y, k, i) * 5) : -1);
            const lift = (i: number): number => (rand(seed, 'lift', y, k, i) - 0.5) * 0.016; // nothing is ruler-level
            if (!below && k === 0) {
              b.at(translation(-0.17, 0.05, 0), () => doorAt(b, DOORS[Math.floor(rand(seed, 'door') * DOORS.length)]!));
              b.at(translation(0.19, 0.3 + lift(0), 0), () => windowAt(b, `w${y}-${k}-0`, box(0)));
            } else {
              b.at(translation(-0.19, 0.27 + lift(0), 0), () => windowAt(b, `w${y}-${k}-0`, box(0)));
              b.at(translation(0.19, 0.27 + lift(1), 0), () => windowAt(b, `w${y}-${k}-1`, box(1)));
            }
          });
        }
        const top = CELL_H;
        if (!above) {
          const roof = RAMPS.roof[Math.floor(rand(seed, 'roof') * RAMPS.roof.length)]!;
          const rise = 0.44 + rand(seed, 'rise') * 0.06, eave = 0.55, len = 0.5;
          // Slopes: one ink group, so the ridge is a crease and the roof is one surface.
          b.with({ color: roof, pattern: PATTERN.shingles, ink: 'roof' }, () => {
            b.quad([eave, top, len], [eave, top, -len], [0, top + rise, -len], [0, top + rise, len]);
            b.quad([-eave, top, -len], [-eave, top, len], [0, top + rise, len], [0, top + rise, -len]);
            b.quad([-eave, top, len], [-eave, top, -len], [eave, top, -len], [eave, top, len]); // the soffit
          });
          b.with({ color: wall, pattern: PATTERN.plaster, ink: 'gable' }, () => {
            b.tri([-eave, top, len], [eave, top, len], [0, top + rise, len]);
            b.tri([eave, top, -len], [-eave, top, -len], [0, top + rise, -len]);
          });
          // The round gable window: a white ring and a pane.
          b.at(compose(translation(0, top + 0.17, len), rotationX(Math.PI / 2)), () => {
            b.with({ color: PALETTE.white, ink: 'oculus' }, () => b.lathe([[0.085, 0], [0.085, 0.03]], { segments: 14, capTop: true }));
            b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'oculus-pane' }, () => b.lathe([[0.058, 0.03], [0.058, 0.036]], { segments: 14, capTop: true }));
          });
          if (rand(seed, 'chimney') < 0.85) {
            const cx = rand(seed, 'cx') < 0.5 ? 0.25 : -0.25, cz = -0.2 + (rand(seed, 'cz') - 0.5) * 0.2;
            b.with({ color: PALETTE.brick, pattern: PATTERN.brick, ink: 'chimney' }, () => b.boxAt([cx, top + 0.06, cz], [0.14, 0.4, 0.14], { skip: ['bottom'] }));
            b.with({ color: PALETTE.white, ink: 'chimney-cap' }, () => b.boxAt([cx, top + 0.44, cz], [0.19, 0.05, 0.19]));
          }
        } else if (!isHouse(cell + (1 << 12))) {
          // Something else stands on it: a flat terrace with a low parapet.
          b.with({ color: PALETTE.stoneShade, ink: 'terrace' }, () => b.boxAt([0, top, 0], [0.92, 0.04, 0.92], { skip: ['bottom'] }));
        }
      });
      out.add(b);
    }
    placeFeatures(out, anchors, s, plan, parts);
    return { mesh: out.build(), anchors };
  },
});
