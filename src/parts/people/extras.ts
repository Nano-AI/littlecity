// Small things people have about them (People, Stage 3): the chat bubble
// (L26) and the kite (L28); and (animation polish) the tools of the trades in
// their hands. Meshes only; the people system places them.

import { rotationY, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { PERSON } from '@/style/people';
import { tube } from '@/parts/ground/kit';

/**
 * A squiggle chat bubble: a white blob with a tail and three dots, the dots
 * on all four sides so it reads from every orbit quarter. Origin at the tip
 * of the tail, just over the speaker's head.
 */
export function bubbleMesh(): MeshData {
  const b = new MeshBuilder({ ink: 'chat-bubble' });
  const rx = 0.095, ry = 0.062, cy = 0.1;
  const profile: [number, number][] = [];
  for (let i = 6; i >= 0; i--) {
    const a = (Math.PI * i) / 6;
    profile.push([Math.max(0, rx * Math.sin(a)), cy + ry * Math.cos(a)]);
  }
  b.setInk('bubble').setColor(PALETTE.white).setPattern(PATTERN.none);
  b.lathe(profile, { segments: 10 });
  // The tail: a little cone down to the speaker.
  b.lathe([[0, 0], [0.028, cy - ry * 0.8]], { segments: 6 });
  // The squiggle: three dots, drawn on each side.
  b.setColor(PALETTE.ink);
  for (let side = 0; side < 4; side++) {
    b.at(rotationY((side * Math.PI) / 2), () => {
      for (const x of [-0.036, 0, 0.036]) {
        const z = rx * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) - 0.004;
        b.at(translation(x, cy, z), () => b.box([-0.009, -0.009, 0], [0.009, 0.009, 0.008], { skip: ['n'] }));
      }
    });
  }
  return b.build();
}

/**
 * A kite: a diamond with a cross spar and a tail of three bows. Origin at
 * the bridle (the middle of the diamond); it flies in its XY plane, facing
 * +Z. `colour` indexes the people palette's tops.
 */
export function kiteMesh(colour: number): MeshData {
  const b = new MeshBuilder({ ink: `kite${colour}` });
  const w = 0.13, up = 0.14, down = 0.2, t = 0.006;
  const c = PERSON.tops[((colour % PERSON.tops.length) + PERSON.tops.length) % PERSON.tops.length]!;
  b.setInk('sail').setColor(c).setPattern(PATTERN.cloth).setSway(0.3);
  for (const z of [t, -t]) {
    const pts: [number, number, number][] = [[0, up, z], [-w, 0, z], [0, -down, z], [w, 0, z]];
    if (z < 0) pts.reverse();
    b.quad(pts[0]!, pts[1]!, pts[2]!, pts[3]!);
  }
  b.setColor(PALETTE.wood).setPattern(PATTERN.none).setSway(0);
  b.box([-0.008, -down, -t - 0.004], [0.008, up, t + 0.004]);
  b.box([-w, -0.008, -t - 0.004], [w, 0.008, t + 0.004]);
  // The tail.
  b.setInk('tail').setColor(PALETTE.yellow).setPattern(PATTERN.cloth);
  for (let i = 0; i < 3; i++) {
    const y = -down - 0.06 - i * 0.075, x = (i % 2 === 0 ? 1 : -1) * 0.018;
    b.setSway(0.5 + i * 0.2);
    b.box([x - 0.028, y - 0.014, -0.004], [x + 0.028, y + 0.014, 0.004]);
  }
  return b.build();
}

/** The kite's line: a hair of a box from the origin one unit along +X, to be stretched from hand to kite. */
export function lineMesh(): MeshData {
  const b = new MeshBuilder({ ink: 'kite-line' });
  b.setInk('line').setColor(PALETTE.ink).setPattern(PATTERN.none);
  b.box([0, -0.004, -0.004], [1, 0.004, 0.004]);
  return b.build();
}

/**
 * What a worker holds (animation polish: nobody works empty-handed).
 *   broom   the shopkeeper sweeping       body frame: from the hands down to a brush on the ground ahead
 *   rod     anyone fishing                body frame: from the hands out and up, a line hanging from its tip
 *   can     a gardener tending            body frame: a watering can in the hands, by the bed
 *   sack    the miller walking            body frame: a flour sack hugged to the chest
 *   tray    the baker                     body frame: a tray of loaves on the forearms
 *   pole    the lamplighter walking       right arm frame: held at its foot, standing up past the head
 *   reach   the lamplighter at a lamp     right arm frame: the arm raised, the pole on up to the lamp
 * All in the figure's own units (the piece's matrix scales them with the person).
 */
export type Tool = 'broom' | 'rod' | 'can' | 'sack' | 'tray' | 'pole' | 'reach' | 'pike' | 'torch' | 'lance' | 'hammer' | 'balls-a' | 'balls-b' | 'scythe';
export const TOOLS: readonly Tool[] = ['broom', 'rod', 'can', 'sack', 'tray', 'pole', 'reach', 'pike', 'torch', 'lance', 'hammer', 'balls-a', 'balls-b', 'scythe'];
/** Which piece of the figure (PIECES order) a tool is held by; 5: a long tool laid in the hands along its own line (hands.ts). */
export const TOOL_PIECE: Readonly<Record<Tool, number>> = { broom: 5, rod: 5, can: 4, sack: 0, tray: 0, pole: 4, reach: 4, pike: 0, torch: 0, lance: 0, hammer: 4, 'balls-a': 0, 'balls-b': 0, scythe: 5 };

export function toolMesh(tool: Tool, colour: string = PALETTE.red): MeshData {
  const b = new MeshBuilder({ ink: `tool-${tool}` });
  b.setInk('tool').setPattern(PATTERN.none);
  switch (tool) {
    case 'broom':
      // Along +Y from the bristles at the origin (hands.ts lays it from the floor up into the hands).
      b.setColor(PALETTE.wood);
      tube(b, [[0, 0.03, 0], [0, 0.36, 0]], 0.006, { seg: 4 });
      b.setInk('brush').setColor('#d9b25f').setPattern(PATTERN.planks);
      b.box([-0.045, 0, -0.016], [0.045, 0.04, 0.016]);
      b.setInk('binding').setColor(PALETTE.redDark).setPattern(PATTERN.none);
      b.box([-0.03, 0.03, -0.012], [0.03, 0.042, 0.012]);
      break;
    case 'rod': {
      // In the figure's frame, along hands.ts's line for it: the butt at the chest, out over the water, the line
      // hanging from the tip.
      const a = [0, 0.24, 0.02], d = [0, 0.25, 0.44];
      const at = (t: number): [number, number, number] => [a[0]! + d[0]! * t, a[1]! + d[1]! * t, a[2]! + d[2]! * t];
      b.setColor(PALETTE.trunk);
      tube(b, [at(-0.05), at(0.6), at(1.15)], [0.007, 0.005, 0.003], { seg: 4 });
      const tip = at(1.15);
      b.setInk('line').setColor(PALETTE.ink);
      b.box([tip[0] - 0.0015, 0.05, tip[2] - 0.002], [tip[0] + 0.0015, tip[1], tip[2] + 0.002]);
      break;
    }
    case 'can':
      // Hanging from the right hand by its handle (arm frame: the hand is 0.093 down the arm).
      b.setColor('#6f9fae').setPattern(PATTERN.metal);
      tube(b, [[0, -0.09, 0], [0, -0.12, 0]], 0.004, { seg: 3 });
      b.at(translation(0.0, -0.15, 0.01), () => {
        b.lathe([[0, -0.03], [0.032, -0.03], [0.032, 0.03], [0, 0.03]], { segments: 8 });
        tube(b, [[0, 0, 0.02], [0, -0.02, 0.08]], 0.006, { seg: 4 }); // the spout, tipped to pour
      });
      break;
    case 'sack':
      b.setColor('#efe7d2').setPattern(PATTERN.cloth);
      b.at(translation(0, 0.19, 0.1), () => b.lathe([[0, -0.05], [0.042, -0.044], [0.046, 0.0], [0.034, 0.04], [0.012, 0.055], [0, 0.058]], { segments: 7 }));
      break;
    case 'tray':
      b.setColor(PALETTE.wood);
      b.box([-0.07, 0.15, 0.06], [0.07, 0.158, 0.16]);
      b.setInk('loaves').setColor('#d79a55');
      for (const x of [-0.04, 0, 0.04]) b.at(translation(x, 0.158, 0.11), () => b.lathe([[0, 0], [0.018, 0.002], [0.014, 0.016], [0, 0.02]], { segments: 6 }));
      break;
    case 'pole':
      // Up through the fist (arm frame: the hand is 0.093 down the arm).
      b.setColor(PALETTE.trunk);
      tube(b, [[0, -0.12, 0], [0, 0.42, 0]], 0.005, { seg: 4 });
      b.setInk('wick').setColor(PALETTE.metal);
      b.box([-0.008, 0.42, -0.008], [0.008, 0.45, 0.008]);
      break;
    case 'pike':
      // L36: held upright at the right hand, butt on the ground, the head well over the helmet.
      b.setColor(PALETTE.trunk);
      tube(b, [[0.085, 0.0, 0.05], [0.085, 0.66, 0.05]], 0.006, { seg: 4 });
      b.setInk('pike-head').setColor('#b9bac4').setPattern(PATTERN.metal);
      b.at(translation(0.085, 0.66, 0.05), () => b.lathe([[0, 0], [0.016, 0.018], [0, 0.07]], { segments: 4 }));
      break;
    case 'torch':
      // L36: a sentry's torch, raised a little in the right hand.
      b.setColor(PALETTE.trunk);
      tube(b, [[0.085, 0.12, 0.07], [0.085, 0.32, 0.09]], [0.007, 0.01], { seg: 4 });
      b.setInk('flame').setColor(PALETTE.yellow).setPattern(PATTERN.glow);
      b.at(translation(0.085, 0.33, 0.09), () => b.lathe([[0, 0], [0.022, 0.02], [0.012, 0.05], [0, 0.07]], { segments: 6 }));
      break;
    case 'lance':
      // L37: the rider's lance, upright, with a pennant in the garrison's colour.
      b.setColor(PALETTE.wood);
      tube(b, [[0.09, 0.06, 0.06], [0.09, 0.8, 0.07]], 0.006, { seg: 4 });
      b.setInk('pennant').setColor(colour).setPattern(PATTERN.cloth).setSway(0.6);
      b.quad([0.09, 0.78, 0.072], [0.09, 0.7, 0.072], [0.09, 0.73, -0.12], [0.09, 0.76, -0.12]);
      b.quad([0.09, 0.7, 0.068], [0.09, 0.78, 0.068], [0.09, 0.76, -0.12], [0.09, 0.73, -0.12]);
      break;
    case 'balls-a':
    case 'balls-b': {
      // L56: three juggling balls over the hands, in two drawings shown in turn.
      const up = tool === 'balls-a' ? [[-0.05, 0.42], [0.0, 0.52], [0.05, 0.36]] : [[-0.05, 0.36], [0.0, 0.45], [0.05, 0.5]];
      ['#e0543e', '#f2c230', '#4f8fd6'].forEach((colour, i) => {
        b.setInk(`ball${i}`).setColor(colour).setPattern(PATTERN.none);
        b.at(translation(up[i]![0]!, up[i]![1]!, 0.13), () => b.lathe([[0, -0.022], [0.016, -0.016], [0.022, 0], [0.016, 0.016], [0, 0.022]], { segments: 6 }));
      });
      break;
    }
    case 'scythe':
      // L59: along +Y from the blade's heel at the origin up the snath into the hands (hands.ts lays it); the
      // blade swept out along +X close to the ground.
      b.setColor(PALETTE.trunk);
      tube(b, [[0, 0, 0], [0, 0.36, 0]], 0.006, { seg: 4 });
      b.setInk('blade').setColor('#c9ccd6').setPattern(PATTERN.metal);
      b.polygon([[0, 0.0, -0.01], [0.17, -0.02, 0.02], [0.17, -0.005, 0.02], [0, 0.03, -0.01]]);
      b.polygon([[0, 0.03, -0.01], [0.17, -0.005, 0.02], [0.17, -0.02, 0.02], [0, 0.0, -0.01]]);
      break;
    case 'hammer':
      // L54: a builder's hammer in the right fist (arm frame: the hand is at the end of the arm, down −Y).
      b.setColor(PALETTE.trunk);
      tube(b, [[0, -0.11, 0.0], [0, -0.11, 0.09]], 0.007, { seg: 4 });
      b.setInk('head').setColor('#8d8e99').setPattern(PATTERN.metal);
      b.box([-0.012, -0.135, 0.08], [0.012, -0.085, 0.105]);
      break;
    case 'reach':
      b.setColor(PALETTE.trunk);
      tube(b, [[0, -0.09, 0.012], [0, -0.5, 0.012]], 0.005, { seg: 4 });
      b.setInk('wick').setColor(PALETTE.yellow);
      b.box([-0.009, -0.53, 0.003], [0.009, -0.5, 0.021]);
      break;
  }
  return b.build();
}

/**
 * L07: somebody at a lit window, as the street sees them: a dark head and shoulders against the pane.
 * Flat, facing +Z, one unit wide (x is scaled to the width wanted: 0.1 for a whole figure, less as it
 * slides in at the pane's edge); y is in world units, standing on y = 0.
 */
export function silhouetteMesh(): MeshData {
  const b = new MeshBuilder({ ink: 'silhouette' });
  b.setInk('figure').setColor('#2e211d').setPattern(PATTERN.none);
  const head: [number, number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    head.push([Math.cos(a) * 0.34, 0.215 + Math.sin(a) * 0.05, 0]);
  }
  b.polygon(head);
  // Shoulders: a rounded trapezium.
  b.polygon([[-0.5, 0, 0], [0.5, 0, 0], [0.48, 0.11, 0], [0.3, 0.16, 0], [-0.3, 0.16, 0], [-0.48, 0.11, 0]]);
  return b.build();
}

/** L07: a curtain being drawn across a lit pane: one unit wide (x scaled), 0.24 tall, standing on y = 0, facing +Z. */
export function curtainMesh(): MeshData {
  const b = new MeshBuilder({ ink: 'curtain' });
  b.setInk('curtain').setColor('#8a5a46').setPattern(PATTERN.cloth);
  b.polygon([[0, 0, 0], [1, 0, 0], [1, 0.24, 0], [0, 0.24, 0]]);
  return b.build();
}
