// The things the living town carries (L51 and up): in the hands, and set
// down. One drawing per kind, so a sack in the miller's arms is the same sack
// that then sits by the bakery door. Meshes only; people.system holds the
// carried one to the figure, the town's stores place the resting ones.
//
// Built a little big and bright for what they are (a sack is a third of a
// person tall): they must read at playing zoom, where a person is about 23
// pixels. Figure units (a person is 0.42 tall; the figure's scale takes
// them to the world).

import { multiply, rotationX, translation, type Mat4Like } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { tube } from '@/parts/ground/kit';
import { PALETTE } from '@/style/palette';

/**
 * Something carried (drawn in the hands; src/parts/people/loads.ts) or set down somewhere (a store).
 *   sack     a flour or grain sack           tray     a baker's tray of loaves
 *   loaf     one loaf, bought                bucket   a pail of water
 *   fish     a basket of the catch           fishes   a fish or two, bought
 *   ladder   a builder's ladder (shoulder)   hod      a hod of bricks (shoulder)
 *   crate    a crate of goods                lantern  a lantern on a pole
 *   basket   a basket of vegetables          washing  a basket of washing
 *   sheaf    a sheaf of wheat                petals   a basket of petals
 *   bouquet  a bride's flowers
 */
export type Load = 'sack' | 'tray' | 'loaf' | 'bucket' | 'fish' | 'fishes' | 'ladder' | 'hod' | 'crate' | 'lantern' | 'basket' | 'washing' | 'sheaf' | 'petals' | 'bouquet';

function ball(b: MeshBuilder, rx: number, ry: number, segments = 7): void {
  const prof: [number, number][] = [];
  for (let i = 0; i <= 5; i++) {
    const a = Math.PI * (1 - i / 5);
    prof.push([Math.max(0, Math.sin(a) * rx), Math.cos(a) * ry]);
  }
  b.lathe(prof, { segments });
}

function basket(b: MeshBuilder, r: number, h: number, colour = '#b07a3e'): void {
  b.setInk('basket').setColor(colour).setPattern(PATTERN.thatch);
  b.lathe([[0, 0], [r * 0.8, 0], [r, h], [r * 0.88, h]], { segments: 9 });
}

/** How much bigger than life the loads are drawn, to read at playing zoom. */
const BIG = 1.3;

/** One load, standing on its own bottom (y = 0) at the origin, front +Z. */
function drawLoad(b: MeshBuilder, kind: Load): void {
  b.at([BIG, 0, 0, 0, 0, BIG, 0, 0, 0, 0, BIG, 0, 0, 0, 0, 1], () => drawLoadAt(b, kind));
}

function drawLoadAt(b: MeshBuilder, kind: Load): void {
  b.setPattern(PATTERN.none);
  switch (kind) {
    case 'sack':
      b.setInk('sack').setColor('#e6cc97').setPattern(PATTERN.cloth);
      b.lathe([[0, 0], [0.06, 0.006], [0.068, 0.06], [0.055, 0.12], [0.022, 0.15], [0.03, 0.17], [0, 0.17]], { segments: 8 });
      b.setInk('band').setColor('#3f67b0').setPattern(PATTERN.none);
      b.lathe([[0.069, 0.065], [0.066, 0.095]], { segments: 8 });
      break;
    case 'tray':
      b.setInk('tray').setColor(PALETTE.wood).setPattern(PATTERN.planks);
      b.box([-0.11, 0, -0.06], [0.11, 0.012, 0.06]);
      b.setInk('loaves').setColor('#d98b3a').setPattern(PATTERN.none);
      for (const [x, z] of [[-0.06, -0.025], [0.0, -0.025], [0.06, -0.025], [-0.03, 0.028], [0.03, 0.028]] as const) b.at(translation(x, 0.012, z), () => ball(b, 0.03, 0.026));
      break;
    case 'loaf':
      b.setInk('loaf').setColor('#d4883a');
      b.at(translation(0, 0.03, 0), () => {
        tube(b, [[-0.09, 0, 0], [0.09, 0, 0]], 0.03, { seg: 6 });
        b.at(translation(-0.09, 0, 0), () => ball(b, 0.03, 0.03));
        b.at(translation(0.09, 0, 0), () => ball(b, 0.03, 0.03));
      });
      b.setInk('score').setColor('#f0c27a');
      for (const x of [-0.04, 0.0, 0.04]) b.box([x - 0.006, 0.055, -0.012], [x + 0.006, 0.062, 0.012]);
      break;
    case 'bucket':
      b.setInk('bucket').setColor('#7f98a8').setPattern(PATTERN.metal);
      b.lathe([[0, 0], [0.038, 0], [0.048, 0.075], [0.044, 0.075]], { segments: 9 });
      b.setInk('water').setColor('#58a6d8').setPattern(PATTERN.none);
      b.lathe([[0, 0.068], [0.044, 0.068]], { segments: 9 });
      b.setInk('handle').setColor(PALETTE.metal);
      tube(b, [[-0.046, 0.075, 0], [-0.03, 0.12, 0], [0.03, 0.12, 0], [0.046, 0.075, 0]], 0.004, { seg: 3 });
      break;
    case 'fish':
      basket(b, 0.075, 0.07);
      b.setInk('catch').setColor('#a8c6dc');
      for (const [x, z, yaw] of [[-0.03, 0, 0.3], [0.02, 0.02, -0.5], [0.0, -0.025, 1.2]] as const)
        b.at(translation(x, 0.07, z), () => b.at([Math.cos(yaw), 0, -Math.sin(yaw), 0, 0, 1, 0, 0, Math.sin(yaw), 0, Math.cos(yaw), 0, 0, 0, 0, 1], () => ball(b, 0.018, 0.016)));
      b.setInk('tails').setColor('#7fa3bd');
      b.box([0.035, 0.07, -0.01], [0.06, 0.09, 0.01]);
      break;
    case 'fishes':
      b.setInk('fish').setColor('#a8c6dc');
      b.at(translation(0, 0.05, 0), () => ball(b, 0.018, 0.05));
      b.setInk('tail').setColor('#7fa3bd');
      b.box([-0.022, 0.0, -0.004], [0.022, 0.012, 0.004]);
      b.setInk('string').setColor(PALETTE.ink);
      b.box([-0.002, 0.1, -0.002], [0.002, 0.13, 0.002]);
      break;
    case 'ladder':
      // Lying along Z (it is carried on the shoulder, fore and aft), its middle at the origin.
      b.setInk('ladder').setColor('#d1a466').setPattern(PATTERN.planks);
      b.box([-0.045, 0, -0.3], [-0.03, 0.016, 0.3]);
      b.box([0.03, 0, -0.3], [0.045, 0.016, 0.3]);
      for (let i = 0; i < 6; i++) {
        const z = -0.25 + i * 0.1;
        b.box([-0.03, 0.004, z - 0.006], [0.03, 0.012, z + 0.006]);
      }
      break;
    case 'hod':
      b.setInk('hod').setColor(PALETTE.wood).setPattern(PATTERN.planks);
      b.box([-0.04, 0, -0.07], [0.04, 0.012, 0.07]);
      b.box([-0.04, 0, -0.07], [-0.03, 0.05, 0.07]);
      b.box([0.03, 0, -0.07], [0.04, 0.05, 0.07]);
      b.setInk('bricks').setColor('#c4583f').setPattern(PATTERN.brick);
      b.box([-0.03, 0.012, -0.06], [0.03, 0.05, 0.06]);
      break;
    case 'crate':
      b.setInk('crate').setColor('#b9864c').setPattern(PATTERN.planks);
      b.box([-0.06, 0, -0.05], [0.06, 0.09, 0.05]);
      b.setInk('slats').setColor('#8c5f31').setPattern(PATTERN.none);
      b.box([-0.062, 0.035, -0.052], [0.062, 0.05, 0.052]);
      break;
    case 'lantern':
      b.setInk('frame').setColor(PALETTE.metal);
      b.box([-0.025, 0, -0.025], [0.025, 0.008, 0.025]);
      b.box([-0.02, 0.06, -0.02], [0.02, 0.07, 0.02]);
      b.setInk('light').setColor(PALETTE.yellow).setPattern(PATTERN.glow);
      b.box([-0.018, 0.008, -0.018], [0.018, 0.06, 0.018]);
      break;
    case 'basket':
      basket(b, 0.07, 0.065);
      b.setInk('veg').setColor('#e07b2c');
      b.at(translation(-0.025, 0.065, 0), () => ball(b, 0.025, 0.02));
      b.setColor('#6aa84f');
      b.at(translation(0.025, 0.065, 0.01), () => ball(b, 0.028, 0.024));
      b.setColor('#b33d5a');
      b.at(translation(0, 0.07, -0.025), () => ball(b, 0.02, 0.018));
      break;
    case 'washing':
      basket(b, 0.08, 0.06, '#c9a46c');
      b.setInk('cloth').setColor(PALETTE.white).setPattern(PATTERN.cloth);
      b.at(translation(-0.02, 0.06, 0), () => ball(b, 0.045, 0.025));
      b.setColor('#8fb6e0');
      b.at(translation(0.03, 0.062, 0.01), () => ball(b, 0.035, 0.022));
      break;
    case 'sheaf':
      b.setInk('sheaf').setColor('#e3bf55').setPattern(PATTERN.thatch);
      b.lathe([[0, 0], [0.035, 0], [0.022, 0.07], [0.045, 0.16], [0, 0.17]], { segments: 7 });
      b.setInk('tie').setColor('#9b6a2f').setPattern(PATTERN.none);
      b.lathe([[0.026, 0.06], [0.025, 0.075]], { segments: 7 });
      break;
    case 'petals':
      basket(b, 0.05, 0.045, '#d8b07a');
      b.setInk('petals').setColor('#f4a6c1');
      b.at(translation(0, 0.045, 0), () => ball(b, 0.042, 0.018));
      break;
    case 'bouquet':
      b.setInk('stems').setColor('#5d8f3a');
      b.lathe([[0, 0], [0.012, 0], [0.025, 0.06], [0, 0.06]], { segments: 6 });
      b.setInk('flowers').setColor(PALETTE.white);
      b.at(translation(0, 0.065, 0), () => ball(b, 0.038, 0.026));
      b.setColor('#f4a6c1');
      b.at(translation(0.02, 0.08, 0.01), () => ball(b, 0.016, 0.014));
      break;
  }
}

/**
 * Where each load is held, in the figure's body frame (origin at the feet, +Z forward): against the chest
 * in both arms, on a shoulder, or hanging from the right hand at the side.
 */
const HOLD: Record<Load, Mat4Like> = {
  sack: translation(0, 0.1, 0.13),
  tray: translation(0, 0.2, 0.12),
  loaf: translation(0.03, 0.18, 0.1),
  bucket: translation(0.115, 0.02, 0.02),
  fish: translation(0, 0.14, 0.13),
  fishes: translation(0.115, 0.03, 0.03),
  ladder: translation(0.1, 0.32, 0.02),
  hod: translation(-0.09, 0.33, -0.01),
  crate: translation(0, 0.12, 0.13),
  lantern: translation(0.1, 0.36, 0.1),
  basket: translation(0, 0.15, 0.12),
  washing: translation(0, 0.14, 0.12),
  sheaf: translation(0, 0.11, 0.11),
  petals: translation(0.1, 0.1, 0.05),
  bouquet: translation(0, 0.16, 0.12),
};

/** Loads held at the side in one hand (the arms hang; the rest are hugged to the chest or shouldered). */
export const AT_SIDE: ReadonlySet<Load> = new Set<Load>(['bucket', 'fishes', 'petals']);
/** Loads carried on a shoulder (one arm up to steady it). */
export const ON_SHOULDER: ReadonlySet<Load> = new Set<Load>(['ladder', 'hod']);

const cache = new Map<string, MeshData>();

/** The load as carried: in the figure's body frame, at the hands (or shoulder). */
export function carriedMesh(kind: Load): MeshData {
  const k = `carried:${kind}`;
  let m = cache.get(k);
  if (!m) {
    const b = new MeshBuilder({ ink: `load-${kind}` });
    b.at(HOLD[kind], () => {
      if (kind === 'lantern') {
        // On a short pole held up before them.
        b.setInk('pole').setColor(PALETTE.trunk);
        tube(b, [[0, -0.2, 0], [0, 0.1, 0]], 0.005, { seg: 4 });
        b.at(translation(0, 0.02, 0), () => drawLoad(b, kind));
      } else drawLoad(b, kind);
    });
    cache.set(k, (m = b.build()));
  }
  return m;
}

/** The load set down: in world units, standing at the origin (scale it with the people's size). */
export function restingMesh(kind: Load): MeshData {
  const k = `rest:${kind}`;
  let m = cache.get(k);
  if (!m) {
    const b = new MeshBuilder({ ink: `rest-${kind}` });
    // The figure's units to the world's (PERSON.height ÷ DESIGN_HEIGHT, about 1.1).
    b.at([1.1, 0, 0, 0, 0, 1.1, 0, 0, 0, 0, 1.1, 0, 0, 0, 0, 1], () => {
      if (kind === 'ladder') {
        // Set down, a ladder leans against the wall ahead (+Z), its foot at the origin.
        const a = 1.2, h = 0.3 * BIG;
        b.at(multiply(translation(0, h * Math.sin(a), h * Math.cos(a)), rotationX(-a)), () => drawLoad(b, kind));
      } else drawLoad(b, kind);
    });
    cache.set(k, (m = b.build()));
  }
  return m;
}
