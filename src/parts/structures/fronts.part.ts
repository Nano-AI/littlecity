// Trade fronts (J30, discovery round 1): what a working building's walls
// show of its trade. Bold, few shapes in the house style: boards in
// PALETTE.wood with the darker trunk tone for braces and beams.
//
// Frames: on the wall plane, the storey's floor at y = 0, +Z out of the
// wall (house.gen's onWall). The hayloft is placed by the gable frame,
// which expects the piece centred half-way up a storey (y = CELL_H / 2).

import { CELL_H } from '@/core/grid';
import { compose, rotationX, rotationY, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';

/** A boarded leaf from x0 to x1, y0 to y1, standing `out` proud of the wall, with a Z brace on its face. */
function leaf(b: MeshBuilder, x0: number, x1: number, y0: number, y1: number, out: number, ink: string): void {
  b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink }, () => b.box([x0, y0, 0.004], [x1, y1, out], { skip: ['n'] }));
  b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: `${ink}-brace` }, () => {
    const t = 0.03, z = out + 0.012;
    b.quad([x0 + 0.02, y0 + 0.08, z], [x1 - 0.02, y0 + 0.08, z], [x1 - 0.02, y0 + 0.08 + t, z], [x0 + 0.02, y0 + 0.08 + t, z]);
    b.quad([x0 + 0.02, y1 - 0.08 - t, z], [x1 - 0.02, y1 - 0.08 - t, z], [x1 - 0.02, y1 - 0.08, z], [x0 + 0.02, y1 - 0.08, z]);
    // the diagonal, bottom left to top right
    const ax = x0 + 0.03, ay = y0 + 0.08 + t, bx = x1 - 0.03, by = y1 - 0.08 - t;
    b.quad([ax, ay, z], [ax + 0.04, ay, z], [bx, by, z], [bx - 0.04, by, z]);
  });
}

export const barnDoors = definePart({
  feature: 'barn-doors',
  build(_item, ctx) {
    const b = ctx.mesh();
    // Two big leaves swung back flat against the wall either side of the doorway, and the beam over it.
    leaf(b, -0.49, -0.27, 0.03, 0.66, 0.03, 'leaf-l');
    leaf(b, 0.27, 0.49, 0.03, 0.66, 0.03, 'leaf-r');
    b.with({ color: PALETTE.trunk, pattern: PATTERN.planks, ink: 'beam' }, () => b.box([-0.49, 0.66, 0.0], [0.49, 0.72, 0.055], { skip: ['n'] }));
    // Iron hinge straps across each leaf's inner edge.
    b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'straps' }, () => {
      for (const x of [-0.27, 0.27]) for (const y of [0.17, 0.52]) b.box([x - (x < 0 ? 0.1 : 0), y, 0.034], [x + (x > 0 ? 0.1 : 0), y + 0.025, 0.046], { skip: ['n'] });
    });
    return { mesh: b.build() };
  },
});

export const hayloft = definePart({
  feature: 'hayloft',
  build(_item, ctx) {
    const b = ctx.mesh();
    const cy = CELL_H / 2;
    // A square loft door in a frame, a little sill, and a hoist beam over it with a pulley.
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'frame' }, () => b.box([-0.16, cy - 0.17, 0], [0.16, cy + 0.15, 0.025], { skip: ['n'] }));
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'door' }, () => b.box([-0.13, cy - 0.14, 0.025], [0.13, cy + 0.12, 0.04], { skip: ['n'] }));
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'brace' }, () => {
      const z = 0.042;
      b.quad([-0.11, cy - 0.12, z], [-0.07, cy - 0.12, z], [0.11, cy + 0.1, z], [0.07, cy + 0.1, z]);
    });
    b.with({ color: PALETTE.trunk, pattern: PATTERN.planks, ink: 'hoist' }, () => b.box([-0.03, cy + 0.2, 0], [0.03, cy + 0.26, 0.34], { skip: ['n'] }));
    b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'pulley' }, () => {
      b.box([-0.012, cy + 0.12, 0.29], [0.012, cy + 0.2, 0.31], { skip: ['top'] });
      b.box([-0.004, cy - 0.12, 0.296], [0.004, cy + 0.12, 0.304], { skip: ['top'] });
      b.box([-0.025, cy - 0.15, 0.285], [0.025, cy - 0.12, 0.315]);
    });
    return { mesh: b.build() };
  },
});

export const loadingDoors = definePart({
  feature: 'loading-doors',
  build(item, ctx) {
    const b = ctx.mesh();
    const n = Math.max(1, Math.round(item.params?.storeys ?? 2));
    // One door per storey, stacked: a wide boarded pair on the ground, loft doors above, each in a white frame.
    for (let k = 0; k < n; k++) {
      const y0 = k * CELL_H + (k === 0 ? 0.02 : 0.1), y1 = k * CELL_H + (k === 0 ? 0.6 : 0.62);
      const hw = k === 0 ? 0.24 : 0.19;
      b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: `frame${k}` }, () => b.box([-hw - 0.035, y0, 0], [hw + 0.035, y1 + 0.035, 0.022], { skip: ['n'] }));
      b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: `door${k}` }, () => b.box([-hw, y0, 0.022], [hw, y1, 0.036], { skip: ['n'] }));
      b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: `brace${k}` }, () => {
        const z = 0.038;
        b.quad([-0.01, y0, z], [0.01, y0, z], [0.01, y1, z], [-0.01, y1, z]); // the meeting stiles
        b.quad([-hw + 0.02, y0 + 0.02, z], [-hw + 0.06, y0 + 0.02, z], [-0.03, y1 - 0.02, z], [-0.07, y1 - 0.02, z]);
        b.quad([0.07, y1 - 0.02, z], [0.03, y1 - 0.02, z], [hw - 0.06, y0 + 0.02, z], [hw - 0.02, y0 + 0.02, z]);
      });
      // A little sill to land the loads on.
      if (k > 0) b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: `sill${k}` }, () => b.box([-hw - 0.05, y0 - 0.04, 0], [hw + 0.05, y0, 0.08], { skip: ['n'] }));
    }
    // The hoist: a beam out from the wall over the doors, a pulley at its end and the rope with its hook.
    const top = (n - 1) * CELL_H + 0.69;
    b.with({ color: PALETTE.trunk, pattern: PATTERN.planks, ink: 'hoist' }, () => b.box([-0.035, top, 0], [0.035, top + 0.07, 0.4], { skip: ['n'] }));
    b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'pulley' }, () => {
      b.box([-0.014, top - 0.07, 0.33], [0.014, top, 0.37], { skip: ['top'] });
      b.box([-0.004, top - 0.38, 0.346], [0.004, top - 0.07, 0.354], { skip: ['top'] });
      b.box([-0.03, top - 0.42, 0.33], [0.03, top - 0.38, 0.37]);
    });
    return { mesh: b.build(), anchors: { 'loading-door': translation(0, 0, 0.3), hoist: translation(0, top - 0.42, 0.35) } };
  },
});

export const bridgeBrackets = definePart({
  feature: 'bridge-brackets',
  build(_item, ctx) {
    const b = ctx.mesh();
    // A sill beam along the foot of the wall and two raking struts down and back into the bridge below.
    b.with({ color: PALETTE.trunk, pattern: PATTERN.planks, ink: 'sill' }, () => b.box([-0.43, -0.06, 0], [0.43, 0.0, 0.05], { skip: ['n'] }));
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'struts' }, () => {
      for (const x of [-0.28, 0.28]) {
        b.at(compose(translation(x, -0.06, 0.03), rotationX(0.6)), () => b.box([-0.025, -0.36, -0.025], [0.025, 0, 0.025], { skip: ['top'] }));
      }
    });
    return { mesh: b.build() };
  },
});

export const bellCupola = definePart({
  feature: 'bell-cupola',
  build(_item, ctx) {
    const b = ctx.mesh();
    // R-H21: a little open bell turret astride the ridge: a boarded base, four posts, a bell, a pyramid cap.
    b.with({ color: PALETTE.white, pattern: PATTERN.planks, ink: 'base' }, () => b.boxAt([0, -0.08, 0], [0.24, 0.16, 0.24]));
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'posts' }, () => {
      for (const x of [-0.1, 0.1]) for (const z of [-0.1, 0.1]) b.boxAt([x, 0.08, z], [0.035, 0.2, 0.035], { skip: ['bottom', 'top'] });
    });
    b.with({ color: PALETTE.yellow, pattern: PATTERN.metal, ink: 'bell' }, () => b.lathe([[0.055, 0.1], [0.045, 0.16], [0.02, 0.21], [0, 0.22]], { segments: 8, capBottom: true }));
    b.with({ color: PALETTE.redDark, pattern: PATTERN.shingles, ink: 'cap' }, () =>
      b.at(rotationY(Math.PI / 4), () => b.lathe([[0.19, 0.28], [0, 0.46]], { segments: 4, smooth: false, capBottom: true })),
    );
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'finial' }, () => b.boxAt([0, 0.46, 0], [0.018, 0.08, 0.018], { skip: ['bottom'] }));
    return { mesh: b.build() };
  },
});

export const forgeFront = definePart({
  feature: 'forge-front',
  build(_item, ctx) {
    const b = ctx.mesh();
    const hw = 0.27, h = 0.54;
    // The open front: a dark opening in a stone surround, the hearth glowing at the back of it (it glows at
    // dusk and night), and a plank shutter propped up over it as a canopy.
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'surround' }, () => {
      b.box([-hw - 0.06, 0, 0], [-hw, h, 0.03], { skip: ['n', 'bottom'] });
      b.box([hw, 0, 0], [hw + 0.06, h, 0.03], { skip: ['n', 'bottom'] });
      b.box([-hw - 0.06, h, 0], [hw + 0.06, h + 0.07, 0.035], { skip: ['n'] });
    });
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'dark' }, () => b.quad([-hw, 0.005, 0.004], [hw, 0.005, 0.004], [hw, h, 0.004], [-hw, h, 0.004]));
    b.with({ color: PALETTE.yellow, pattern: PATTERN.glow, ink: 'hearth' }, () => b.quad([-0.2, 0.06, 0.008], [0.2, 0.06, 0.008], [0.16, 0.26, 0.008], [-0.16, 0.26, 0.008]));
    b.with({ color: PALETTE.red, pattern: PATTERN.glow, ink: 'fire' }, () => b.tri([-0.1, 0.08, 0.011], [0.1, 0.08, 0.011], [0.0, 0.24, 0.011]));
    b.with({ color: PALETTE.brick, pattern: PATTERN.brick, ink: 'hood' }, () => b.quad([-0.16, 0.22, 0.01], [0.16, 0.22, 0.01], [0.09, 0.42, 0.01], [-0.09, 0.42, 0.01]));
    // The shutter, hinged at the head and propped out on two sticks.
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'shutter' }, () => {
      b.at(compose(translation(0, h + 0.07, 0.035), rotationX(-0.35)), () => b.box([-hw - 0.04, 0, 0], [hw + 0.04, 0.025, 0.36]));
    });
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'props' }, () => {
      for (const x of [-hw, hw]) b.box([x - 0.012, 0.3, 0.31], [x + 0.012, 0.72, 0.334]);
    });
    return { mesh: b.build() };
  },
});
