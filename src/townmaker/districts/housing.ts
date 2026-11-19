// A housing block: two streets, two rows of houses back to back across a
// narrow back alley, front gardens between the houses and the streets.
//
//   v=0      street A                         lamps, street trees, bunting
//   v=1      front strip: grass or garden      U03 front gardens, kitchen gardens
//   v=2      row A                             row houses or townhouses
//   v=3..    the back alley (1 or 2 wide)      laundry lines (D05), back yards (U04)
//   v=g+3    row B (one house jettied)         row houses
//   v=g+4    front strip
//   v=g+5    street B
//
// The alley is closed at both ends by low wall pieces, so it is a leftover
// of the town. One end of row A is a single-storey annex with a roof
// terrace behind an iron railing. A townhouse row has two of its houses
// four storeys tall with an Auto-block sky bridge between them, over a
// passage from the street into the alley.

import { CLAIM } from '../grower';
import { search } from '../frame';
import { fits, rectFlat, startDistrict, fromSquare, type Town, Local } from '../town';
import { pave } from '../route';

export function buildHousing(town: Town, n: number, near: number): boolean {
  const { g } = town;
  const townRow = n % 2 === 0;
  const wantL = g.int(6, 9, 'housing-len', n);
  const wantGap = g.chance(0.5, 'housing-gap', n) ? 1 : 2;
  // The size wanted first, then smaller ones until one fits.
  const sizes: [number, number][] = [];
  for (let L = wantL; L >= 5; L--) for (const gp of wantGap === 2 ? [2, 1] : [1]) sizes.push([L, gp]);
  let found = null;
  let L = 0, gap = 0;
  for (const [len, gp] of sizes) {
    const depth = gp + 6;
    found = search(g, `housing${n}`, (f) => {
      if (!fits(g, f, 0, 0, len - 1, depth - 1)) return null;
      const h = rectFlat(g, f, 0, 0, len - 1, depth - 1);
      if (h < 0) return null;
      const d = fromSquare(town, f.x(len / 2, depth / 2), f.z(len / 2, depth / 2));
      if (d < 6) return null;
      return { score: Math.abs(d - near), data: h };
    });
    if (found) {
      L = len;
      gap = gp;
      break;
    }
  }
  if (!found) return false;
  const depth = gap + 6; // v = 0 … gap + 5
  const f = found.frame;
  const h = found.data;
  const T = new Local(g, f);
  const d = startDistrict(town, `housing${n}`, f.x(L / 2, depth / 2), f.z(L / 2, depth / 2));
  const vA = 2, vB = gap + 3, sB = gap + 5;
  T.claim(0, 1, L - 1, sB - 1, CLAIM.built);
  T.claim(-1, -1, L, depth, CLAIM.open);

  // Ground: the two streets, the front strips.
  for (let u = 0; u < L; u++) {
    pave(g, f.x(u, 0), f.z(u, 0));
    pave(g, f.x(u, sB), f.z(u, sB));
  }
  const bridgeAt = townRow && L >= 6 ? g.int(2, L - 4, 'bridge', n) : -1;
  const passage = (u: number): boolean => bridgeAt >= 0 && (u === bridgeAt + 1 || u === bridgeAt + 2);
  for (let u = 0; u < L; u++) {
    if (passage(u)) {
      for (let v = 1; v <= vA + gap; v++) pave(g, f.x(u, v), f.z(u, v));
      continue;
    }
    if (g.chance(0.5, 'front-a', n, u)) T.floor('garden', u, 1, h);
    if (g.chance(0.45, 'front-b', n, u)) T.floor('garden', u, vB + 1, h);
  }
  // Picket fences along some of the front gardens.
  for (let u = 0; u < L; u++) if (g.chance(0.35, 'picket', n, u) && !passage(u)) T.edge(u, h, 1, 0, 'fence');

  // Row A.
  for (let u = 0; u < L; u++) {
    if (passage(u)) continue;
    if (u === 0) {
      // The annex with the roof terrace, then the house it belongs to.
      const c = T.house(0, vA, 1, vA, 1, `annex${n}`);
      T.put('house', 1, h + 1, vA, c);
      T.floor('plaza', 0, vA, h + 1);
      T.edge(0, h + 1, vA, 0, 'fence');
      T.edge(0, h + 1, vA, 3, 'fence');
      T.edge(0, h + 1, vA, 2, 'fence');
      u = 1;
      continue;
    }
    let floors = 2;
    if (townRow) floors = u === bridgeAt || u === bridgeAt + 3 ? 4 : g.chance(0.5, 'tall', n, u) ? 3 : 4;
    else if (g.chance(0.2, 'tall', n, u)) floors = 3;
    T.house(u, vA, u, vA, floors, `rowA${n}-${u}`);
  }
  if (bridgeAt >= 0) {
    // Auto blocks between the two tall houses: a valid span, so they are an arch; houses at both ends, a sky bridge.
    T.put('auto', bridgeAt + 1, h + 2, vA, 'auto');
    T.put('auto', bridgeAt + 2, h + 2, vA, 'auto');
  }

  // Row B, one house jettied out over its front strip.
  const jetty = g.int(1, L - 2, 'jetty', n);
  for (let u = 0; u < L; u++) {
    const floors = g.chance(0.25, 'tallB', n, u) ? 3 : 2;
    const c = T.house(u, vB, u, vB, floors, `rowB${n}-${u}`);
    if (u === jetty) T.put('house', u, h + 1, vB + 1, c);
  }

  // Close the alley at both ends with low walls.
  for (let v = vA + 1; v < vB; v++) {
    T.put('wall', 0, h, v, 0);
    T.put('wall', L - 1, h, v, 0);
  }

  for (const [u, v] of [[0, 0], [L - 1, 0], [0, sB], [L - 1, sB]] as const) T.way(d, u, v);
  return true;
}
