// Playing fields (R-G03). A field region is one low slab like a garden's;
// on it the court R-G03 found (its role and `field-court` feature) is
// painted in chalk and flat colour by courts.ts. Cells of the region
// outside the court are a little grass apron round it. The furniture that
// stands (hoops, the net, goals, the umpire's chair) is D40's props.
//
// Reads: the region's cells, its role and its features. Nothing else.

import { CELL_H, keyX, keyY, keyZ, neighbor, type CellKey, type Dir4 } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { fieldCourtOf, FIELD_LIFT, type FieldRole } from '@/rules/roles/field.lib';
import { COURT } from '@/style/field';
import { MARKINGS } from './courts';
import { cellSlab } from './sheet';

/** The colour of the ground round the court's lines (inside the playing rectangle). */
const RUNOFF: Record<FieldRole, string> = {
  'basketball-court': COURT.hardRunoff,
  'tennis-court': COURT.clayRunoff,
  'football-pitch': COURT.grass,
  'bowling-green': COURT.ditch,
  'croquet-lawn': COURT.grass,
  'boules-court': COURT.timber,
  'running-track': COURT.grass,
  'kickabout-green': COURT.grass,
};

export default defineGenerator({
  kind: 'field',
  build(s, plan, parts) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: s.id });
    const cells = new Set<CellKey>(s.cells);
    const court = fieldCourtOf(plan, s, CELL_H);
    const r = court?.rect;
    const inRect = (c: CellKey): boolean => !!r && keyX(c) >= r.x0 && keyX(c) < r.x0 + r.w && keyZ(c) >= r.z0 && keyZ(c) < r.z0 + r.d;
    const runoff = court ? (court.role === 'tennis-court' && court.surface === 'grass' ? COURT.grass : RUNOFF[court.role]) : COURT.grass;
    b.setInk('field');
    for (const cell of s.cells) {
      const y0 = keyY(cell) * CELL_H;
      const here = (d: Dir4): boolean => cells.has(neighbor(cell, d));
      const color = inRect(cell) ? runoff : COURT.grass;
      const grassy = color === COURT.grass;
      b.with({ color, pattern: grassy ? PATTERN.grass : PATTERN.sand }, () => cellSlab(b, cell, here, { y0, y1: y0 + FIELD_LIFT, round: COURT.round }));
    }
    if (court) {
      b.setInk('field');
      MARKINGS[court.role]({ b, c: court, seed: s.seed, y: court.y });
    }
    placeFeatures(b, anchors, s, plan, parts, (f) => (f.type === 'field-court' || f.type === 'floor-link' ? null : undefined));
    return { mesh: b.build(), anchors };
  },
});
