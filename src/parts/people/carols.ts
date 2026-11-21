// L67 · the carol singers' things: a music note that floats up from them as
// they sing (drawn flat, a note head and its stem and flag, in the ink's
// colour, turned to the camera by whoever draws it), and the wreath-ribboned
// songbook is not drawn (too small): their lanterns are the `lantern` load.
// Pure.

import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';

const cache = new Map<string, MeshData>();

/** A music note (one, or two joined by a beam), in its XY plane facing +Z, its head at the origin. */
export function noteMesh(double: boolean): MeshData {
  const key = `note:${double}`;
  let m = cache.get(key);
  if (m) return m;
  const b = new MeshBuilder({ ink: `carol-note-${double}` });
  b.setInk('note').setColor(PALETTE.ink).setPattern(PATTERN.none);
  const head = (x: number, y: number): void => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      pts.push([x + Math.cos(a) * 0.032 * Math.cos(0.4) - Math.sin(a) * 0.022 * Math.sin(0.4), y + Math.cos(a) * 0.032 * Math.sin(0.4) + Math.sin(a) * 0.022 * Math.cos(0.4), 0]);
    }
    b.polygon(pts);
    b.polygon([...pts].reverse());
  };
  const stem = (x: number, y: number): void => {
    b.box([x + 0.022, y, -0.003], [x + 0.03, y + 0.13, 0.003]);
  };
  head(0, 0);
  stem(0, 0);
  if (double) {
    head(0.09, 0.02);
    stem(0.09, 0.02);
    b.box([0.022, 0.12, -0.003], [0.12, 0.15, 0.003]);
  } else {
    b.polygon([[0.03, 0.13, 0.004], [0.03, 0.1, 0.004], [0.07, 0.07, 0.004]]);
    b.polygon([[0.03, 0.1, -0.004], [0.03, 0.13, -0.004], [0.07, 0.07, -0.004]]);
  }
  m = b.build();
  cache.set(key, m);
  return m;
}
