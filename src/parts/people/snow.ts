// L64 · a snow day's things: the snowman the children build (in stages, as
// it goes up), the snowball they roll (it grows as it is rolled) and the
// snowballs they throw. World units, standing at the origin, the snowman
// facing +Z. Soft bodies (src/gen/soft.ts): one outline round each ball. Pure.

import { compose, rotationX, rotationZ, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { smoothBall, soft } from '@/gen/soft';
import { tube } from '@/parts/ground/kit';
import { PALETTE } from '@/style/palette';
import { SNOW_COLOURS } from '@/style/scenes';

const cache = new Map<string, MeshData>();
function cached(key: string, build: () => MeshData): MeshData {
  let m = cache.get(key);
  if (!m) cache.set(key, (m = build()));
  return m;
}

/** The snowman's balls: radius and height of the middle of each, bottom to top. */
export const SNOWMAN = { body: [0.17, 0.15], middle: [0.12, 0.38], head: [0.085, 0.555] } as const;

/**
 * The snowman at a stage of building: 1 the body, 2 with its middle, 3 with its head, 4 with a face (coal
 * eyes, a carrot nose, coal buttons) and stick arms, 5 with a hat and a scarf. −1: melting (lumps, lopsided,
 * the hat slipped down, the nose fallen).
 */
export type SnowmanStage = 1 | 2 | 3 | 4 | 5 | -1;
export function snowmanMesh(stage: SnowmanStage, look = 0): MeshData {
  return cached(`snowman:${stage}:${look % SNOW_COLOURS.scarves.length}`, () => {
    const b = new MeshBuilder({ ink: `snowman-${stage}` });
    const snow = SNOW_COLOURS.snow;
    const [rb, yb] = SNOWMAN.body, [rm, ym] = SNOWMAN.middle, [rh, yh] = SNOWMAN.head;
    const scarf = SNOW_COLOURS.scarves[look % SNOW_COLOURS.scarves.length]!;
    if (stage === -1) {
      // Melting: a slumped body, the rest sunk and leaning, a puddle of grey slush round it.
      soft(b, { ink: 'snowman' }, (s) => {
        s.b.setColor(snow).setPattern(PATTERN.none);
        s.ball(0, 0.07, 0, rb * 1.15, 0.09, rb * 1.1, 12, 6);
        s.ball(0.03, 0.2, 0.01, rm * 0.95, rm * 0.8, rm * 0.95, 10, 5);
      });
      b.setInk('hat').setColor(PALETTE.metal);
      b.at(compose(translation(0.05, 0.27, 0.02), rotationZ(-0.5)), () => b.lathe([[0.07, 0], [0.07, 0.008], [0.045, 0.01], [0.045, 0.07], [0, 0.07]], { segments: 10, capBottom: true }));
      b.setInk('nose').setColor(SNOW_COLOURS.carrot);
      b.at(compose(translation(0.12, 0.02, 0.16), rotationZ(Math.PI / 2)), () => b.lathe([[0.012, 0], [0, 0.06]], { segments: 6 }));
      return b.build();
    }
    soft(b, { ink: 'snowman' }, (s) => {
      s.b.setColor(snow).setPattern(PATTERN.none);
      s.ball(0, yb, 0, rb, rb * 0.9, rb, 12, 7);
      if (stage >= 2) s.ball(0, ym, 0, rm, rm * 0.92, rm, 12, 6);
      if (stage >= 3) s.ball(0, yh, 0, rh, rh, rh, 12, 6);
    });
    if (stage >= 4) {
      b.setInk('coal').setColor(PALETTE.ink);
      for (const x of [-0.03, 0.03]) smoothBall(b, x, yh + 0.02, rh * 0.93, 0.011, 0.011, 0.008, 5, 3);
      for (const y of [ym + 0.06, ym, ym - 0.06]) smoothBall(b, 0, y, rm * 0.97 - Math.abs(y - ym) * 0.4, 0.012, 0.012, 0.008, 5, 3);
      b.setInk('nose').setColor(SNOW_COLOURS.carrot);
      b.at(compose(translation(0, yh - 0.005, rh * 0.9), rotationX(Math.PI / 2)), () => b.lathe([[0.014, 0], [0, 0.075]], { segments: 6, capBottom: true }));
      b.setInk('arms').setColor(PALETTE.trunk);
      for (const s of [-1, 1]) tube(b, [[s * rm * 0.9, ym + 0.02, 0], [s * 0.21, ym + 0.1, 0.02], [s * 0.26, ym + 0.15, 0.0]], 0.007, { seg: 4 });
    }
    if (stage >= 5) {
      // A black hat with a band, and a scarf knotted round the neck with its end hanging.
      b.setInk('hat').setColor(PALETTE.metal);
      b.at(translation(0, yh + rh * 0.72, 0), () => {
        b.lathe([[0.085, 0], [0.085, 0.008], [0.055, 0.01], [0.055, 0.085], [0, 0.085]], { segments: 12, capBottom: true });
        b.setInk('band').setColor(scarf);
        b.lathe([[0.0565, 0.012], [0.0565, 0.026]], { segments: 12 });
      });
      b.setInk('scarf').setColor(scarf).setPattern(PATTERN.cloth);
      b.at(translation(0, yh - rh * 0.88, 0), () => b.lathe([[rh * 0.98, -0.02], [rh * 1.06, 0], [rh * 0.98, 0.022]], { segments: 12 }));
      b.box([0.03, yh - rh - 0.12, rh * 0.75], [0.07, yh - rh, rh * 0.95]);
    }
    return b.build();
  });
}

/** A ball of snow of radius 1 about the origin (scaled to the size it has been rolled to, or thrown). */
export function snowballMesh(): MeshData {
  return cached('snowball', () => {
    const b = new MeshBuilder({ ink: 'snowball' });
    b.setInk('snowball').setColor(SNOW_COLOURS.snow).setPattern(PATTERN.none);
    smoothBall(b, 0, 0, 0, 1, 1, 1, 10, 6);
    return b.build();
  });
}
