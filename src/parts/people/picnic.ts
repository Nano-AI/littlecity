// L66 · a picnic's things: a checked blanket spread on the grass with the
// food laid out on it (a pie, bread, apples, a jug), and the blanket rolled up
// to carry. World units for the spread blanket (lying at the origin); figure
// units for the carried roll. Round food is soft (src/gen/soft.ts). Pure.

import { rotationZ, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { soft } from '@/gen/soft';
import { PALETTE } from '@/style/palette';
import { PICNIC_COLOURS } from '@/style/scenes';

const cache = new Map<string, MeshData>();
const pick = (xs: readonly string[], i: number): string => xs[((i % xs.length) + xs.length) % xs.length]!;

/** The blanket's half-size (world units): a square a little over half a cell across. */
export const BLANKET = 0.43;

/** A checked blanket spread flat, with the food on it. `colour` picks the check. */
export function blanketMesh(colour: number): MeshData {
  const key = `blanket:${colour}`;
  let m = cache.get(key);
  if (m) return m;
  const b = new MeshBuilder({ ink: `picnic-blanket-${colour}` });
  const c = pick(PICNIC_COLOURS.checks, colour);
  const n = 6, s = (BLANKET * 2) / n, y = 0.012;
  b.setInk('blanket').setPattern(PATTERN.cloth);
  // Checks: the squares where row and column are both odd are the colour, both even white, else a pale mix.
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      b.setColor(i % 2 && j % 2 ? c : !(i % 2) && !(j % 2) ? PALETTE.white : PICNIC_COLOURS.mid[colour % PICNIC_COLOURS.mid.length]!);
      const x0 = -BLANKET + i * s, z0 = -BLANKET + j * s;
      b.quad([x0, y, z0 + s], [x0 + s, y, z0 + s], [x0 + s, y, z0], [x0, y, z0]);
    }
  }
  // Its edges, so it lies on the grass as a thing.
  for (const [a, bb, cc, d] of [
    [[-BLANKET, 0, BLANKET], [BLANKET, 0, BLANKET], [BLANKET, y, BLANKET], [-BLANKET, y, BLANKET]],
    [[BLANKET, 0, -BLANKET], [-BLANKET, 0, -BLANKET], [-BLANKET, y, -BLANKET], [BLANKET, y, -BLANKET]],
    [[BLANKET, 0, BLANKET], [BLANKET, 0, -BLANKET], [BLANKET, y, -BLANKET], [BLANKET, y, BLANKET]],
    [[-BLANKET, 0, -BLANKET], [-BLANKET, 0, BLANKET], [-BLANKET, y, BLANKET], [-BLANKET, y, -BLANKET]],
  ] as [number, number, number][][]) {
    b.setColor(c);
    b.quad(a!, bb!, cc!, d!);
  }
  // The food in the middle: a pie, a loaf, apples, a jug.
  b.setInk('pie-dish').setColor(PALETTE.white).setPattern(PATTERN.none);
  b.at(translation(-0.06, y, 0.03), () => b.lathe([[0, 0], [0.06, 0], [0.065, 0.02], [0.06, 0.022]], { segments: 12 }));
  soft(b, { ink: 'pie' }, (sb) => {
    sb.b.setColor(PICNIC_COLOURS.pie);
    sb.ball(-0.06, y + 0.02, 0.03, 0.055, 0.02, 0.055, 10, 4);
  });
  soft(b, { ink: 'loaf' }, (sb) => {
    sb.b.setColor('#e8892a');
    sb.ball(0.07, y + 0.025, -0.04, 0.06, 0.03, 0.035, 9, 5);
  });
  soft(b, { ink: 'apples' }, (sb) => {
    sb.b.setColor('#d9473c');
    sb.ball(0.02, y + 0.02, 0.09, 0.022, 0.02, 0.022, 7, 4);
    sb.b.setColor('#8cc04a');
    sb.ball(0.06, y + 0.02, 0.07, 0.022, 0.02, 0.022, 7, 4);
  });
  b.setInk('jug').setColor('#6f8fb0').setPattern(PATTERN.none);
  b.at(translation(-0.09, y, -0.08), () => b.lathe([[0, 0], [0.025, 0], [0.03, 0.04], [0.02, 0.07], [0.024, 0.08], [0, 0.08]], { segments: 9 }));
  m = b.build();
  cache.set(key, m);
  return m;
}

/** The blanket rolled up and strapped, carried on the shoulder (figure units): along +Z, its middle at the origin. */
export function drawRolledBlanket(b: MeshBuilder, colour: number): void {
  const c = pick(PICNIC_COLOURS.checks, colour);
  b.setInk('roll').setColor(c).setPattern(PATTERN.cloth);
  b.at(rotationZ(0), () => b.at([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1], () => b.lathe([[0.045, -0.15], [0.045, 0.15]], { segments: 10, capBottom: true, capTop: true })));
  b.setInk('straps').setColor(PALETTE.trunk).setPattern(PATTERN.none);
  for (const z of [-0.08, 0.08]) b.at([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, z, 1], () => b.lathe([[0.048, -0.012], [0.048, 0.012]], { segments: 10 }));
}
