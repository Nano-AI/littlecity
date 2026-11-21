// L63 · the beach day's things: what a family carries down to the sand and
// sets up there, the sandcastle the children build, the ball they throw,
// and a bather out swimming. Meshes only; the beach chain
// (src/life/town/chains/beach.ts) places them, and loads.ts draws the
// carried ones in the hands.
//
// Built to read from the town view: the parasols are the beach's mark (a
// striped canopy well over head height, in strong colours), so a row of them
// along the shore says "beach day" before any person can be made out. Round
// things are soft bodies (src/gen/soft.ts): one outline, no facet lines.
//
// Units: the set-down things are in world units, standing at the origin,
// facing +Z (the sea). The carried ones are in the figure's units (loads.ts
// places them in the hands). Pure.

import { compose, rotationX, rotationY, rotationZ, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { smoothBall, smoothLathe, soft } from '@/gen/soft';
import { tube } from '@/parts/ground/kit';
import { PALETTE } from '@/style/palette';
import { BEACH_COLOURS } from '@/style/scenes';

/** How many colours of parasol and chair there are (each family's own, by its seed). */
export const CANVAS_COLOURS = BEACH_COLOURS.canvas.length;

const canvas = (i: number): string => BEACH_COLOURS.canvas[((i % CANVAS_COLOURS) + CANVAS_COLOURS) % CANVAS_COLOURS]!;

const cache = new Map<string, MeshData>();
function cached(key: string, build: () => MeshData): MeshData {
  let m = cache.get(key);
  if (!m) cache.set(key, (m = build()));
  return m;
}

/** The height of an open parasol's rim and apex over the sand, and its reach (world units). */
export const PARASOL = { rim: 0.6, apex: 0.78, radius: 0.42, gores: 8 } as const;

/** An open canopy (gores alternately coloured and white), about the origin, its rim `r` out, apex `rise` up. */
function canopy(b: MeshBuilder, colour: string, r: number, rise: number, gores: number): void {
  const step = (Math.PI * 2) / gores;
  b.setInk('canopy').setPattern(PATTERN.cloth);
  for (let i = 0; i < gores; i++) {
    b.setColor(i % 2 === 0 ? colour : PALETTE.white);
    // The top, and the underside (seen from a low camera, and so it is never see-through).
    b.lathe([[r, 0], [r * 0.55, rise * 0.62], [0, rise]], { segments: 2, start: i * step, sweep: step, smooth: false });
    b.lathe([[0, rise - 0.01], [r * 0.55, rise * 0.62 - 0.01], [r, -0.01]], { segments: 2, start: i * step, sweep: step, smooth: false });
  }
  // A valance: a short skirt round the rim, so the canopy has an edge from the side.
  b.setInk('valance').setPattern(PATTERN.none);
  for (let i = 0; i < gores; i++) {
    b.setColor(i % 2 === 0 ? PALETTE.white : colour);
    b.lathe([[r * 1.01, -0.035], [r * 1.01, 0.002]], { segments: 2, start: i * step, sweep: step, smooth: false });
    b.lathe([[r * 1.0, 0.002], [r * 1.0, -0.035]], { segments: 2, start: i * step, sweep: step, smooth: false });
  }
}

/**
 * A parasol planted in the sand and open: a pole, a striped canopy over head height tipped a little
 * toward the sea (+Z), a knob on top. World units, the pole's foot at the origin.
 */
export function parasolMesh(colour: number): MeshData {
  return cached(`parasol:${colour}`, () => {
    const b = new MeshBuilder({ ink: `beach-parasol-${colour}` });
    const tilt = 0.14;
    b.at(rotationX(tilt), () => {
      b.setInk('pole').setColor(PALETTE.white).setPattern(PATTERN.none);
      tube(b, [[0, -0.04, 0], [0, PARASOL.apex + 0.03, 0]], 0.012, { seg: 5 });
      b.at(translation(0, PARASOL.rim, 0), () => {
        b.setSway((x, _y, z) => Math.min(1, Math.hypot(x, z) / PARASOL.radius) * 0.18);
        canopy(b, canvas(colour), PARASOL.radius, PARASOL.apex - PARASOL.rim, PARASOL.gores);
        b.setSway(0);
      });
      b.setInk('knob').setColor(canvas(colour));
      smoothBall(b, 0, PARASOL.apex + 0.035, 0, 0.02, 0.02, 0.02, 6, 4);
    });
    return b.build();
  });
}

/** A deckchair, open: a wooden frame and a striped sling, facing +Z (the sea). World units, standing at the origin. */
export const DECKCHAIR = { seat: 0.085, width: 0.2 } as const;
export function deckchairMesh(colour: number): MeshData {
  return cached(`deckchair:${colour}`, () => {
    const b = new MeshBuilder({ ink: `beach-chair-${colour}` });
    const w = DECKCHAIR.width / 2;
    // The frame: two side rails from the front foot up and back to the top of the back, and the back legs.
    b.setInk('frame').setColor(PALETTE.wood).setPattern(PATTERN.none);
    for (const s of [-1, 1]) {
      const x = s * (w + 0.008);
      tube(b, [[x, 0, 0.13], [x, 0.11, 0.06], [x, 0.31, -0.13]], 0.008, { seg: 4 });
      tube(b, [[x, 0, -0.08], [x, 0.12, 0.0]], 0.008, { seg: 4 });
    }
    tube(b, [[-w - 0.01, 0.31, -0.13], [w + 0.01, 0.31, -0.13]], 0.007, { seg: 4 });
    // The sling: three stripes along its length (colour, white, colour), sagging a little at the seat.
    const path: [number, number][] = [[0.11, 0.1], [0.05, 0.075], [-0.02, 0.09], [-0.12, 0.3]];
    const bands: [number, number, string][] = [[-w, -w / 3, canvas(colour)], [-w / 3, w / 3, PALETTE.white], [w / 3, w, canvas(colour)]];
    b.setInk('sling').setPattern(PATTERN.cloth);
    for (const [x0, x1, c] of bands) {
      b.setColor(c);
      for (let i = 0; i + 1 < path.length; i++) {
        const [z0, y0] = path[i]!, [z1, y1] = path[i + 1]!;
        // Up face (the sitting side) and under face.
        b.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1]);
        b.quad([x0, y1 - 0.006, z1], [x1, y1 - 0.006, z1], [x1, y0 - 0.006, z0], [x0, y0 - 0.006, z0]);
      }
    }
    return b.build();
  });
}

/** A towel laid on the sand: a long rectangle with bands across it, its long side along Z. World units. */
export function towelMesh(colour: number): MeshData {
  return cached(`towel:${colour}`, () => {
    const b = new MeshBuilder({ ink: `beach-towel-${colour}` });
    const T = BEACH_COLOURS.towels;
    const c = T[((colour % T.length) + T.length) % T.length]!;
    const w = 0.12, l = 0.25, y = 0.012;
    b.setInk('towel').setPattern(PATTERN.cloth);
    // Five bands: colour, white, colour, white, colour; the ends a little longer.
    const cuts = [-l, -l * 0.62, -l * 0.5, l * 0.5, l * 0.62, l];
    for (let i = 0; i + 1 < cuts.length; i++) {
      b.setColor(i % 2 === 0 ? c : PALETTE.white);
      b.box([-w, 0, cuts[i]!], [w, y, cuts[i + 1]!], { skip: ['bottom', ...(i > 0 ? (['n'] as const) : []), ...(i + 2 < cuts.length ? (['s'] as const) : [])] });
    }
    return b.build();
  });
}

/** A basket for the day, with a lid and a handle over it. World units at the origin (set down). */
export function hamperMesh(scale = 1): MeshData {
  return cached(`hamper:${scale}`, () => {
    const b = new MeshBuilder({ ink: 'beach-hamper' });
    b.at([scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1], () => drawHamper(b));
    return b.build();
  });
}

function drawHamper(b: MeshBuilder): void {
  b.setInk('basket').setColor('#c9955a').setPattern(PATTERN.thatch);
  b.box([-0.07, 0, -0.045], [0.07, 0.07, 0.045], { skip: ['bottom'] });
  b.setInk('lid').setColor('#b47f48').setPattern(PATTERN.none);
  b.box([-0.075, 0.07, -0.05], [0.075, 0.082, 0.05], { skip: ['bottom'] });
  b.setInk('handle').setColor(PALETTE.trunk);
  tube(b, [[-0.05, 0.08, 0], [-0.04, 0.13, 0], [0.04, 0.13, 0], [0.05, 0.08, 0]], 0.006, { seg: 4 });
  // A towel folded over the lid's edge.
  b.setInk('towel-edge').setColor(BEACH_COLOURS.towels[1]!).setPattern(PATTERN.cloth);
  b.box([0.02, 0.082, -0.052], [0.06, 0.09, 0.052]);
  b.box([0.02, 0.03, 0.05], [0.06, 0.09, 0.058]);
}

/** A child's pail with a spade stuck in it. World units, standing at the origin. */
export function pailMesh(colour: number): MeshData {
  return cached(`pail:${colour}`, () => {
    const b = new MeshBuilder({ ink: `beach-pail-${colour}` });
    drawPail(b, colour);
    return b.build();
  });
}

function drawPail(b: MeshBuilder, colour: number): void {
  const P = BEACH_COLOURS.pail;
  b.setInk('pail').setColor(P[((colour % P.length) + P.length) % P.length]!).setPattern(PATTERN.none);
  b.lathe([[0, 0], [0.034, 0], [0.045, 0.07], [0.041, 0.07], [0.031, 0.006], [0, 0.006]], { segments: 10 });
  b.setInk('pail-handle').setColor(PALETTE.metal);
  tube(b, [[-0.044, 0.068, 0], [-0.025, 0.1, 0], [0.025, 0.1, 0], [0.044, 0.068, 0]], 0.003, { seg: 3 });
  // The spade, stuck in at a slant.
  b.at(compose(translation(0.012, 0.03, 0.005), rotationZ(-0.35)), () => {
    b.setInk('spade').setColor(PALETTE.wood);
    tube(b, [[0, 0, 0], [0, 0.12, 0]], 0.0045, { seg: 4 });
    b.setColor(PALETTE.yellow);
    b.box([-0.016, -0.025, -0.004], [0.016, 0.012, 0.004]);
  });
}

/** A beach ball: soft, in four coloured gores. Radius `r`, centred on the origin. */
export function ballMesh(r = 0.06): MeshData {
  return cached(`ball:${r}`, () => {
    const b = new MeshBuilder({ ink: 'beach-ball' });
    drawBall(b, r);
    return b.build();
  });
}

function drawBall(b: MeshBuilder, r: number): void {
  const prof: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (1 - i / 6);
    prof.push([Math.max(0, Math.sin(a) * r), Math.cos(a) * r]);
  }
  b.setInk('ball').setPattern(PATTERN.none);
  const C = BEACH_COLOURS.ball;
  for (let i = 0; i < 6; i++) {
    b.setColor(C[i % C.length]!);
    smoothLathe(b, prof, { segments: 2, start: (i * Math.PI) / 3, sweep: Math.PI / 3, crease: 1.4 });
  }
}

/**
 * A sandcastle, at a stage of building (1 a heap, 2 a keep, 3 with two towers, 4 with a moat and a flag)
 * or of being taken by the sea (−1 slumped). World units, standing at the origin.
 */
export type CastleStage = 1 | 2 | 3 | 4 | -1;
export function castleMesh(stage: CastleStage): MeshData {
  return cached(`castle:${stage}`, () => {
    const b = new MeshBuilder({ ink: `beach-castle-${stage}` });
    const sand = BEACH_COLOURS.castle;
    // A tower turned out of a bucket: wider at the foot, a flat top with a rim.
    const tower = (x: number, z: number, r: number, h: number): void => {
      b.at(translation(x, 0, z), () => b.lathe([[r, 0], [r * 0.84, h], [r * 0.6, h], [0, h]], { segments: 8 }));
    };
    b.setInk('castle').setColor(sand).setPattern(PATTERN.sand);
    if (stage === 1) {
      smoothLathe(b, [[0.1, 0], [0.085, 0.025], [0.05, 0.05], [0, 0.058]], { segments: 10 });
    } else if (stage === -1) {
      // Slumped: a low heap with a lump or two where the towers were.
      smoothLathe(b, [[0.12, 0], [0.1, 0.02], [0.05, 0.035], [0, 0.04]], { segments: 10 });
      b.setInk('lumps');
      smoothBall(b, 0.04, 0.03, 0.02, 0.035, 0.025, 0.035, 7, 4);
      smoothBall(b, -0.05, 0.025, -0.01, 0.03, 0.02, 0.03, 7, 4);
    } else {
      // A mound under it all, then the keep.
      smoothLathe(b, [[0.13, 0], [0.11, 0.02], [0.08, 0.03], [0, 0.032]], { segments: 10 });
      b.setInk('keep');
      tower(0, 0, 0.055, 0.105);
      if (stage >= 3) {
        b.setInk('towers');
        tower(-0.08, 0.04, 0.035, 0.075);
        tower(0.08, 0.04, 0.035, 0.075);
      }
      if (stage >= 4) {
        // The moat: a ring of darker damp sand round it.
        b.setInk('moat').setColor(BEACH_COLOURS.castleDark).setPattern(PATTERN.none);
        b.lathe([[0.165, 0.004], [0.14, 0.004]], { segments: 14 });
        b.setInk('flagpole').setColor(PALETTE.wood);
        tube(b, [[0, 0.1, 0], [0, 0.2, 0]], 0.004, { seg: 3 });
        b.setInk('flag').setColor(BEACH_COLOURS.flag).setSway(0.8);
        b.polygon([[0, 0.2, 0], [0, 0.165, 0], [0.06, 0.18, 0.004]]);
        b.polygon([[0, 0.165, 0], [0, 0.2, 0], [0.06, 0.18, -0.004]]);
        b.setSway(0);
      }
    }
    return b.build();
  });
}

/**
 * A bather in the water: shoulders in their costume, the head (hair, or a bathing cap), and one arm over
 * the water reaching forward (two drawings, `stroke` 0 or 1). Facing +Z; y = 0 is the water's surface.
 */
export function swimmerMesh(skin: string, hair: string, costume: string, cap: string | null, stroke: number): MeshData {
  return cached(`swimmer:${skin}:${hair}:${costume}:${cap}:${stroke & 1}`, () => {
    const b = new MeshBuilder({ ink: 'beach-swimmer' });
    b.setPattern(PATTERN.none);
    soft(b, { ink: 'swimmer' }, (s) => {
      s.b.setColor(costume);
      s.ball(0, 0.0, -0.01, 0.075, 0.035, 0.055, 9, 4);
      s.b.setColor(skin);
      s.ball(0, 0.07, 0.01, 0.046, 0.05, 0.046, 10, 5);
      s.b.setColor(cap ?? hair);
      s.at(compose(translation(0, 0.07, 0.01), rotationX(-0.5), translation(0, -0.07, -0.01)), () => s.b.lathe([[0.048, 0.075], [0.04, 0.1], [0.02, 0.118], [0, 0.122]], { segments: 10 }));
    });
    const side = stroke & 1 ? 1 : -1;
    b.setInk('arm').setColor(skin);
    tube(b, [[side * 0.06, 0.01, 0.0], [side * 0.07, 0.05, 0.08], [side * 0.06, 0.03, 0.15]], 0.016, { seg: 5 });
    return b.build();
  });
}

/** A straw sun hat lying on its crown's top (over a sleeper's face), world units: the brim flat at y = 0. */
export function hatMesh(colour: string, band: string): MeshData {
  return cached(`hat:${colour}:${band}`, () => {
    const b = new MeshBuilder({ ink: 'beach-hat' });
    drawSunHat(b, colour, band, 0.05);
    return b.build();
  });
}

/** A wide sun hat about the origin: brim radius 2.1 × `r`, the crown on it. */
export function drawSunHat(b: MeshBuilder, colour: string, band: string, r: number): void {
  b.setInk('sunhat').setColor(colour).setPattern(PATTERN.thatch);
  smoothLathe(b, [[r * 2.1, 0], [r * 2.1, 0.008], [r * 1.0, 0.014], [r * 0.92, r * 0.62], [0, r * 0.72]], { segments: 12, crease: 0.9 });
  b.lathe([[0, 0], [r * 2.1, 0]], { segments: 12 });
  b.setInk('sunhat-band').setColor(band).setPattern(PATTERN.none);
  b.lathe([[r * 1.0, 0.014], [r * 0.97, r * 0.26]], { segments: 12 });
}

// ── carried, in the figure's units (loads.ts places them) ──────────────────

/** A furled parasol with a rolled towel tied round its foot: lying along +Z from its foot at the origin. */
export function drawFurledParasol(b: MeshBuilder, colour: number): void {
  b.at(rotationX(Math.PI / 2), () => {
    // Along +Y here, which the turn lays along +Z.
    b.setInk('pole').setColor(PALETTE.white).setPattern(PATTERN.none);
    tube(b, [[0, 0, 0], [0, 0.62, 0]], 0.008, { seg: 4 });
    b.setInk('furled').setColor(canvas(colour)).setPattern(PATTERN.cloth);
    smoothLathe(b, [[0.012, 0.28], [0.034, 0.36], [0.03, 0.5], [0.01, 0.6]], { segments: 8 });
    b.setInk('tie').setColor(PALETTE.white).setPattern(PATTERN.none);
    b.lathe([[0.035, 0.4], [0.035, 0.42]], { segments: 8 });
    // The rolled towel, strapped on low down.
    const T = BEACH_COLOURS.towels;
    b.setInk('roll').setColor(T[((colour % T.length) + T.length) % T.length]!).setPattern(PATTERN.cloth);
    b.at(translation(0.03, 0.12, 0), () => b.at(rotationZ(Math.PI / 2), () => b.lathe([[0.03, -0.05], [0.03, 0.05]], { segments: 8, capBottom: true, capTop: true })));
  });
}

/** A folded deckchair: the frame and the sling flat together, standing on its end along +Z. */
export function drawFoldedChair(b: MeshBuilder, colour: number): void {
  b.setInk('frame').setColor(PALETTE.wood).setPattern(PATTERN.none);
  b.box([-0.012, -0.11, -0.18], [0.012, 0.11, -0.16]);
  b.box([-0.012, -0.11, 0.16], [0.012, 0.11, 0.18]);
  for (const y of [-0.11, 0.1]) b.box([-0.012, y, -0.16], [0.012, y + 0.012, 0.16]);
  b.setInk('sling').setPattern(PATTERN.cloth);
  const bands: [number, number, string][] = [[-0.1, -0.035, canvas(colour)], [-0.035, 0.035, PALETTE.white], [0.035, 0.1, canvas(colour)]];
  for (const [y0, y1, c] of bands) {
    b.setColor(c);
    b.box([-0.008, y0, -0.16], [0.008, y1, 0.16], { only: ['e', 'w'] });
  }
}

/** A pail and spade, carried (figure units, at the origin). */
export function drawCarriedPail(b: MeshBuilder, colour: number): void {
  b.at([1.25, 0, 0, 0, 0, 1.25, 0, 0, 0, 0, 1.25, 0, 0, 0, 0, 1], () => drawPail(b, colour));
}

/** The basket, carried. */
export function drawCarriedHamper(b: MeshBuilder): void {
  b.at([1.1, 0, 0, 0, 0, 1.1, 0, 0, 0, 0, 1.1, 0, 0, 0, 0, 1], () => drawHamper(b));
}

/** The ball, carried in both hands. */
export function drawCarriedBall(b: MeshBuilder): void {
  drawBall(b, 0.055);
}

/** A parasol held up open as an umbrella in the rain (figure units, the hand at the origin, the canopy above). */
export function drawOpenParasolHeld(b: MeshBuilder, colour: number): void {
  b.setInk('pole').setColor(PALETTE.white).setPattern(PATTERN.none);
  tube(b, [[0, -0.06, 0], [0, 0.3, 0]], 0.007, { seg: 4 });
  b.at(compose(translation(0, 0.24, 0), rotationY(0.2)), () => canopy(b, canvas(colour), 0.25, 0.09, PARASOL.gores));
}

/** Where the hands hold the book (body frame, figure units): right, left. */
export const BOOK_GRIPS: readonly [[number, number, number], [number, number, number]] = [[0.045, 0.205, 0.072], [-0.045, 0.205, 0.072]];

/** A spade in the right fist (arm frame: the hand is at the end of the arm, down −Y), its blade in the sand ahead. */
export function drawSpade(b: MeshBuilder): void {
  b.setInk('spade').setColor(PALETTE.wood).setPattern(PATTERN.none);
  tube(b, [[0, -0.07, 0.0], [0, -0.17, 0.035]], 0.0055, { seg: 4 });
  b.setColor(PALETTE.yellow);
  b.box([-0.02, -0.215, 0.03], [0.02, -0.165, 0.042]);
}

/** A book held open in both hands (body frame, figure units), for reading in a deckchair. */
export function bookMesh(colour: number): MeshData {
  return cached(`book:${colour}`, () => {
    const b = new MeshBuilder({ ink: `beach-book-${colour}` });
    const C = BEACH_COLOURS.book;
    b.at(compose(translation(0, 0.215, 0.08), rotationX(-0.75)), () => {
      b.setInk('cover').setColor(C[((colour % C.length) + C.length) % C.length]!).setPattern(PATTERN.none);
      b.at(rotationY(0.35), () => b.box([-0.05, -0.035, -0.002], [0, 0.035, 0.002]));
      b.at(rotationY(-0.35), () => b.box([0, -0.035, -0.002], [0.05, 0.035, 0.002]));
      b.setInk('pages').setColor(PALETTE.white);
      b.at(rotationY(0.35), () => b.box([-0.046, -0.031, 0.002], [0, 0.031, 0.008]));
      b.at(rotationY(-0.35), () => b.box([0, -0.031, 0.002], [0.046, 0.031, 0.008]));
    });
    return b.build();
  });
}

/**
 * The ice-cream cart (figure units, as loads.ts draws carts: its handles toward −Z where whoever pushes it
 * stands, on two wheels): a white box with a pink lid and two tubs, and a striped umbrella over it.
 */
export function drawIceCart(b: MeshBuilder): void {
  b.at(translation(0, 0, 0.36), () => {
    b.setInk('cart-box').setColor(PALETTE.white).setPattern(PATTERN.planks);
    b.box([-0.12, 0.07, -0.1], [0.12, 0.19, 0.12]);
    b.setInk('cart-lid').setColor(BEACH_COLOURS.icecream[0]!).setPattern(PATTERN.none);
    b.box([-0.125, 0.19, -0.105], [0.125, 0.205, 0.125]);
    b.setInk('tubs').setColor(BEACH_COLOURS.icecream[1]!);
    for (const x of [-0.05, 0.05]) b.at(translation(x, 0.205, 0.02), () => smoothBall(b, 0, 0, 0, 0.032, 0.022, 0.032, 8, 4));
    b.setInk('wheels').setColor(PALETTE.metal);
    for (const x of [-0.135, 0.135]) b.at(translation(x, 0.065, 0.0), () => b.at([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], () => b.lathe([[0, -0.01], [0.065, -0.01], [0.065, 0.01], [0, 0.01]], { segments: 10 })));
    b.setInk('handles').setColor(PALETTE.trunk);
    for (const x of [-0.09, 0.09]) tube(b, [[x, 0.15, -0.1], [x, 0.18, -0.25]], 0.007, { seg: 4 });
    b.setInk('brolly-pole').setColor(PALETTE.white);
    tube(b, [[0.1, 0.19, 0.1], [0.1, 0.52, 0.1]], 0.006, { seg: 4 });
    b.at(translation(0.1, 0.48, 0.1), () => canopy(b, BEACH_COLOURS.icecream[0]!, 0.24, 0.08, 8));
  });
}

/** An ice-cream cone held up (figure units, about the origin): a wafer cone and a pink scoop. */
export function drawCone(b: MeshBuilder): void {
  b.setInk('cone').setColor('#e2b06a').setPattern(PATTERN.none);
  b.lathe([[0, -0.05], [0.022, 0.01], [0.02, 0.012]], { segments: 8 });
  soft(b, { ink: 'scoop' }, (s) => {
    s.b.setColor(BEACH_COLOURS.icecream[2]!);
    s.ball(0, 0.03, 0, 0.026, 0.024, 0.026, 8, 5);
  });
}
