// Fixture for J05.terrace-edges (art review H4): one barrier per side of a
// roof terrace. West to east: a terrace with nothing on it (the house's own
// parapet all round); one the player fenced all round (no parapet, a low
// coping under the railing); one fenced on its south side only (parapet on
// the others); a paved terrace two storeys up, railed by J19 (no parapet
// where the railing is).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J05.terrace-edges',
  seed: 5405,
  rules: houseDressing,
  build(b) {
    for (const [i, x] of [8, 13, 18].entries()) {
      b.house(x, 10, { w: 2, d: 2, color: [2, 4, 6][i]! });
      b.put('stairs', x, 12, { rot: 0 });
    }
    b.fenceAround(13, 10, 14, 11);
    b.fenceEdge(18, 11, 'S').fenceEdge(19, 11, 'S');
    b.house(23, 10, { w: 2, d: 2, floors: 2, color: 0 });
    b.house(25, 10, { d: 2, floors: 3, color: 0 });
    b.floor('plaza', 23, 10, 24, 11);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 36, zoom: 5.5, target: [17, 2, 11] },
    { name: 'back', yaw: 225, pitch: 36, zoom: 5.5, target: [17, 2, 11] },
    { name: 'close', yaw: 45, pitch: 34, zoom: 11, target: [14.5, 2, 11.2] },
    { name: 'railed', yaw: 45, pitch: 34, zoom: 10, target: [24.5, 3, 11.2] },
  ],
  expect(_plan, _dressing, check) {
    check.noFeature({ type: 'coping', on: [8, 1, 10] });
    // Fenced all round: the eight outer sides of the four cells.
    check.equal(check.features({ type: 'coping', on: [13, 1, 10] }).length, 8, 'coped sides of the fenced terrace');
    const south = check.hasFeature({ type: 'coping', on: [18, 1, 10] }, 2);
    check.ok(south.every((f) => f.dir === 2), 'only the fenced south side is coped');
    // J19 rails the paved terrace's drop sides; each railed side is coped, so nothing is doubled.
    const rails = check.hasFeature({ type: 'railing', rule: 'J19.edge-railing' }, 1).filter((f) => f.cell! >> 12 === 3);
    check.equal(check.features({ type: 'coping', on: [23, 1, 10] }).length, rails.length, 'coped sides of the railed terrace');
    for (const r of rails) check.hasFeature({ type: 'coping', at: [r.cell! & 63, 2, (r.cell! >> 6) & 63], dir: r.dir });
  },
});
