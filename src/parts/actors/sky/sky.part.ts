// The sky (life depth): ink-washed clouds and their shadows (L31), and the
// far hot-air balloon (L30).
//
//   cloud          one lobe of a cloud: a MIST puff (src/gen/airborne.ts),
//                  about 1 across; the behaviour builds a cloud of a few and
//                  sets param c so the page edges it with a soft graphite line
//   cloud/shadow   a flat MIST disc of radius 1 in XZ, cool and dark; with
//                  param d = its radius it fades softly to its rim
//   balloon        a striped envelope over a wicker basket, AIRBORNE, about
//                  1.1 tall; origin at the basket's floor

import { definePart } from '@/gen/api';
import { airborne, MIST } from '@/gen/airborne';
import { PATTERN, type PatternId } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { mistPuff } from '../kit';

const STRIPES = [[PALETTE.red, PALETTE.yellow], [PALETTE.glass, PALETTE.white], [PALETTE.pink, PALETTE.white]] as const;

export const cloud = definePart({
  actor: 'cloud',
  build(item, ctx) {
    const b = ctx.mesh();
    if (item.variant === 'shadow') {
      b.setColor('#4d5a7a').setPattern(MIST).setInk('shade');
      const n = 20;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        b.tri([0, 0, 0], [Math.cos(a0), 0, -Math.sin(a0)], [Math.cos(a1), 0, -Math.sin(a1)]); // counter-clockwise from above
      }
      return { mesh: b.build(), animated: true };
    }
    mistPuff(b, Math.abs(Math.round(item.params?.look ?? 0)));
    return { mesh: b.build(), animated: true };
  },
});

export default definePart({
  actor: 'balloon',
  build(item, ctx) {
    const b = ctx.mesh();
    const look = Math.abs(Math.round(item.params?.look ?? 0)) % STRIPES.length;
    const [c0, c1] = STRIPES[look]!;
    const air = (p: PatternId): PatternId => airborne(p);
    // The envelope: gores of two colours, a pear shape, wide at the top.
    const profile: [number, number][] = [[0.07, 0.42], [0.2, 0.55], [0.33, 0.75], [0.38, 0.92], [0.33, 1.08], [0.2, 1.18], [0, 1.22]];
    const gores = 8;
    for (let g = 0; g < gores; g++) {
      b.setColor(g % 2 ? c1 : c0).setPattern(air(PATTERN.cloth)).setInk(`gore${g}`);
      b.lathe(profile, { segments: 2, start: (g / gores) * Math.PI * 2, sweep: (Math.PI * 2) / gores, smooth: true });
    }
    // Ropes and the basket.
    b.setColor(PALETTE.metal).setPattern(air(PATTERN.none)).setInk('ropes');
    for (const [x, z] of [[0.06, 0.06], [-0.06, 0.06], [0.06, -0.06], [-0.06, -0.06]] as const) b.boxAt([x * 0.8, 0.14, z * 0.8], [0.008, 0.29, 0.008], { skip: ['bottom', 'top'] });
    b.setColor(PALETTE.wood).setPattern(air(PATTERN.planks)).setInk('basket');
    b.boxAt([0, 0, 0], [0.13, 0.12, 0.13]);
    return { mesh: b.build(), animated: true };
  },
});
