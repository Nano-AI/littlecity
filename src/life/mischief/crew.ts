// The repair crew, as drawn things (design section 13b, "The town rebuilds
// itself"): builders in work clothes and caps, their tools (hammer, saw,
// trowel, a hod of bricks, a plank or a ladder on the shoulder, a barrow) and
// their poses (hammering, sawing, trowelling, climbing a ladder, carrying,
// pushing a barrow), and a handcart of materials. Built on the people's own
// figure (src/parts/people): five rigid pieces posed by matrices, on twos.
// Owner: Mischief. Pure.
//
// What they do (arriving, choosing a ruin, working it a storey at a time) is
// Phase B; the mischief system only stands three of them at work round any
// building in scaffolding, so they can be seen.

import { translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { tube } from '@/parts/ground/kit';
import { lookOf, type Look } from '@/parts/people/person';
import { held, rigMatrices, type Pose } from '@/parts/people/pose';
import { DAMAGE_COLORS } from '@/style/damage';
import { PALETTE } from '@/style/palette';

export type CrewTool = 'hammer' | 'saw' | 'trowel' | 'hod' | 'plank' | 'ladder' | 'barrow';
export type CrewPose = 'hammer' | 'saw' | 'trowel' | 'climb' | 'shoulder' | 'push' | 'stand';

/** Which piece of the figure holds each tool (0 body, 4 right arm). */
export const CREW_TOOL_PIECE: Readonly<Record<CrewTool, number>> = { hammer: 4, saw: 0, trowel: 4, hod: 0, plank: 0, ladder: 0, barrow: 0 };

const OVERALLS = ['#7d9cc4', '#c98e5a', '#8fae7c', '#b88fb0'];

/** A builder: overalls, a cap, sturdy boots (the shoes are the figure's own). */
export function builderLook(seed: number): Look {
  const look = lookOf(seed, false);
  const k = Math.abs(seed) % OVERALLS.length;
  return { ...look, top: OVERALLS[k]!, bottom: '#6b5a4c', hat: 'cap', hatColor: k % 2 ? PALETTE.yellow : PALETTE.red, dress: false, hairStyle: look.hairStyle === 'long' ? 'short' : look.hairStyle };
}

const meshes = new Map<CrewTool, MeshData>();

/** A tool in its holder's frame (the arm: origin at the shoulder, hand at y −0.108; the body: origin at the feet). */
export function crewToolMesh(tool: CrewTool): MeshData {
  let m = meshes.get(tool);
  if (m) return m;
  const b = new MeshBuilder({ ink: `crew-${tool}` });
  b.setInk('tool').setPattern(PATTERN.none);
  switch (tool) {
    case 'hammer':
      b.setColor(PALETTE.wood);
      tube(b, [[0, -0.1, 0.0], [0, -0.1, 0.11]], 0.006, { seg: 4 });
      b.setInk('head').setColor(PALETTE.metal).setPattern(PATTERN.metal);
      b.box([-0.012, -0.125, 0.1], [0.012, -0.075, 0.125]);
      break;
    case 'trowel':
      b.setColor(PALETTE.wood);
      tube(b, [[0, -0.1, 0.0], [0, -0.1, 0.04]], 0.006, { seg: 4 });
      b.setInk('blade').setColor('#b9bac4').setPattern(PATTERN.metal);
      b.polygon([[-0.02, -0.11, 0.04], [0.02, -0.11, 0.04], [0, -0.11, 0.1]]);
      b.polygon([[0, -0.11, 0.1], [0.02, -0.11, 0.04], [-0.02, -0.11, 0.04]]);
      break;
    case 'saw':
      // Held in both hands in front, the blade down into a plank on a trestle.
      b.setColor(PALETTE.wood);
      b.box([-0.02, 0.17, 0.1], [0.02, 0.2, 0.13]);
      b.setInk('blade').setColor('#c9cad3').setPattern(PATTERN.metal);
      b.polygon([[0, 0.18, 0.13], [0, 0.12, 0.3], [0, 0.16, 0.3], [0, 0.2, 0.13]]);
      b.polygon([[0, 0.2, 0.13], [0, 0.16, 0.3], [0, 0.12, 0.3], [0, 0.18, 0.13]]);
      b.setInk('trestle').setColor(DAMAGE_COLORS.fresh).setPattern(PATTERN.planks);
      b.box([-0.12, 0.1, 0.22], [0.12, 0.125, 0.3]);
      b.setColor(PALETTE.wood).setInk('legs');
      for (const x of [-0.1, 0.1]) b.box([x - 0.01, 0, 0.24], [x + 0.01, 0.1, 0.28]);
      break;
    case 'hod':
      // A wooden trough of bricks on a pole, over the right shoulder.
      b.setColor(PALETTE.wood).setPattern(PATTERN.planks);
      tube(b, [[0.07, 0.2, 0.05], [0.07, 0.31, -0.02]], 0.006, { seg: 4 });
      b.box([0.03, 0.3, -0.07], [0.11, 0.34, 0.01]);
      b.setInk('bricks').setColor(PALETTE.brick).setPattern(PATTERN.brick);
      b.box([0.04, 0.34, -0.06], [0.1, 0.38, 0.0]);
      break;
    case 'plank':
      b.setColor(DAMAGE_COLORS.fresh).setPattern(PATTERN.planks);
      b.box([0.05, 0.3, -0.2], [0.09, 0.32, 0.26]);
      break;
    case 'ladder':
      b.setColor(DAMAGE_COLORS.fresh).setPattern(PATTERN.none);
      for (const x of [0.04, 0.11]) b.box([x - 0.008, 0.3, -0.28], [x + 0.008, 0.315, 0.32]);
      for (let k = 0; k < 6; k++) b.box([0.04, 0.3, -0.25 + k * 0.1], [0.11, 0.31, -0.24 + k * 0.1]);
      break;
    case 'barrow':
      // Pushed in front: a tray of rubble on one wheel, two handles to the hands.
      b.setColor(PALETTE.wood).setPattern(PATTERN.planks);
      tube(b, [[-0.06, 0.13, 0.14], [-0.05, 0.08, 0.42]], 0.006, { seg: 4 });
      tube(b, [[0.06, 0.13, 0.14], [0.05, 0.08, 0.42]], 0.006, { seg: 4 });
      b.setInk('tray').setColor('#8a8f9e').setPattern(PATTERN.metal);
      b.box([-0.08, 0.07, 0.24], [0.08, 0.15, 0.42]);
      b.setInk('load').setColor(DAMAGE_COLORS.rubble).setPattern(PATTERN.cobbles);
      b.box([-0.07, 0.15, 0.26], [0.07, 0.18, 0.4]);
      b.setInk('wheel').setColor(PALETTE.metal).setPattern(PATTERN.none);
      b.at([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0.045, 0.47, 1], () => b.lathe([[0.045, -0.012], [0.045, 0.012]], { segments: 10, capTop: true, capBottom: true }));
      break;
  }
  meshes.set(tool, (m = b.build()));
  return m;
}

/** The tool a pose holds. */
export function crewToolOf(pose: CrewPose, carrying: 'hod' | 'plank' | 'ladder' = 'hod'): CrewTool | null {
  if (pose === 'hammer') return 'hammer';
  if (pose === 'saw') return 'saw';
  if (pose === 'trowel') return 'trowel';
  if (pose === 'push') return 'barrow';
  if (pose === 'shoulder') return carrying;
  return null;
}

/** A crew pose at `t` seconds in it, on twos (held drawings). `seed` (0–1) staggers the crew. */
export function crewPose(name: CrewPose, t: number, seed = 0): Pose {
  const p: Pose = { legL: 0, legR: 0, armL: 0, armR: 0, outL: 0.1, outR: 0.1, lean: 0, lift: 0, twist: 0 };
  const beat = (count: number, rate: number): number => held(t + seed * 5, rate, count);
  switch (name) {
    case 'hammer': {
      // Up, and down: bang. Three drawings: raised, coming down, struck.
      const d = beat(4, 6);
      p.armR = [2.5, 1.7, 1.05, 1.05][d]!;
      p.armL = 0.9;
      p.outL = -0.1;
      p.lean = d >= 2 ? 0.28 : 0.18;
      break;
    }
    case 'saw': {
      const d = beat(2, 5);
      p.armL = p.armR = d ? 1.1 : 0.75;
      p.outL = p.outR = -0.25;
      p.lean = 0.32;
      p.legL = 0.25;
      p.legR = -0.15;
      break;
    }
    case 'trowel': {
      const d = beat(3, 4);
      p.armR = [1.25, 1.45, 1.1][d]!;
      p.outR = [0.05, -0.2, 0.2][d]!;
      p.armL = 0.6;
      p.lean = 0.45;
      break;
    }
    case 'climb': {
      // Hand over hand up a ladder: arms high, knees lifting in turn.
      const d = beat(2, 3);
      p.armL = d ? 2.7 : 2.2;
      p.armR = d ? 2.2 : 2.7;
      p.outL = p.outR = -0.05;
      p.legL = d ? 0.9 : 0.1;
      p.legR = d ? 0.1 : 0.9;
      p.lean = 0.12;
      break;
    }
    case 'shoulder': {
      // Walking with a load on the right shoulder, steadied by the right hand.
      const d = beat(4, 6);
      p.legL = [0.45, 0, -0.45, 0][d]!;
      p.legR = -p.legL;
      p.armR = 2.75;
      p.outR = -0.25;
      p.armL = -p.legL * 0.6;
      p.lift = d % 2 ? 0.006 : 0;
      break;
    }
    case 'push': {
      const d = beat(4, 5);
      p.legL = [0.4, 0, -0.4, 0][d]!;
      p.legR = -p.legL;
      p.armL = p.armR = 0.55;
      p.outL = p.outR = 0.3;
      p.lean = 0.3;
      break;
    }
    case 'stand':
      p.armL = beat(2, 0.7) ? 0.15 : 0;
      break;
  }
  return p;
}

/** World matrices of the five pieces of a figure: T(x, y, z) · Ry(heading) · S(scale) · local. */
export function placeFigure(look: Look, pose: Pose, x: number, y: number, z: number, heading: number, out: Float32Array = new Float32Array(80)): Float32Array {
  const local = rigMatrices(look, pose);
  const scale = look.scale;
  const c = Math.cos(heading) * scale, s = Math.sin(heading) * scale;
  for (let i = 0; i < 5; i++) {
    const k = i * 16;
    for (let col = 0; col < 4; col++) {
      const o = k + col * 4;
      const lx = local[o]!, ly = local[o + 1]!, lz = local[o + 2]!;
      out[o] = c * lx + s * lz + (col === 3 ? x : 0);
      out[o + 1] = scale * ly + (col === 3 ? y : 0);
      out[o + 2] = -s * lx + c * lz + (col === 3 ? z : 0);
      out[o + 3] = col === 3 ? 1 : 0;
    }
  }
  return out;
}

let cart: MeshData | null = null;
/** A handcart of materials: two wheels, a bed of new boards, a sack and a bucket. Origin at the ground, shafts toward +Z. */
export function handcartMesh(): MeshData {
  if (cart) return cart;
  const b = new MeshBuilder({ ink: 'handcart' });
  b.setColor(PALETTE.wood).setPattern(PATTERN.planks).setInk('cart');
  b.box([-0.14, 0.12, -0.2], [0.14, 0.15, 0.16]);
  b.box([-0.14, 0.15, -0.2], [-0.12, 0.22, 0.16]);
  b.box([0.12, 0.15, -0.2], [0.14, 0.22, 0.16]);
  tube(b, [[-0.1, 0.14, 0.16], [-0.09, 0.1, 0.42]], 0.008, { seg: 4 });
  tube(b, [[0.1, 0.14, 0.16], [0.09, 0.1, 0.42]], 0.008, { seg: 4 });
  b.setInk('wheels').setColor(PALETTE.metal).setPattern(PATTERN.none);
  for (const x of [-0.17, 0.17]) {
    b.at([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, x, 0.1, -0.02, 1], () => b.lathe([[0.1, -0.012], [0.1, 0.012]], { segments: 12, capTop: true, capBottom: true }));
  }
  b.setInk('load').setColor(DAMAGE_COLORS.fresh).setPattern(PATTERN.planks);
  b.box([-0.11, 0.15, -0.18], [0.03, 0.2, 0.14]);
  b.setInk('sack').setColor('#efe7d2').setPattern(PATTERN.cloth);
  b.at(translation(0.07, 0.2, -0.08), () => b.lathe([[0, -0.05], [0.045, -0.04], [0.04, 0.03], [0, 0.05]], { segments: 7 }));
  b.setInk('bucket').setColor('#8a8f9e').setPattern(PATTERN.metal);
  b.at(translation(0.07, 0.15, 0.08), () => b.lathe([[0.035, 0], [0.045, 0.07]], { segments: 8, capBottom: true }));
  return (cart = b.build());
}
