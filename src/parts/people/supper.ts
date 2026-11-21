// L65 · the harvest supper's things: a trestle table with a white cloth and
// a bench either side (one per cell, set end to end down the square), the
// string of lanterns on two poles over it, and the table top and the lantern
// pole as they are carried. World units for the set-up things (standing at the
// origin, the table running along X); figure units for the carried ones. Pure.

import { compose, rotationX, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { tube } from '@/parts/ground/kit';
import { PALETTE } from '@/style/palette';
import { SUPPER_COLOURS } from '@/style/scenes';

const cache = new Map<string, MeshData>();
function cached(key: string, build: () => MeshData): MeshData {
  let m = cache.get(key);
  if (!m) cache.set(key, (m = build()));
  return m;
}

/** Heights and reach of a table cell (world units): the top, the benches, where diners sit (across). */
export const TABLE = { top: 0.21, bench: 0.1, half: 0.16, benchAt: 0.29, sitAt: 0.33 } as const;

/** One cell of the long table: legs, a white cloth hanging a little over the sides, a bench each side. Runs along X, ±0.49. */
export function tableMesh(end: 'none' | 'start' | 'end' | 'both'): MeshData {
  return cached(`table:${end}`, () => {
    const b = new MeshBuilder({ ink: `supper-table-${end}` });
    const L = 0.49, H = TABLE.half;
    b.setInk('legs').setColor(PALETTE.wood).setPattern(PATTERN.none);
    for (const x of [-0.38, 0.38]) for (const z of [-H + 0.03, H - 0.03]) b.box([x - 0.015, 0, z - 0.015], [x + 0.015, TABLE.top - 0.02, z + 0.015]);
    b.setInk('cloth').setColor(SUPPER_COLOURS.cloth).setPattern(PATTERN.cloth);
    b.box([-L, TABLE.top - 0.02, -H], [L, TABLE.top, H], { skip: ['bottom'] });
    // The cloth hangs down the long sides, and at the table's ends.
    b.box([-L, TABLE.top - 0.075, H], [L, TABLE.top - 0.02, H + 0.008], { skip: ['top'] });
    b.box([-L, TABLE.top - 0.075, -H - 0.008], [L, TABLE.top - 0.02, -H], { skip: ['top'] });
    if (end === 'start' || end === 'both') b.box([-L - 0.008, TABLE.top - 0.075, -H], [-L, TABLE.top, H], { skip: ['top'] });
    if (end === 'end' || end === 'both') b.box([L, TABLE.top - 0.075, -H], [L + 0.008, TABLE.top, H], { skip: ['top'] });
    // A runner of autumn colour down the middle.
    b.setInk('runner').setColor(SUPPER_COLOURS.runner).setPattern(PATTERN.cloth);
    b.box([-L, TABLE.top, -0.05], [L, TABLE.top + 0.004, 0.05], { skip: ['bottom'] });
    // The benches.
    b.setInk('benches').setColor(PALETTE.trunk).setPattern(PATTERN.planks);
    for (const s of [-1, 1]) {
      const z = s * TABLE.benchAt;
      b.box([-L + 0.02, TABLE.bench - 0.018, z - 0.05], [L - 0.02, TABLE.bench, z + 0.05], { skip: ['bottom'] });
      for (const x of [-0.36, 0.36]) b.box([x - 0.014, 0, z - 0.035], [x + 0.014, TABLE.bench - 0.018, z + 0.035]);
    }
    return b.build();
  });
}

/**
 * The lanterns: a pole at each end of a table `length` cells long and a line sagging between them hung with
 * paper lanterns (they glow at dusk). Along X from 0 to `length`, the poles a little past the table's ends.
 */
export function lanternsMesh(length: number): MeshData {
  return cached(`lanterns:${length}`, () => {
    const b = new MeshBuilder({ ink: `supper-lanterns-${length}` });
    const x0 = -0.42, x1 = length - 0.58, top = 1.05, sag = 0.12 + length * 0.02;
    b.setInk('poles').setColor(PALETTE.trunk).setPattern(PATTERN.none);
    for (const x of [x0, x1]) tube(b, [[x, 0, 0], [x, top + 0.03, 0]], 0.013, { seg: 5 });
    const at = (k: number): [number, number, number] => [x0 + (x1 - x0) * k, top - Math.sin(k * Math.PI) * sag, 0];
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 12; i++) pts.push(at(i / 12));
    b.setInk('line').setColor(PALETTE.ink);
    for (let i = 0; i < 12; i++) tube(b, [pts[i]!, pts[i + 1]!], 0.004, { seg: 3 });
    const n = Math.max(3, Math.round((x1 - x0) / 0.4));
    for (let i = 1; i < n; i++) {
      const [x, y, z] = at(i / n);
      const c = SUPPER_COLOURS.lanterns[i % SUPPER_COLOURS.lanterns.length]!;
      b.setInk(`lantern${i % 2}`).setColor(c).setPattern(PATTERN.glow);
      b.at(translation(x, y - 0.14, z), () => b.lathe([[0.018, 0.11], [0.062, 0.08], [0.07, 0.05], [0.055, 0.01], [0.018, 0]], { segments: 8, capBottom: true, capTop: true }));
      b.setInk('cords').setColor(PALETTE.ink).setPattern(PATTERN.none);
      b.box([x - 0.002, y - 0.032, z - 0.002], [x + 0.002, y, z + 0.002]);
    }
    return b.build();
  });
}

/** A table top carried on the shoulder (figure units): a plank with the folded cloth on it, along +Z, its middle at the origin. */
export function drawTrestle(b: MeshBuilder): void {
  b.setInk('plank').setColor(PALETTE.wood).setPattern(PATTERN.planks);
  b.box([-0.05, 0, -0.3], [0.05, 0.016, 0.3]);
  b.setInk('folded-cloth').setColor(SUPPER_COLOURS.cloth).setPattern(PATTERN.cloth);
  b.box([-0.045, 0.016, -0.1], [0.045, 0.04, 0.1]);
}

/** The lantern pole carried (figure units): upright in the right hand, the string of lanterns wound round its top. */
export function drawLanternPole(b: MeshBuilder): void {
  b.setInk('pole').setColor(PALETTE.trunk).setPattern(PATTERN.none);
  tube(b, [[0, -0.2, 0], [0, 0.32, 0]], 0.007, { seg: 4 });
  b.at(compose(translation(0, 0.26, 0), rotationX(0)), () => {
    for (let i = 0; i < 3; i++) {
      b.setInk(`lantern${i}`).setColor(SUPPER_COLOURS.lanterns[i]!).setPattern(PATTERN.glow);
      b.at(translation((i - 1) * 0.05, -0.03 - (i % 2) * 0.02, 0.03), () => b.lathe([[0.008, 0.045], [0.026, 0.03], [0.026, 0.012], [0.008, 0]], { segments: 6, capBottom: true, capTop: true }));
    }
  });
}
