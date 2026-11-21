// What raiders carry off (design section 13b, the raid): drawn like every
// other load (loads.ts calls this), standing on its own bottom at the
// origin, front +Z, in figure units before loads.ts makes it big enough to
// read. A chest, a ham, a bolt of cloth, a wheel of cheese, a candlestick,
// a pig and a hen (the last two do not stay taken: they jump ship and swim
// home). Pure.

import { compose, rotationX, rotationZ, translation } from '@/core/mat4';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { smoothBall, soft } from '@/gen/soft';
import { tube } from '@/parts/ground/kit';
import { PALETTE } from '@/style/palette';

export type Loot = 'chest' | 'pig' | 'hen' | 'ham' | 'cloth' | 'cheese' | 'candlestick';
export const LOOTS: readonly Loot[] = ['chest', 'pig', 'hen', 'ham', 'cloth', 'cheese', 'candlestick'];

export function isLoot(kind: string): kind is Loot {
  return (LOOTS as readonly string[]).includes(kind);
}

/** Draws a piece of loot; false for anything else. */
export function drawLoot(b: MeshBuilder, kind: string): boolean {
  if (!isLoot(kind)) return false;
  b.setPattern(PATTERN.none);
  switch (kind) {
    case 'chest':
      // A wooden chest with a rounded lid and gold bands: treasure.
      b.setInk('chest').setColor('#9a5228').setPattern(PATTERN.planks);
      b.box([-0.06, 0, -0.04], [0.06, 0.055, 0.04]);
      b.at(compose(translation(0, 0.055, 0), rotationZ(Math.PI / 2)), () => b.lathe([[0.04, -0.06], [0.04, 0.06]], { segments: 8, start: Math.PI, sweep: Math.PI, capTop: true, capBottom: true }));
      b.setInk('bands').setColor('#e2b23c').setPattern(PATTERN.metal);
      for (const x of [-0.04, 0.04]) b.box([x - 0.007, 0, -0.042], [x + 0.007, 0.092, 0.042]);
      b.setInk('lock').setColor('#e2b23c');
      b.box([-0.01, 0.035, 0.04], [0.01, 0.06, 0.046]);
      return true;
    case 'pig':
      // A pink pig, side on, legs kicking, ears up, a curly tail: one soft body and its bits.
      soft(b, { ink: 'pig' }, (s) => {
        s.b.setColor('#f2a7b0');
        s.ball(0, 0.05, 0, 0.075, 0.048, 0.045, 10, 6);
        s.ball(0.07, 0.058, 0, 0.036, 0.034, 0.034, 8, 5);
      });
      b.setInk('snout').setColor('#e38893');
      b.at(compose(translation(0.104, 0.054, 0), rotationZ(-Math.PI / 2)), () => b.lathe([[0.016, 0], [0.016, 0.012], [0, 0.014]], { segments: 7 }));
      b.setInk('ears').setColor('#e38893');
      for (const z of [-0.016, 0.016]) b.polygon([[0.07, 0.085, z], [0.082, 0.112, z * 1.3], [0.09, 0.084, z]]);
      for (const z of [-0.016, 0.016]) b.polygon([[0.09, 0.084, z], [0.082, 0.112, z * 1.3], [0.07, 0.085, z]]);
      b.setInk('trotters').setColor('#e38893');
      for (const [x, z] of [[-0.045, -0.025], [-0.045, 0.025], [0.035, -0.025], [0.035, 0.025]] as const) tube(b, [[x, 0.03, z], [x + 0.01, 0.0, z * 1.2]], 0.011, { seg: 4 });
      b.setInk('tail').setColor('#e38893');
      tube(b, [[-0.074, 0.06, 0], [-0.09, 0.075, 0.008], [-0.084, 0.088, -0.006], [-0.095, 0.092, 0]], 0.005, { seg: 3 });
      b.setInk('eye').setColor(PALETTE.ink);
      for (const z of [-0.022, 0.022]) b.at(translation(0.09, 0.07, z), () => b.lathe([[0, -0.005], [0.005, 0], [0, 0.005]], { segments: 4 }));
      return true;
    case 'hen':
      // A plump hen, flapping: white with a red comb and wattle, a yellow beak, wings out.
      soft(b, { ink: 'hen' }, (s) => {
        s.b.setColor('#f6f1e6');
        s.ball(0, 0.045, 0, 0.045, 0.04, 0.035, 9, 5);
        s.ball(0.04, 0.085, 0, 0.022, 0.024, 0.02, 7, 4);
      });
      b.setInk('comb').setColor(PALETTE.red);
      for (const x of [0.03, 0.042, 0.054]) smoothBall(b, x, 0.11, 0, 0.008, 0.01, 0.006, 5, 3);
      b.setInk('beak').setColor(PALETTE.yellow);
      b.at(compose(translation(0.062, 0.085, 0), rotationZ(-Math.PI / 2)), () => b.lathe([[0.008, 0], [0, 0.018]], { segments: 4, capBottom: true }));
      b.setInk('wings').setColor('#e8dfcc');
      for (const sd of [1, -1]) b.polygon(sd > 0 ? [[-0.02, 0.06, 0.03], [0.01, 0.065, 0.03], [-0.01, 0.11, 0.075]] : [[-0.01, 0.11, -0.075], [0.01, 0.065, -0.03], [-0.02, 0.06, -0.03]]);
      for (const sd of [1, -1]) b.polygon(sd > 0 ? [[-0.01, 0.11, 0.075], [0.01, 0.065, 0.03], [-0.02, 0.06, 0.03]] : [[-0.02, 0.06, -0.03], [0.01, 0.065, -0.03], [-0.01, 0.11, -0.075]]);
      b.setInk('tail').setColor('#e8dfcc');
      b.polygon([[-0.04, 0.05, 0], [-0.07, 0.095, 0], [-0.05, 0.1, 0]]);
      b.polygon([[-0.05, 0.1, 0], [-0.07, 0.095, 0], [-0.04, 0.05, 0]]);
      return true;
    case 'ham':
      // A ham: fat at one end, a white knuckle of bone out of the other.
      soft(b, { ink: 'ham' }, (s) => {
        s.b.setColor('#c4614a');
        s.ball(0, 0.04, 0, 0.042, 0.04, 0.04, 9, 5);
        s.ball(0, 0.095, 0, 0.026, 0.035, 0.026, 8, 4);
      });
      b.setInk('bone').setColor(PALETTE.white);
      b.lathe([[0.008, 0.12], [0.008, 0.15], [0.014, 0.158], [0, 0.166]], { segments: 6 });
      return true;
    case 'cloth':
      // A bolt of cloth: a roll of bright stuff with a loose end hanging.
      b.setInk('bolt').setColor('#4f6fd0').setPattern(PATTERN.cloth);
      b.at(rotationX(Math.PI / 2), () => b.lathe([[0.034, -0.08], [0.034, 0.08]], { segments: 9, capTop: true, capBottom: true }));
      b.setInk('bolt-end').setColor(PALETTE.yellow);
      for (const z of [-0.05, 0.05]) b.at(compose(translation(0, 0, z), rotationX(Math.PI / 2)), () => b.lathe([[0.035, -0.006], [0.035, 0.006]], { segments: 9 }));
      return true;
    case 'cheese':
      // The market's great wheel of cheese, a wedge already cut out of it.
      b.setInk('cheese').setColor('#f3c64a');
      b.at(rotationX(Math.PI / 2), () => b.lathe([[0.065, -0.025], [0.07, 0], [0.065, 0.025]], { segments: 12, start: 0.5, sweep: Math.PI * 2 - 0.5, capTop: true, capBottom: true }));
      b.setInk('rind').setColor('#d79a2a');
      b.at(rotationX(Math.PI / 2), () => b.lathe([[0.071, -0.012], [0.071, 0.012]], { segments: 12, start: 0.5, sweep: Math.PI * 2 - 0.5 }));
      return true;
    case 'candlestick':
      // A tall gold candlestick with its candle.
      b.setInk('candlestick').setColor('#e2b23c').setPattern(PATTERN.metal);
      b.lathe([[0.03, 0], [0.03, 0.008], [0.01, 0.02], [0.008, 0.1], [0.022, 0.11], [0.022, 0.118], [0, 0.118]], { segments: 8 });
      b.setInk('candle').setColor(PALETTE.white).setPattern(PATTERN.none);
      b.lathe([[0.011, 0.118], [0.011, 0.17], [0, 0.17]], { segments: 6 });
      b.setInk('candle-flame').setColor(PALETTE.yellow).setPattern(PATTERN.glow);
      b.lathe([[0, 0.17], [0.008, 0.18], [0, 0.198]], { segments: 5 });
      return true;
  }
}
