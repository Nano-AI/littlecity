// One bay of a town hall's arcade (U11): a covered walk in front of the
// ground storey on the square. Stone piers on the cell lines carry a shallow
// arch and a cornice that reaches back to the wall, so the walk under it is
// in real shade (ART.md section 11). The bays of one arcade share one ink id
// (the hall's own 'arcade' group), so a run of bays is one object with no
// seam at each pier.
//
// Frame: the wall plane (lib.ts). `left`/`right` = 1 where the arcade ends
// at that side of the bay: a whole pier closes it there (else half a pier,
// and the next bay draws the other half).

import { CELL_H } from '@/core/grid';
import { definePart } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { HOUSE } from '@/style/houses';
import { PALETTE } from '@/style/palette';

export default definePart({
  feature: 'arcade',
  build(item, ctx) {
    const b = ctx.mesh();
    const id = ctx.structure?.id ?? 0;
    // The hall's own group: every bay of its arcade draws one surface.
    const host = new MeshBuilder({ ink: id });
    b.setInkId(host.inkOf('arcade'));
    b.setColor(PALETTE.stoneShade).setPattern(PATTERN.stone);
    const inset = HOUSE.inset;
    const depth = 0.16; // from the wall to the arcade’s face (its cornice reaches 0.12 past the cell line)
    const pier = 0.065; // half a pier's width
    const spring = 0.4, rise = 0.15, top = CELL_H - 0.08, cap = CELL_H - 0.02;
    const left = item.params?.left === 1, right = item.params?.right === 1;
    // The bay reaches from cell line to cell line, i.e. `inset` past the wall's own ends.
    const xl = -0.5 - (left ? inset : 0), xr = 0.5 + (right ? inset : 0);
    const pl = left ? xl + 2 * pier : xl + pier, pr = right ? xr - 2 * pier : xr - pier;
    // Piers: from the ground to the springing, at both ends of the bay.
    const pierBox = (x0: number, x1: number, capL: boolean, capR: boolean): void => {
      const skip: ('n' | 'bottom' | 'top' | 'e' | 'w')[] = ['n', 'bottom', 'top'];
      if (!capL) skip.push('w');
      if (!capR) skip.push('e');
      b.box([x0, 0, depth - 0.12], [x1, spring, depth], { skip });
    };
    pierBox(xl, pl, left, true);
    pierBox(pr, xr, true, right);
    // The arch face: a strip between the arch curve and the cornice, in front.
    const n = 10;
    const w = (pr - pl) / 2, cx = (pl + pr) / 2;
    const archY = (x: number): number => spring + rise * Math.sqrt(Math.max(0, 1 - ((x - cx) / w) ** 2));
    const xs: number[] = [xl, pl];
    for (let i = 1; i < n; i++) xs.push(pl + ((pr - pl) * i) / n);
    xs.push(pr, xr);
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = xs[i]!, c = xs[i + 1]!;
      const ya = a <= pl || a >= pr ? spring : archY(a), yc = c <= pl || c >= pr ? spring : archY(c);
      b.quad([a, ya, depth], [c, yc, depth], [c, top, depth], [a, top, depth]);
      // The soffit under the arch, back to the piers' depth: the walk's ceiling.
      if (a >= pl && c <= pr) b.quad([c, yc, depth], [a, ya, depth], [a, ya, depth - 0.12], [c, yc, depth - 0.12]);
    }
    // The cornice: a slab over the whole bay, reaching back to the wall (the covered walk's roof).
    b.with({ color: PALETTE.white, pattern: PATTERN.none, inkId: host.inkOf('arcade-cornice') }, () => {
      const skip: ('n' | 'e' | 'w' | 'bottom')[] = ['n', 'bottom'];
      if (!left) skip.push('w');
      if (!right) skip.push('e');
      b.box([xl, top, 0], [xr, cap, depth + 0.03], { skip });
      // Its underside only in front of the walk's ceiling, which lies in the same plane.
      b.quad([xr, top, depth + 0.03], [xl, top, depth + 0.03], [xl, top, depth - 0.12], [xr, top, depth - 0.12]);
    });
    // The ceiling of the walk, from the arch back to the wall.
    b.quad([xr, top, depth - 0.12], [xl, top, depth - 0.12], [xl, top, 0], [xr, top, 0]);
    return { mesh: b.build() };
  },
});
