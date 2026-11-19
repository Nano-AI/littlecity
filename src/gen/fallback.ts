// Placeholders (Stage 0, kept as a safety net). A structure kind with no
// generator draws as a coloured box per cell; a feature, prop or actor type
// with no part draws as a small marker. Real generators and parts replace
// them simply by existing: nothing here needs editing.

import { CELL_H, keyX, keyY, keyZ, unedge } from '@/core/grid';
import { isFloorKind, type StructureKind } from '@/core/kinds';
import type { Mat4Like } from '@/core/mat4';
import { hash } from '@/core/rand';
import { PALETTE, rampColor } from '@/style/palette';
import type { Generator, PartFallback } from './api';
import { placeFeatures } from './api';
import { MeshBuilder, PATTERN } from './mesh';

/** Box inset per kind so stacked placeholders still read as separate pieces. */
const INSET: Partial<Record<StructureKind, number>> = {
  tree: 0.25,
  fountain: 0.15,
  stall: 0.12,
  pillar: 0.3,
  fence: 0.4,
  wall: 0.3,
  stairs: 0.05,
  windmill: 0.15,
  tower: 0.08,
  lighthouse: 0.12,
};

export const fallbackGenerator: Generator['build'] = (s, plan, parts) => {
  const b = new MeshBuilder({ ink: s.id });
  const anchors: Record<string, Mat4Like> = {};
  b.setColor(rampColor(s.kind, s.color)).setInk('body');
  if (isFloorKind(s.kind)) {
    b.setPattern(s.kind === 'plaza' ? PATTERN.paving : s.kind === 'garden' ? PATTERN.crops : PATTERN.none);
    for (const c of s.cells) {
      const x = keyX(c), y = keyY(c) * CELL_H, z = keyZ(c);
      b.box([x + 0.04, y, z + 0.04], [x + 0.96, y + 0.04, z + 0.96], { skip: ['bottom'] });
    }
  } else {
    const inset = INSET[s.kind] ?? 0;
    const mine = new Set(s.cells);
    for (const c of s.cells) {
      const x = keyX(c), y = keyY(c) * CELL_H, z = keyZ(c);
      // Hide the faces between stacked cells of the same structure, so a stack reads as one piece.
      const skip = [mine.has(c + (1 << 12)) ? 'top' : null, mine.has(c - (1 << 12)) ? 'bottom' : null].filter(
        (f): f is 'top' | 'bottom' => f !== null,
      );
      b.box([x + inset, y, z + inset], [x + 1 - inset, y + CELL_H, z + 1 - inset], { skip });
    }
    for (const e of s.edges) {
      const { cell, side } = unedge(e);
      const x = keyX(cell), y = keyY(cell) * CELL_H, z = keyZ(cell);
      const h = s.kind === 'wall' ? 0.5 : 0.35;
      if (side === 'E') b.box([x + 0.95, y, z], [x + 1.05, y + h, z + 1]);
      else b.box([x, y, z + 0.95], [x + 1, y + h, z + 1.05]);
    }
  }
  placeFeatures(b, anchors, s, plan, parts);
  return { mesh: b.build(), anchors };
};

const MARKER_COLORS = [PALETTE.red, PALETTE.yellow, PALETTE.pink, PALETTE.glass, PALETTE.leafDark, PALETTE.brick];

/** A small coloured marker in the part's local frame, so a rule's output is visible before its part exists. */
export const fallbackPart: PartFallback = (category, item, ctx) => {
  const b = ctx.mesh();
  const color = MARKER_COLORS[hash(0, item.type) % MARKER_COLORS.length]!;
  b.setColor(color).setInk('marker');
  if (category === 'feature') {
    // A plaque on the wall: sticks out along +Z, centred half-way up the storey.
    b.box([-0.12, CELL_H * 0.35, 0], [0.12, CELL_H * 0.65, 0.06]);
  } else if (ctx.span > 0) {
    // A line prop: a thin bar along +X.
    b.box([0, -0.02, -0.02], [ctx.span, 0.02, 0.02]);
  } else if (category === 'prop') {
    b.boxAt([0, 0, 0], [0.12, 0.3, 0.12]);
  } else {
    b.lathe([[0, 0], [0.1, 0.12], [0, 0.24]], { segments: 4 });
  }
  return { mesh: b.build() };
};
