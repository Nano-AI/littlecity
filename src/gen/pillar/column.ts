// One column: a base, a shaft with a little entasis, and a capital. Shared by
// the placed pillar (src/gen/pillar/pillar.gen.ts) and the generated supports
// (src/gen/support). Drawn round the local origin, which is the centre of
// the column's foot.

import type { ColorInput, MeshBuilder } from '@/gen/mesh';
import { PATTERN } from '@/gen/mesh';

export interface ColumnSpec {
  /** From the foot to the underside of whatever it carries. */
  height: number;
  /** Shaft radius under the capital, and how much wider it is at the foot. */
  radius: number;
  swell: number;
  /** Width of the square plinth; 0 for none (the shaft stands on a footing or grows out of a wall). */
  base: number;
  /**
   * 'plain': a free-standing column's capital. 'flared': a wide capital that
   * spreads under a block. 'platform': a slab big enough to plant a tree on.
   * 'impost': a low block for an arcade to spring from (drawn by the caller above it).
   */
  capital: 'plain' | 'flared' | 'platform' | 'impost';
  /** Width of the flared capital's top. */
  flare: number;
  /** Height of a stone footing under the base (in the sea); 0 for none. */
  footing: number;
  color: ColorInput;
  shade: ColorInput;
  pattern: number;
  /** Prefix for the ink groups, so two columns in one builder stay two objects. */
  ink: string;
  segments?: number;
}

export function drawColumn(b: MeshBuilder, c: ColumnSpec): void {
  const seg = c.segments ?? 14;
  let y = 0;
  if (c.footing > 0) {
    // A squat stone block that stands in the water; its top is weathered a shade darker.
    const w = Math.max(c.base, c.radius * 2) + 0.16;
    b.with({ color: c.shade, pattern: PATTERN.stone, ink: `${c.ink}footing` }, () => {
      b.boxAt([0, 0, 0], [w, c.footing - 0.05, w], { skip: ['bottom', 'top'] });
      const i = w / 2 - 0.05;
      b.quad([-w / 2, c.footing - 0.05, w / 2], [w / 2, c.footing - 0.05, w / 2], [i, c.footing, i], [-i, c.footing, i]);
      b.quad([w / 2, c.footing - 0.05, w / 2], [w / 2, c.footing - 0.05, -w / 2], [i, c.footing, -i], [i, c.footing, i]);
      b.quad([w / 2, c.footing - 0.05, -w / 2], [-w / 2, c.footing - 0.05, -w / 2], [-i, c.footing, -i], [i, c.footing, -i]);
      b.quad([-w / 2, c.footing - 0.05, -w / 2], [-w / 2, c.footing - 0.05, w / 2], [-i, c.footing, i], [-i, c.footing, -i]);
      b.quad([-i, c.footing, i], [i, c.footing, i], [i, c.footing, -i], [-i, c.footing, -i]);
    });
    y = c.footing;
  }
  const rFoot = c.radius + c.swell;
  // Base: a square plinth and a round torus on it, one object.
  if (c.base > 0) {
    b.with({ color: c.shade, pattern: PATTERN.none, ink: `${c.ink}base` }, () => {
      b.boxAt([0, y, 0], [c.base, 0.09, c.base], { skip: ['bottom'] });
      b.lathe(
        [
          [rFoot + 0.055, y + 0.09],
          [rFoot + 0.065, y + 0.12],
          [rFoot + 0.02, y + 0.16],
        ],
        { segments: seg },
      );
    });
    y += 0.16;
  }
  // Capital sizes.
  const top = c.height;
  const abacusH = c.capital === 'platform' ? 0.1 : c.capital === 'impost' ? 0.07 : 0.07;
  const abacusW =
    c.capital === 'flared' ? c.flare : c.capital === 'platform' ? 0.94 : c.capital === 'impost' ? c.radius * 2 + 0.14 : c.radius * 2 + 0.2;
  const bellH = c.capital === 'flared' ? 0.2 : c.capital === 'platform' ? 0.24 : 0.09;
  const bellR = Math.min(abacusW / 2 - 0.02, c.capital === 'flared' || c.capital === 'platform' ? abacusW / 2 - 0.03 : c.radius + 0.07);
  const neck = top - abacusH - bellH;
  // Shaft, with entasis: it keeps its width for the lower third, then narrows.
  const shaft: [number, number][] = [];
  const steps = Math.max(2, Math.min(6, Math.round((neck - y) / 0.5)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    shaft.push([c.radius + c.swell * (1 - Math.pow(t, 1.7)), y + (neck - y) * t]);
  }
  b.with({ color: c.color, pattern: c.pattern, ink: `${c.ink}shaft` }, () => b.lathe(shaft, { segments: seg }));
  // Capital: a necking ring, a bell that spreads, and a square abacus. One object.
  b.with({ color: c.shade, pattern: PATTERN.none, ink: `${c.ink}capital` }, () => {
    b.lathe(
      [
        [c.radius, neck - 0.045],
        [c.radius + 0.03, neck - 0.03],
        [c.radius + 0.03, neck],
        [c.radius + 0.005, neck],
        [bellR * 0.72 + c.radius * 0.28, neck + bellH * 0.55],
        [bellR, top - abacusH],
      ],
      { segments: seg },
    );
    b.boxAt([0, top - abacusH, 0], [abacusW, abacusH, abacusW]);
  });
}
