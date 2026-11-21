// The mill corner: a big windmill standing on the ground at the edge of
// town where it catches the wind, with the miller's house against it (R-H03:
// sacks and a cart by the door, D25's mill yard), two cottages on the lane,
// a little field of wheat beside the mill (R-G01: a garden within two of a
// windmill is wheat, on purpose), a kitchen garden, a well and a tree in the
// yard, and a picket fence along the yard's front with a gate where the
// lane comes in.
//
//   u: -1 0 1 2 3 4 5 6 7
//   v=0    . . . . . . . .
//   v=1    . H . . . w w .        H cottage, w wheat (fenced on its open sides)
//   v=2    . . . M W w w .        M the miller's house, W the windmill (three tall)
//   v=3    | . . . . w w .        | the picket fence along the front
//   v=4  = G = = = = = = =        G the gate (a fence piece on the lane)
//   v=5    | . C o . T . .        C cottage, o the well, T a tree
//   v=6    . . g g . . . .        g kitchen garden

import { columnIndex } from '@/core/grid';
import { CLAIM } from '../grower';
import { search } from '../frame';
import { fits, fromSquare, rectFlat, startDistrict, type Town, Local } from '../town';
import { pave } from '../route';

export function buildMillCorner(town: Town, n: number, near = 12): boolean {
  const { g, site } = town;
  const found = search(g, `mill-corner${n}`, (f) => {
    if (!fits(g, f, -1, 0, 7, 6)) return null;
    const h = rectFlat(g, f, 0, 0, 7, 6);
    if (h < 0 || g.h(f.x(-1, 4), f.z(-1, 4)) === 0 || Math.abs(g.h(f.x(-1, 4), f.z(-1, 4)) - h) > 1) return null;
    if (site.waterDist[columnIndex(f.x(4, 3), f.z(4, 3))]! < 2) return null;
    const d = fromSquare(town, f.x(4, 3), f.z(4, 3));
    if (d < 8) return null;
    // At the edge of town, on high ground where the wind is.
    return { score: Math.abs(d - near) - h * 1.5, data: h };
  });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const M = new Local(g, f);
  const d = startDistrict(town, `mill-corner${n}`, f.x(4, 3), f.z(4, 3));
  M.claim(0, 0, 7, 6, CLAIM.built);

  // The ground: the lane through the gateway, the wheat, the kitchen garden.
  for (let u = -1; u <= 7; u++) pave(g, f.x(u, 4), f.z(u, 4));
  for (let v = 1; v <= 3; v++) for (let u = 5; u <= 6; u++) M.floor('garden', u, v, h);
  for (let u = 2; u <= 3; u++) M.floor('garden', u, 6, h);
  for (let u = 5; u <= 6; u++) M.edge(u, h, 1, 0, 'fence');
  for (let v = 1; v <= 3; v++) M.edge(6, h, v, 1, 'fence');

  // The mill, three tall, and the miller's house against it; the cottages.
  M.stack('windmill', 4, 2, 3, 0);
  M.house(3, 2, 3, 2, 2, `miller${n}`);
  M.house(1, 1, 1, 1, 2, `mill-cottage-a${n}`);
  M.house(2, 5, 2, 5, 1 + (g.chance(0.5, 'mill-cottage', n) ? 1 : 0), `mill-cottage-b${n}`);

  // The yard: a well and a tree.
  if (!town.pumps) M.put('fountain', 3, h, 5, 0);
  M.put('tree', 5, h, 5, 0);

  // The yard's front: a picket fence with a gate where the lane comes in (J20: a fence piece on a path is a
  // gate). (A lone stone arch over the lane is drawn as a castle gate, battlements and all: wrong here.)
  for (const v of [2, 3, 4, 5, 6]) M.put('fence', 0, h, v, 0);

  M.way(d, -1, 4);
  M.way(d, 7, 4);
  return true;
}
