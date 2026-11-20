// Village-green props (U15): the mown sward, the maypole, a ring bench round
// a tree, the village sign; and the belvedere garden's (U23) citrus pots and pergola. Several parts in one file; each is discovered by
// its own export.

import { compose, rotationY, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { SLOT_INSET } from '@/gen/frames';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { terraceGrass } from '@/style/terrain';
import { PALETTE } from '@/style/palette';
import { clothColors, dab, lump, mixColor, pot, rngOf, tube, vary, TONE } from './kit';

const LINE = -(0.5 - SLOT_INSET);

/**
 * Sward: one cell of a village green's mown grass, a shade lighter than the
 * meadow round it and mown in stripes (the stripe follows the cell's column,
 * so a green reads as bands). Where the green ends (a clear bit of `mask` for
 * that side) the sward stops a little short in a worn edge. Frame: the
 * cell's NORTH-WEST CORNER slot, facing south (square to the world): the
 * part steps back to the cell's centre. It stands in a corner slot because
 * the walking graph ignores corner slots, so a lawn underfoot is never taken
 * for clutter in the middle of the cell.
 */
export const sward = definePart({
  prop: 'sward',
  build(item, ctx) {
    const b = ctx.mesh();
    const mask = item.params?.mask ?? 0;
    const stripe = item.params?.stripe ?? 0;
    const y = 0.011;
    const inset = (d: number): number => (mask & (1 << d) ? 0.5 : 0.44);
    // N is −z, E +x, S +z, W −x.
    const x0 = -inset(3), x1 = inset(1), z0 = -inset(0), z1 = inset(2);
    const up: Vec3 = [0, 1, 0];
    b.translate(SLOT_INSET, 0, SLOT_INSET);
    // The terrain's own grass surface at this level (src/gen/terrain/terrain.gen.ts draws it with
    // ink group `ground<level>` in a builder namespaced 'terrain'): the lawn is the same surface, a
    // shade lighter, so no pen line runs round it, only the change of colour where the mowing stops.
    const level = item.params?.level ?? 1;
    const light = mixColor(terraceGrass(level), PALETTE.grassHigh, stripe ? 0.55 : 0.32);
    b.setColor(light).setPattern(PATTERN.grass).setInkId(new MeshBuilder({ ink: 'terrain' }).inkOf(`ground${level}`));
    b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], { normals: [up, up, up, up] });
    return { mesh: b.build() };
  },
});

/** A ribbon from `a` to `b`, `w` wide, drawn on both faces; flat across the horizontal. */
function ribbon(b: MeshBuilder, a: Vec3, c: Vec3, w: number): void {
  const dx = c[0] - a[0], dz = c[2] - a[2];
  const len = Math.hypot(dx, dz) || 1;
  const px = (-dz / len) * w * 0.5, pz = (dx / len) * w * 0.5;
  const p1: Vec3 = [a[0] - px, a[1], a[2] - pz], p2: Vec3 = [a[0] + px, a[1], a[2] + pz];
  const p3: Vec3 = [c[0] + px, c[1], c[2] + pz], p4: Vec3 = [c[0] - px, c[1], c[2] - pz];
  b.quad(p1, p2, p3, p4);
  // The back face a hair below, so neither hides the other.
  const lo = (p: Vec3): Vec3 => [p[0], p[1] - 0.004, p[2]];
  b.quad(lo(p4), lo(p3), lo(p2), lo(p1));
}

/**
 * Maypole: a tall white pole wound with a red spiral, a garland crown with a
 * gilt knob, and six coloured ribbons running down and out to pegs in a ring
 * on the grass, swaying in the wind. Frame: a floor slot (the green's middle).
 * Anchor 'dance': the pole's foot (dancers circle it at a radius of about 0.9).
 */
export const maypole = definePart({
  prop: 'maypole',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 977));
    const H = 1.45, R = 0.42;
    b.rotateY(r('turn') * Math.PI);
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'pole' }, () => b.lathe([[0.05, 0], [0.04, H * 0.5], [0.03, H]], { segments: 8, capTop: true }));
    // The red spiral: short slanted bands up the pole, just proud of it.
    b.with({ color: PALETTE.red, pattern: PATTERN.none, ink: 'spiral' }, () => {
      const turns = 5, steps = 40;
      const pts: Vec3[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, a = t * turns * Math.PI * 2, y = 0.08 + t * (H - 0.25);
        const rad = 0.05 - t * 0.02 + 0.006;
        pts.push([Math.cos(a) * rad, y, Math.sin(a) * rad]);
      }
      tube(b, pts, 0.011, { seg: 3 });
    });
    // The garland crown: a ring of leafy lumps with flower dabs, and the gilt knob above.
    const crownY = H - 0.1;
    b.with({ color: vary(PALETTE.leafDark, r('crown')), pattern: PATTERN.leaves, ink: 'crown', sway: 0.15 }, () => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        lump(b, Math.cos(a) * 0.08, crownY, Math.sin(a) * 0.08, 0.05, 0.035, 0.05, { seg: 6, rings: 3, normal: TONE.lit, twist: i });
      }
    });
    b.with({ color: PALETTE.pink, pattern: PATTERN.none, ink: 'crown', sway: 0.15 }, () => {
      for (let i = 0; i < 6; i++) {
        const a = ((i + 0.5) / 6) * Math.PI * 2;
        dab(b, Math.cos(a) * 0.1, crownY + 0.025, Math.sin(a) * 0.1, 0.025, TONE.up, 5, 0.012);
      }
    });
    b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'knob' }, () => lump(b, 0, H + 0.03, 0, 0.035, 0.035, 0.035, { seg: 6, rings: 4 }));
    // Six ribbons from just under the crown out to pegs in a ring, sagging a little, swaying.
    const colors = clothColors();
    for (let i = 0; i < 6; i++) {
      const a = ((i + r('ra') * 0.2) / 6) * Math.PI * 2;
      const top: Vec3 = [Math.cos(a) * 0.03, crownY - 0.04, Math.sin(a) * 0.03];
      const mid: Vec3 = [Math.cos(a) * R * 0.55, H * 0.42, Math.sin(a) * R * 0.55];
      const foot: Vec3 = [Math.cos(a) * R, 0.02, Math.sin(a) * R];
      // All six in one ink group: thin strips each outlined would read as black wire.
      b.with({ color: colors[(i + Math.floor(r('rc') * 7)) % colors.length]!, pattern: PATTERN.cloth, ink: 'ribbons' }, () => {
        b.setSway((x, _y, z) => Math.min(1, Math.hypot(x, z) / (R * 0.5)) * Math.max(0, 1 - Math.hypot(x, z) / R) * 1.6);
        ribbon(b, top, mid, 0.06);
        ribbon(b, mid, foot, 0.06);
        b.setSway(0);
      });
      b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'pegs' }, () => b.boxAt([foot[0], 0, foot[2]], [0.03, 0.04, 0.03], { skip: ['bottom'] }));
    }
    return { mesh: b.build(), anchors: { dance: translation(0, 0, 0) } };
  },
});

/**
 * Ring bench: an eight-sided wooden seat round a tree's trunk, on stout legs,
 * the old men's bench of every village green. Frame: the tree cell's centre
 * slot, square to the world. Sockets 'seat-0'…'seat-3' face out to the four
 * sides.
 */
export const ringBench = definePart({
  prop: 'ring-bench',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 409));
    const ri = 0.16, ro = 0.3, y = 0.12, t = 0.03;
    const wood = vary(PALETTE.wood, r('wood'));
    b.at(rotationY(Math.PI / 8), () => {
      b.with({ color: wood, pattern: PATTERN.planks, ink: 'seat' }, () => {
        b.lathe([[ro, y], [ro, y + t], [ri, y + t], [ri, y], [ro, y]], { segments: 8, smooth: false });
      });
    });
    b.with({ color: mixColor(wood, PALETTE.trunk, 0.4), pattern: PATTERN.none, ink: 'legs' }, () => {
      for (let i = 0; i < 8; i++) {
        const a = ((i + 0.5) / 8) * Math.PI * 2 + Math.PI / 8, rad = (ri + ro) / 2;
        b.boxAt([Math.cos(a) * rad, 0, Math.sin(a) * rad], [0.03, y, 0.03], { skip: ['bottom', 'top'] });
      }
    });
    const seat = (k: number): ReturnType<typeof compose> => {
      const a = (k * Math.PI) / 2;
      return compose(rotationY(-a), translation(0, y + t, (ri + ro) / 2));
    };
    return { mesh: b.build(), anchors: { 'seat-0': seat(0), 'seat-1': seat(1), 'seat-2': seat(2), 'seat-3': seat(3) } };
  },
});

/**
 * Village sign: a painted board on a carved post at the edge of the green,
 * with the village's emblem (a sheaf, a ship or a tower by `look`) in a
 * roundel above. Frame: an edge slot, +Z toward the street it greets.
 */
export const villageSign = definePart({
  prop: 'village-sign',
  build(item, ctx) {
    const b = ctx.mesh();
    const look = item.params?.look ?? 0;
    const r = rngOf(ctx.seed ^ (look * 563));
    const z = LINE + 0.12;
    b.rotateZ((r('lean') - 0.5) * 0.03);
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'post' }, () => b.boxAt([0, 0, z], [0.06, 0.86, 0.06], { skip: ['bottom'] }));
    b.with({ color: mixColor(PALETTE.trunk, PALETTE.wood, 0.4), pattern: PATTERN.none, ink: 'base' }, () => b.boxAt([0, 0, z], [0.12, 0.08, 0.12], { skip: ['bottom'] }));
    // The board: a painted panel with a frame.
    const field = [PALETTE.glass, PALETTE.redDark, PALETTE.leafDark][look % 3]!;
    b.with({ color: field, pattern: PATTERN.none, ink: 'board' }, () => b.box([-0.17, 0.5, z + 0.035], [0.17, 0.72, z + 0.06]));
    b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'frame' }, () => {
      b.box([-0.19, 0.48, z + 0.03], [0.19, 0.5, z + 0.065]);
      b.box([-0.19, 0.72, z + 0.03], [0.19, 0.74, z + 0.065]);
    });
    // The emblem in white on the board: a few strokes.
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'emblem' }, () => {
      const kind = Math.floor(look / 3) % 3;
      if (kind === 0) for (let i = -1; i <= 1; i++) b.box([i * 0.035 - 0.008, 0.54, z + 0.06], [i * 0.035 + 0.008, 0.68, z + 0.068]); // a sheaf
      else if (kind === 1) {
        b.box([-0.08, 0.55, z + 0.06], [0.08, 0.58, z + 0.068]); // a hull
        b.box([-0.006, 0.58, z + 0.06], [0.006, 0.69, z + 0.068]); // a mast
      } else b.box([-0.03, 0.55, z + 0.06], [0.03, 0.68, z + 0.068]); // a tower
    });
    return { mesh: b.build() };
  },
});

/**
 * Citrus pot (U23 belvedere): a big terracotta pot with a clipped orange or
 * lemon tree in it, a round ball of leaves dotted with fruit. Frame: a floor
 * slot, square to the world.
 */
export const citrusPot = definePart({
  prop: 'citrus-pot',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 457));
    pot(b, 0.1, 0.16, PALETTE.brick, 'pot');
    b.with({ color: PALETTE.trunk, pattern: PATTERN.bark, ink: 'tree' }, () => tube(b, [[0, 0.15, 0], [0, 0.32, 0]], [0.018, 0.014], { seg: 5 }));
    const leaf = vary(PALETTE.leafDark, r('leaf'));
    b.with({ color: leaf, pattern: PATTERN.leaves, ink: 'tree', sway: 0.25 }, () => lump(b, 0, 0.4, 0, 0.13, 0.12, 0.13, { seg: 8, rings: 5, normal: TONE.lit }));
    const fruit = r('kind') < 0.6 ? mixColor(PALETTE.yellow, PALETTE.red, 0.45) : PALETTE.yellow;
    b.with({ color: fruit, pattern: PATTERN.none, ink: 'tree', sway: 0.25 }, () => {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + r('a') * 0.4, e = 0.1 + r('e', i) * 0.8;
        dab(b, Math.cos(a) * Math.cos(e) * 0.13, 0.4 + Math.sin(e) * 0.11, Math.sin(a) * Math.cos(e) * 0.13, 0.022, TONE.lit, 5, 0.015);
      }
    });
    return { mesh: b.build() };
  },
});

/**
 * Pergola (U23 belvedere): four white columns carrying a timber frame of
 * cross beams, a vine trained over it, a round table under it. Frame: a floor
 * slot, square to the world. Sockets 'seat-0', 'seat-1' at the table.
 */
export const pergola = definePart({
  prop: 'pergola',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 211));
    const h = 0.62, s = 0.36;
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'columns' }, () => {
      for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]] as const) b.at(translation(x, 0, z), () => b.lathe([[0.035, 0], [0.03, h]], { segments: 7, capTop: true }));
    });
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'beams' }, () => {
      for (const z of [-s, s]) b.box([-s - 0.08, h, z - 0.02], [s + 0.08, h + 0.04, z + 0.02]);
      for (let i = 0; i < 5; i++) {
        const x = -s + (i * 2 * s) / 4;
        b.box([x - 0.015, h + 0.04, -s - 0.08], [x + 0.015, h + 0.07, s + 0.08]);
      }
    });
    const leaf = vary(PALETTE.leaf, r('vine'));
    b.with({ color: leaf, pattern: PATTERN.leaves, ink: 'vine', sway: 0.2 }, () => {
      for (let i = 0; i < 5; i++) lump(b, -s + 0.1 + r('vx', i) * (2 * s - 0.2), h + 0.09, -s + 0.1 + r('vz', i) * (2 * s - 0.2), 0.13, 0.04, 0.11, { seg: 7, rings: 3, normal: TONE.lit, twist: i });
      lump(b, s, h * 0.6, s, 0.05, h * 0.4, 0.05, { seg: 6, rings: 4, normal: TONE.mid });
    });
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'table' }, () => b.lathe([[0.03, 0], [0.025, 0.2], [0.13, 0.2], [0.13, 0.22], [0, 0.22]], { segments: 10 }));
    return { mesh: b.build(), anchors: { 'seat-0': translation(-0.2, 0.12, 0), 'seat-1': compose(translation(0.2, 0.12, 0), rotationY(Math.PI)) } };
  },
});
