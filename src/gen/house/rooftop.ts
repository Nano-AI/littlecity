// Things that stand on or break through a house roof and need the roof's own
// shape to be drawn (Houses owner): the cross gable over a main door (J10),
// the housing of a door that opens from the roof onto an arch deck or loggia
// (J26), and the frame of a roof light. Small gabled dormers are a part
// (src/parts/openings/dormer.part.ts); these are not, because each must run
// back exactly as far as the main roof rises to meet it.

import { CELL_H, DIR4, key, keyX, keyY, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { compose, frame, translation, type Mat4Like, type Vec3 } from '@/core/mat4';
import type { PartRegistry } from '@/gen/api';
import type { Feature } from '@/resolve/plan';
import { HOUSE, mixColor } from '@/style/houses';
import { PALETTE } from '@/style/palette';
import { faceFrame } from '../frames';
import { PATTERN, type ColorInput } from '../mesh';
import type { RoofField } from '../roof/roof';
import type { House } from './house.gen';

/** The wall of a gable: some houses have half-timbered gables over plain walls. */
export function gableMaterial(h: House, cell: CellKey): { color: ColorInput; pattern: number } {
  const plain = h.material(cell);
  if (h.persona.timberGable && plain.pattern === PATTERN.plaster) return { color: mixColor(h.wall, PALETTE.white, 0.45), pattern: PATTERN.timber };
  return plain;
}

/**
 * How far behind the cell line of side `dir` the main roof over `cell` has
 * risen to `height` above the wall top (or runs out): a small roof whose
 * ridge is at that height must reach at least that far back to meet it.
 */
function runBack(h: House, field: RoofField, cell: CellKey, dir: Dir4, height: number): number {
  const [dx, dz] = DIR4[dir]!;
  const top = (keyY(cell) + 1) * CELL_H;
  let last = 0.2;
  for (let d = 0.2; d <= 2.4; d += 0.05) {
    const x = keyX(cell) + 0.5 + dx * (0.5 - d), z = keyZ(cell) + 0.5 + dz * (0.5 - d);
    const at = key(Math.floor(x), keyY(cell), Math.floor(z));
    if (h.fields.get(at) !== field) break; // ran off this roof: stop where it ends
    last = d;
    if (field.heightAt(at, x, z) - top >= height) break;
  }
  return last + 0.06;
}

/** A small gabled roof over a front at the wall plane: two slopes, a bargeboard, its underside, a ridge cap. */
function gabledHood(h: House, name: string, half: number, eaveY: number, peakY: number, back: number): void {
  const { b, persona } = h;
  const inset = HOUSE.inset, over = 0.045, front = -inset + 0.06;
  const e = half + over, drop = (over * (peakY - eaveY)) / half, y0 = eaveY - drop;
  b.with({ color: persona.roofColor, pattern: persona.cover === 'thatch' ? PATTERN.thatch : persona.cover === 'glass' ? PATTERN.glass : PATTERN.shingles, ink: `${name}-roof` }, () => {
    b.quad([e, y0, front], [e, y0, -back], [0, peakY, -back], [0, peakY, front]);
    b.quad([-e, y0, -back], [-e, y0, front], [0, peakY, front], [0, peakY, -back]);
  });
  b.with({ color: persona.trim, ink: `${name}-trim` }, () => {
    const t = 0.045;
    b.quad([0, peakY - t, front], [e, y0 - t, front], [e, y0, front], [0, peakY, front]);
    b.quad([-e, y0 - t, front], [0, peakY - t, front], [0, peakY, front], [-e, y0, front]);
    // The underside of the front overhang: a far slope is seen from below.
    b.quad([e, y0 - t, front], [0, peakY - t, front], [0, peakY - t, -inset], [e, y0 - t, -inset]);
    b.quad([0, peakY - t, front], [-e, y0 - t, front], [-e, y0 - t, -inset], [0, peakY - t, -inset]);
  });
  const cap = persona.cover === 'glass' ? persona.trim : mixColor(persona.roofColor, persona.cover === 'thatch' ? PALETTE.trunk : PALETTE.ink, persona.cover === 'thatch' ? 0.3 : 0.2);
  b.with({ color: cap, ink: `${name}-ridge` }, () => b.box([-HOUSE.capWidth / 2, peakY - 0.004, -back], [HOUSE.capWidth / 2, peakY + HOUSE.capProud, front], { skip: ['bottom', 'n'] }));
}

/**
 * J10: a cross gable. The wall over the main door carries on up into a gable
 * of its own, with a round light in it and a roof running back into the main
 * one. `f.cell` is the top-storey cell above the door, `f.dir` the door's side.
 */
export function crossGable(h: House, f: Feature, parts: PartRegistry): void {
  if (f.cell === undefined || f.dir === undefined) return;
  const field = h.fields.get(f.cell);
  if (!field) return;
  const { b } = h;
  const dir = f.dir as Dir4;
  // As big as the roof allows: a knee of wall, then the gable, its ridge a little under the main one.
  const inset = HOUSE.inset, half = 0.39;
  const peak = Math.max(0.36, Math.min(0.56, field.rise - 0.06)), knee = Math.max(0, Math.min(0.14, peak - 0.4));
  const at = compose(faceFrame(f.cell, dir), translation(0, CELL_H, 0));
  const back = runBack(h, field, f.cell, dir, peak + HOUSE.capProud);
  const mat = gableMaterial(h, f.cell);
  b.at(at, () => {
    b.with({ color: mat.color, pattern: mat.pattern, ink: 'walls' }, () =>
      b.polygon([[-half, 0, -inset], [half, 0, -inset], [half, knee, -inset], [0, peak, -inset], [-half, knee, -inset]]));
    gabledHood(h, `cross${f.cell}`, half, knee, peak, back);
  });
  // The round light, drawn by the window part (centred half-way up a storey in its own frame).
  const light = { id: `${f.id}/light`, type: 'window', structure: h.s.id, cell: f.cell, dir, variant: 'round', rule: f.rule } as Feature;
  b.add(parts.feature(light, { plan: h.plan, structure: h.s }).mesh, compose(at, translation(0, knee + (peak - knee) * 0.34 - CELL_H / 2, -inset)));
}

/**
 * J26: a door from the roof. Where an arch deck or a loggia meets the house
 * at eave level there is no wall for a door, so the door stands in a small
 * gabled housing that rises through the roof. `f.cell` is the cell above the
 * roof cell; the returned frame is where the door part draws.
 */
export function roofDoor(h: House, f: Feature): Mat4Like | undefined {
  if (f.cell === undefined || f.dir === undefined) return undefined;
  const under = f.cell - (1 << 12);
  const dir = f.dir as Dir4;
  const inset = HOUSE.inset;
  const at = compose(faceFrame(f.cell, dir), translation(0, 0, 0));
  const field = h.fields.get(under);
  const half = 0.25, eave = 0.6, peak = 0.78;
  const back = field ? runBack(h, field, under, dir, peak + HOUSE.capProud) : 0.9;
  const mat = h.material(under);
  const { b } = h;
  b.at(at, () => {
    b.with({ color: mat.color, pattern: mat.pattern, ink: 'walls' }, () => {
      b.polygon([[-half, -0.02, -inset], [half, -0.02, -inset], [half, eave, -inset], [0, peak, -inset], [-half, eave, -inset]]);
      b.quad([half, -0.02, -inset], [half, -0.02, -back], [half, eave, -back], [half, eave, -inset]);
      b.quad([-half, -0.02, -back], [-half, -0.02, -inset], [-half, eave, -inset], [-half, eave, -back]);
    });
    gabledHood(h, `roofdoor${f.cell}`, half, eave, peak, back);
  });
  return compose(at, translation(0, 0, -inset));
}

/**
 * The frame of a roof light: lying on the slope over the eave on side
 * `f.dir`. +Y is the slope's normal, +Z runs down the slope.
 */
export function skylightFrame(h: House, f: Feature): Mat4Like | null {
  if (f.cell === undefined || f.dir === undefined) return null;
  const field = h.fields.get(f.cell);
  if (!field) return null;
  const [dx, dz] = DIR4[f.dir]!;
  const x = keyX(f.cell) + 0.5 + dx * 0.12, z = keyZ(f.cell) + 0.5 + dz * 0.12;
  const y = field.heightAt(f.cell, x, z);
  const fall = field.heightAt(f.cell, x + dx * 0.1, z + dz * 0.1) - y;
  const len = Math.hypot(0.1, fall);
  const down: Vec3 = [(dx * 0.1) / len, fall / len, (dz * 0.1) / len];
  const right: Vec3 = [dz, 0, -dx];
  // normal = down × right
  const normal: Vec3 = [down[1] * right[2] - down[2] * right[1], down[2] * right[0] - down[0] * right[2], down[0] * right[1] - down[1] * right[0]];
  return frame([x, y, z], right, normal, down);
}
