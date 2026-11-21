// Wedding finery (L57): what everybody in a wedding party wears, drawn over
// the little person (person.ts) without touching how a person is built.
//
// Two halves:
//   fineryLook   the clothes' colours on the person's own look (the bride's
//                white, the groom's black), and their own hat taken off
//   fineryMesh   what is added on top, in the body piece's frame (origin at
//                the feet, +Y up, facing +Z, figure units): the top hat, the
//                bride's veil and train and full skirt, the white shirt front
//                of a black coat, wreaths, picture hats, the priest's collar.
//                people.system.ts places it with the body's matrix.
//
// The party reads from far off as a block of black and white: the groom, the
// best man and the ushers in black with top hats; the bride, the bridesmaids
// and the flower children in white; the guests in their best, in white or
// dark, each with a hat, a wreath or a flower so they visibly belong.
// Pure.

import { rand } from '@/core/rand';
import { compose, rotationX, scaling, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { FINERY } from '@/style/town-life';
import type { Look, Rig } from './person';

/** Who somebody is at a wedding. */
export type Finery = 'bride' | 'groom' | 'usher' | 'maid' | 'flower' | 'guest' | 'priest';

export const FINERIES: readonly Finery[] = ['bride', 'groom', 'usher', 'maid', 'flower', 'guest', 'priest'];

export function isFinery(c: string | null | undefined): c is Finery {
  return c !== null && c !== undefined && (FINERIES as readonly string[]).includes(c);
}

const pick = <T>(xs: readonly T[], r: number): T => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))]!;

/** A guest in their best: in white (or a pale dress) or in a dark suit, by their own seed. */
export function guestInWhite(look: Look, id: string): boolean {
  return look.dress ? rand(0, id, 'wed-white') < 0.85 : rand(0, id, 'wed-white') < 0.2;
}

/** The colours of the clothes, on the person's own look (skin, hair and size stay their own). */
export function fineryLook(base: Look, f: Finery, id: string): Look {
  const r = (k: string): number => rand(0, id, 'finery', k);
  switch (f) {
    case 'bride':
      return { ...base, top: FINERY.white, bottom: FINERY.white, dress: true, hat: 'none', hairStyle: base.hairStyle === 'bald' ? 'bun' : base.hairStyle === 'short' ? 'bun' : base.hairStyle, girth: base.girth * 1.06 };
    case 'groom':
    case 'usher':
      return { ...base, top: FINERY.black, bottom: FINERY.black, dress: false, hat: 'none' };
    case 'priest':
      return { ...base, top: FINERY.black, bottom: FINERY.black, dress: true, hat: 'none' };
    case 'maid':
      return { ...base, top: pick(FINERY.pale, r('maid')), bottom: FINERY.white, dress: true, hat: 'none' };
    case 'flower':
      return { ...base, top: FINERY.white, bottom: base.dress ? FINERY.white : FINERY.black, hat: 'none' };
    case 'guest': {
      if (guestInWhite(base, id)) return { ...base, top: pick(FINERY.pale, r('guest')), bottom: base.dress ? FINERY.white : FINERY.grey, hat: 'none' };
      return { ...base, top: pick(FINERY.dark, r('suit')), bottom: FINERY.black, dress: false, hat: 'none' };
    }
  }
}

/** Points of a ball's profile for `lathe`, bottom to top. */
function ball(b: MeshBuilder, x: number, y: number, z: number, rx: number, ry: number, segs = 6): void {
  const prof: [number, number][] = [];
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI * (1 - i / 4);
    prof.push([Math.max(0, Math.sin(a) * rx), Math.cos(a) * ry]);
  }
  b.at(translation(x, y, z), () => b.lathe(prof, { segments: segs }));
}

/** A tall black top hat with a ribbon band, sitting a little back on the head. */
function topHat(b: MeshBuilder, rig: Rig, colour: string, band: string): void {
  const r = rig.head, cy = rig.headY;
  const y = cy + r * 0.55;
  b.at(compose(translation(0, cy, 0), rotationX(-0.12), translation(0, -cy, 0)), () => {
    b.setInk('hat').setColor(colour);
    // Brim, crown (a little wider at the top), flat lid.
    b.lathe([[r * 1.42, y - 0.004], [r * 1.46, y + 0.008], [r * 0.82, y + 0.012]], { segments: 10, capBottom: true });
    b.lathe([[r * 0.82, y + 0.012], [r * 0.8, y + r * 0.5], [r * 0.86, y + r * 1.45], [0, y + r * 1.45]], { segments: 10 });
    b.setColor(band);
    b.lathe([[r * 0.835, y + 0.014], [r * 0.83, y + r * 0.36]], { segments: 10 });
  });
}

/** A round hat with a low crown (a bowler), for a guest in a dark suit. */
function bowler(b: MeshBuilder, rig: Rig, colour: string): void {
  const r = rig.head, cy = rig.headY;
  const y = cy + r * 0.45;
  b.at(compose(translation(0, cy, 0), rotationX(-0.14), translation(0, -cy, 0)), () => {
    b.setInk('hat').setColor(colour);
    b.lathe([[r * 1.3, y - 0.002], [r * 1.32, y + 0.008], [r * 0.95, y + 0.012], [r * 0.98, y + r * 0.5], [r * 0.6, y + r * 0.95], [0, y + r * 1.02]], { segments: 10, capBottom: true });
  });
}

/** A wide-brimmed summer hat with a flower on it. */
function pictureHat(b: MeshBuilder, rig: Rig, colour: string, flower: string): void {
  const r = rig.head, cy = rig.headY;
  const y = cy + r * 0.5;
  b.at(compose(translation(0, cy, 0), rotationX(-0.2), translation(0, -cy, 0)), () => {
    b.setInk('hat').setColor(colour);
    b.lathe([[r * 2.0, y - 0.006], [r * 2.02, y + 0.004], [r * 0.95, y + 0.014], [r * 0.85, y + r * 0.62], [0, y + r * 0.7]], { segments: 12, capBottom: true });
    b.setInk('flower').setColor(flower);
    ball(b, r * 0.72, y + r * 0.34, r * 0.5, r * 0.42, r * 0.36);
  });
}

/** A ring of small flowers round the head. */
function wreath(b: MeshBuilder, rig: Rig, colours: readonly string[], size = 1): void {
  const r = rig.head, cy = rig.headY;
  b.setInk('wreath');
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.setColor(colours[i % colours.length]!);
    // Round the crown, tipped back a little, the front a touch lower.
    const x = Math.sin(a) * r * 0.92, z = Math.cos(a) * r * 0.92 - r * 0.12;
    ball(b, x, cy + r * 0.62 + (Math.cos(a) < 0 ? r * 0.08 : 0), z, r * 0.3 * size, r * 0.26 * size, 5);
  }
}

/** The white shirt front, collar and tie of a black coat: a white V on the chest. */
function shirtFront(b: MeshBuilder, look: Look, rig: Rig, tie: string, flower: string | null): void {
  const g = look.girth;
  const zf = 0.057 * 0.8 + 0.003;
  b.setInk('shirt').setColor(FINERY.white);
  // A wedge, wide at the collar, to a point at the waist.
  const top = rig.shoulderY + 0.01, low = 0.175;
  b.polygon([[-0.026 * g, top, zf - 0.006], [0, low, zf], [0.026 * g, top, zf - 0.006]]);
  b.polygon([[0.026 * g, top, zf - 0.006], [0, low, zf], [-0.026 * g, top, zf - 0.006]]);
  b.setInk('tie').setColor(tie);
  b.box([-0.012, top - 0.022, zf - 0.002], [0.012, top - 0.008, zf + 0.008]);
  if (flower) {
    b.setInk('buttonhole').setColor(flower);
    ball(b, 0.034 * g, top - 0.03, zf + 0.002, 0.014, 0.014, 5);
  }
}

/** Coat tails behind, from the waist to the knee. */
function tails(b: MeshBuilder, look: Look): void {
  const g = look.girth;
  b.setInk('coat').setColor(FINERY.black);
  const zb = -0.057 * 0.8 + 0.004;
  for (const s of [-1, 1]) {
    b.box([s > 0 ? 0.002 : -0.034 * g, 0.06, zb - 0.014], [s > 0 ? 0.034 * g : -0.002, 0.16, zb + 0.004]);
  }
}

/** A full skirt to the ground over the legs (a gown), and for the bride a train behind. */
function skirt(b: MeshBuilder, look: Look, colour: string, train: boolean): void {
  const g = look.girth;
  b.setInk('gown').setColor(colour).setPattern(PATTERN.none);
  b.at(scaling(g, 1, 0.85), () => {
    b.lathe([[0.112, 0.004], [0.104, 0.03], [0.084, 0.09], [0.064, 0.15], [0.058, 0.17]], { segments: 12, capBottom: true });
  });
  if (train) {
    // Lying on the ground behind her, widening to its end.
    b.polygon([[-0.07 * g, 0.006, -0.06], [-0.11 * g, 0.004, -0.3], [0.11 * g, 0.004, -0.3], [0.07 * g, 0.006, -0.06]]);
    b.polygon([[0.07 * g, 0.006, -0.06], [0.11 * g, 0.004, -0.3], [-0.11 * g, 0.004, -0.3], [-0.07 * g, 0.006, -0.06]]);
    b.lathe([[0.11, 0.004], [0.11, 0.016]], { segments: 6, start: Math.PI * 0.75, sweep: Math.PI * 0.5 });
  }
}

/** The bride's veil: from a small crown of flowers, down the back of the head and shoulders to the waist. */
function veil(b: MeshBuilder, rig: Rig): void {
  const r = rig.head, cy = rig.headY;
  b.setInk('veil').setColor(FINERY.veil);
  b.lathe(
    [
      [r * 0.6, 0.1],
      [r * 1.25, rig.shoulderY - 0.02],
      [r * 1.2, cy - r * 0.1],
      [r * 1.12, cy + r * 0.5],
      [r * 0.7, cy + r * 1.02],
    ],
    { segments: 10, start: Math.PI * 0.62, sweep: Math.PI * 0.76 },
  );
  b.lathe([[r * 0.7, cy + r * 1.02], [r * 0.7, cy + r * 0.5], [r * 1.12, cy + r * 0.5]], { segments: 10, start: Math.PI * 0.62, sweep: Math.PI * 0.76 });
}

/** The priest's white collar. */
function collar(b: MeshBuilder, rig: Rig): void {
  b.setInk('collar').setColor(FINERY.white);
  b.lathe([[0.034, rig.shoulderY + 0.022], [0.032, rig.shoulderY + 0.04]], { segments: 10 });
}

/** A sash round the waist, tied with a bow at the back. */
function sash(b: MeshBuilder, look: Look, colour: string): void {
  const g = look.girth;
  b.setInk('sash').setColor(colour);
  b.at(scaling(g, 1, 0.8), () => b.lathe([[0.066, 0.13], [0.064, 0.16]], { segments: 10 }));
  ball(b, 0, 0.15, -0.06, 0.024, 0.018, 5);
}

/**
 * What is drawn over a person in their finery, in the body piece's frame (figure units), or null.
 * `ink` namespaces the ink groups as buildPerson's does: pass the person's id.
 */
export function fineryMesh(look: Look, rig: Rig, f: Finery, id: string): MeshData | null {
  const b = new MeshBuilder({ ink: `${id}:finery` });
  b.setPattern(PATTERN.none);
  const r = (k: string): number => rand(0, id, 'finery', k);
  switch (f) {
    case 'bride':
      skirt(b, look, FINERY.white, true);
      veil(b, rig);
      wreath(b, rig, [FINERY.white, FINERY.rose, FINERY.white], 0.9);
      break;
    case 'groom':
      shirtFront(b, look, rig, FINERY.white, FINERY.rose);
      tails(b, look);
      topHat(b, rig, FINERY.black, FINERY.grey);
      break;
    case 'usher':
      shirtFront(b, look, rig, pick(FINERY.ties, r('tie')), FINERY.white);
      if (r('hat') < 0.6) topHat(b, rig, FINERY.black, FINERY.black);
      break;
    case 'priest':
      skirt(b, look, FINERY.black, false);
      collar(b, rig);
      break;
    case 'maid':
      skirt(b, look, look.top, false);
      wreath(b, rig, [FINERY.rose, FINERY.white, FINERY.pink]);
      break;
    case 'flower':
      if (look.dress) skirt(b, look, FINERY.white, false);
      sash(b, look, FINERY.rose);
      wreath(b, rig, [FINERY.pink, FINERY.white, FINERY.rose], 1.1);
      break;
    case 'guest':
      if (!FINERY.dark.includes(look.top)) {
        if (look.dress) skirt(b, look, look.top, false);
        if (r('hat') < 0.75) pictureHat(b, rig, pick(FINERY.hats, r('hat-colour')), pick([FINERY.rose, FINERY.pink, FINERY.yellow], r('flower')));
        else wreath(b, rig, [FINERY.pink, FINERY.white]);
      } else {
        shirtFront(b, look, rig, pick(FINERY.ties, r('tie')), r('flower') < 0.7 ? FINERY.white : FINERY.rose);
        if (r('hat') < 0.55) bowler(b, rig, FINERY.black);
        else if (r('hat') < 0.8) topHat(b, rig, FINERY.grey, FINERY.black);
      }
      break;
  }
  const out = b.build();
  return out.position.length > 0 ? out : null;
}
