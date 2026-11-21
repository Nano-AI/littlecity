// L63 · dressed for the beach, drawn over the little person (person.ts) the
// way the wedding's finery is (finery.ts), without touching how a person is
// built:
//
//   beachLook   the clothes' colours on the person's own look: a bathing
//               costume (knee length, bare legs) in a strong colour, or for
//               some grown-ups a white shirt and pale rolled-up trousers;
//               their own hat off
//   beachMesh   what is added on top, in the body piece's frame (origin at
//               the feet, +Y up, facing +Z, figure units): the white bands of
//               a striped costume, a wide straw sun hat; for a sleeper the
//               hat tipped over the face; running home in the rain, a towel
//               held over the head and shoulders
//
// Each person's colours and hat come from their own id, so they are the same
// every time they go to the beach. Pure.

import { rand } from '@/core/rand';
import { compose, rotationX, scaling, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { smoothLathe } from '@/gen/soft';
import { PALETTE } from '@/style/palette';
import { BEACH_COLOURS } from '@/style/scenes';
import { drawSunHat } from './beach';
import type { Look, Rig } from './person';

/** Dressed for the beach; with the sun hat over the face (asleep); with a towel over the head (running from the rain). */
export type BeachWear = 'bather' | 'bather-face' | 'bather-towel';
export const BEACHWEAR: readonly BeachWear[] = ['bather', 'bather-face', 'bather-towel'];

export function isBeachWear(c: string | null | undefined): c is BeachWear {
  return c === 'bather' || c === 'bather-face' || c === 'bather-towel';
}

const pick = <T>(xs: readonly T[], r: number): T => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))]!;

/** In a bathing costume (else a white shirt and rolled trousers: some grown-ups only paddle). */
export function inCostume(look: Look, id: string): boolean {
  return look.child || rand(0, id, 'beach-costume') < 0.72;
}
/** Wears a sun hat. */
export function sunHat(look: Look, id: string): boolean {
  return rand(0, id, 'beach-hat') < (look.child ? 0.4 : 0.62);
}
/** The colour of their costume (or towel). */
export function costumeColour(id: string): string {
  return pick(BEACH_COLOURS.costumes, rand(0, id, 'beach-colour'));
}
export function towelColour(id: string): string {
  return pick(BEACH_COLOURS.towels, rand(0, id, 'beach-towel'));
}

/** The colours of beach clothes, on the person's own look (skin, hair and size stay their own). */
export function beachLook(base: Look, _wear: BeachWear, id: string): Look {
  if (inCostume(base, id)) {
    const c = costumeColour(id);
    return { ...base, top: c, bottom: c, dress: true, hat: 'none' };
  }
  return { ...base, top: PALETTE.white, bottom: '#e8d7b0', dress: false, hat: 'none' };
}

/** White bands round a striped costume (two on the body, one at the hem). */
function stripes(b: MeshBuilder, look: Look): void {
  const g = look.girth;
  b.setInk('stripes').setColor(PALETTE.white).setPattern(PATTERN.none);
  b.at(scaling(g, 1, 0.8), () => {
    // Just proud of the body's own surface (person.ts: the dress profile), so they never share its plane.
    b.lathe([[0.0602, 0.205], [0.0582, 0.222]], { segments: 10 });
    b.lathe([[0.0718, 0.135], [0.068, 0.152]], { segments: 10 });
    b.lathe([[0.0835, 0.066], [0.0832, 0.082]], { segments: 10 });
  });
}

/** A towel over the head and down over the shoulders, open at the face; the hands hold it at the front (they need not: it hangs). */
function towelHood(b: MeshBuilder, rig: Rig, colour: string): void {
  const r = rig.head, cy = rig.headY;
  b.setInk('towel').setColor(colour).setPattern(PATTERN.cloth);
  // Round the back and sides, from the top of the head down to below the shoulders.
  const prof: [number, number][] = [[0.085, rig.shoulderY - 0.05], [0.08, rig.shoulderY + 0.005], [r * 1.25, cy - r * 0.2], [r * 1.18, cy + r * 0.55], [r * 0.7, cy + r * 1.12], [0, cy + r * 1.22]];
  smoothLathe(b, prof, { segments: 12, start: Math.PI * 0.62, sweep: Math.PI * 1.76, crease: 1.2 });
  // Its inside (seen through the opening at the front).
  b.lathe([...prof].reverse().map(([x, y]) => [Math.max(0, x - 0.004), y] as [number, number]), { segments: 12, start: Math.PI * 0.62, sweep: Math.PI * 1.76 });
}

/**
 * What is drawn over a person dressed for the beach, in the body piece's frame (figure units), or null.
 * `id` is the person's id (their colours and hat), and namespaces the ink.
 */
export function beachMesh(look: Look, rig: Rig, wear: BeachWear, id: string): MeshData | null {
  const b = new MeshBuilder({ ink: `${id}:beach` });
  b.setPattern(PATTERN.none);
  const costume = inCostume(look, id);
  if (costume && look.dress) stripes(b, look);
  const hat = pick(BEACH_COLOURS.hats, rand(0, id, 'beach-hat-colour'));
  const band = pick(BEACH_COLOURS.hatBands, rand(0, id, 'beach-band'));
  const r = rig.head, cy = rig.headY;
  if (wear === 'bather-towel') towelHood(b, rig, towelColour(id));
  else if (wear === 'bather-face') {
    // Asleep: the hat tipped over the face (+Z out of it), its crown up off the face.
    b.at(compose(translation(0, cy + r * 0.1, r * 0.95), rotationX(Math.PI / 2)), () => drawSunHat(b, hat, band, r * 0.95));
  } else if (sunHat(look, id)) {
    b.at(compose(translation(0, cy, 0), rotationX(-0.16), translation(0, r * 0.52, 0)), () => drawSunHat(b, hat, band, r * 0.95));
  }
  const out = b.build();
  return out.position.length > 0 ? out : null;
}
