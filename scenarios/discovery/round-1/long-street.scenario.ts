// Discovery round 1: a long single street of a linear village, with houses
// both sides at varying setbacks, empty plots, a player fencing plots and
// leaving gaps, a back lane that peters out, and a T junction to a church.
//
//   npm run shots -- disc1-long-street

import { scenario } from '@/scenario';
import { close, quarters, road } from './lib';

export default scenario({
  name: 'disc1-long-street',
  seed: 9110,
  about: 'Discovery: a long single street with fenced plots and gaps, empty plots, and a church at a T junction.',
  build(b) {
    road(b, [5, 22], [42, 22]);
    // North side: houses at the street, some set back behind a front yard, some missing.
    const north = [6, 8, 9, 11, 14, 15, 16, 20, 22, 26, 27, 28, 29, 33, 37, 40];
    north.forEach((x, i) => b.house(x, i % 3 === 0 ? 19 : 21, { floors: 1 + (i % 3), color: (i * 5) % 8 }));
    // South side.
    const south = [7, 10, 12, 13, 18, 19, 24, 25, 31, 32, 35, 36, 39];
    south.forEach((x, i) => b.house(x, 23, { floors: 1 + ((i + 1) % 3), color: (i * 3 + 1) % 8 }));
    // Fenced plots: a player fenced the backs of some south houses, with gaps.
    b.fenceAround(7, 24, 13, 27);
    b.fenceAround(18, 24, 19, 28);
    for (let x = 31; x <= 36; x++) if (x !== 33) b.fenceEdge(x, 27, 'S');
    b.fenceEdge(31, 24, 'W').fenceEdge(31, 25, 'W').fenceEdge(36, 24, 'E');
    // A garden plot fenced in front of a house (a fence on the street edge).
    for (const x of [29, 30]) b.fenceEdge(x, 21, 'N', 'fence', 1);
    // The T junction north to the church and its yard.
    road(b, [24, 21], [24, 14]);
    b.house(22, 11, { w: 3, d: 3, color: 0 });
    b.tower(25, 11, { floors: 4, color: 1 });
    b.fenceAround(20, 12, 21, 16, 'wall');
    // A back lane behind the north side that peters out.
    road(b, [8, 17], [18, 17]);
    // A well in the street's widening.
    b.path(30, 23, 30, 23);
    b.put('fountain', 30, 23);
    // Trees at the ends.
    b.put('tree', 4, 21).put('tree', 43, 23).put('tree', 12, 30).put('tree', 34, 14).put('tree', 36, 15);
  },
  cameras: [
    ...quarters([24, 1, 21], 1.8),
    close('west', 12, 1.3, 22, 45, 4),
    close('east', 33, 1.3, 22, 45, 4),
    close('fenced', 10, 1, 25.5, 225, 4.5),
    close('church', 23, 1.5, 14, 45, 4.5),
  ],
});
