// The castle: a square bailey on the highest flat ground that will take
// it. Four corner towers touching the curtain wall on two sides (turrets),
// wall pieces between them, a gatehouse (two marble piers either side of a
// gateway arch with the road through it) facing the town, a marble keep
// with a raised corner and a flying buttress, a basin in the bailey.
//
//   v=0     T W W W W W W T
//   v=1     W . K K . . . W         K keep (4 tall), B buttress at its west side
//   v=2     W B K K . . . W
//   v=3..   W . . | . f . W         | the road from the gate, f basin
//   v=S-1   T W W M A M W T         M gatehouse marble, A gateway arch
//                   road

import { CLAIM } from '../grower';
import { search } from '../frame';
import { fits, fromSquare, rectFlat, startDistrict, type Town, Local } from '../town';
import { pave } from '../route';

export function buildCastle(town: Town): boolean {
  const { g } = town;
  for (const S of [8, 7, 6]) {
    const m = Math.floor(S / 2);
    const found = search(g, `castle${S}`, (f) => {
      if (!fits(g, f, 0, 0, S - 1, S)) return null;
      const h = rectFlat(g, f, 0, 0, S - 1, S - 1);
      if (h < 0) return null;
      const out = g.h(f.x(m, S), f.z(m, S));
      if (out === 0 || Math.abs(out - h) > 1) return null;
      const dGate = fromSquare(town, f.x(m, S), f.z(m, S));
      const dBack = fromSquare(town, f.x(m, -1), f.z(m, -1));
      if (dGate < 8) return null;
      return { score: -h * 4 + dGate * 0.4 + (dGate > dBack ? 6 : 0), data: h };
    });
    if (!found) continue;
    const f = found.frame;
    const h = found.data;
    const C = new Local(g, f);
    const d = startDistrict(town, 'castle', f.x(m, m), f.z(m, m));
    C.claim(0, 0, S - 1, S - 1, CLAIM.built);
    C.claim(-1, -1, S, S + 1, CLAIM.open);

    // The road in through the gate to the keep.
    for (let v = S; v >= 4; v--) pave(g, f.x(m, v), f.z(m, v));
    // The turrets.
    const stone = C.color('tower', [[0, h, 0]], 'turret');
    for (const [u, v] of [[0, 0], [S - 1, 0], [0, S - 1], [S - 1, S - 1]] as const) C.stack('tower', u, v, 4, stone);
    // The curtain wall.
    for (let i = 1; i < S - 1; i++) {
      C.put('wall', i, h, 0, 0);
      C.put('wall', 0, h, i, 0);
      C.put('wall', S - 1, h, i, 0);
      if (i < m - 1 || i > m + 1) C.put('wall', i, h, S - 1, 0);
    }
    // The gatehouse: marble either side of a gateway arch the road runs through.
    const gate = (stone + 3) % 8;
    C.stack('marble', m - 1, S - 1, 2, gate);
    C.stack('marble', m + 1, S - 1, 2, gate);
    C.put('arch', m, h, S - 1, 0);
    // The keep, with a raised corner and a flying buttress off its west face.
    const keep = (stone + 5) % 8;
    for (let v = 1; v <= 2; v++) for (let u = m - 1; u <= m; u++) C.stack('marble', u, v, 4, keep);
    C.put('marble', m, h + 4, 1, keep);
    C.put('arch', m - 2, h + 3, 2, 0);
    // The bailey: a basin and a tree or two.
    C.put('fountain', m + 1, h, S - 3);
    if (S >= 7) C.put('tree', 1, h, S - 3, 0);
    C.put('tree', S - 2, h, 1, 0);
    C.way(d, m, S);
    return true;
  }
  return false;
}
