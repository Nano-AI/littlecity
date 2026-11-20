// The forum: the marble city's heart, a monumental ensemble composed on one
// axis. From the north: a belvedere terrace (a bare marble terrace two high,
// U23 lays its citrus pots and pergola), the temple on its podium (R-M01 on
// R-M08, shops in the podium's walls where the forum runs along them, U16),
// a grand stair down to the forum (guardians at its head, lamps at its foot,
// D39), the forum itself (a great plaza: an obelisk or victory column on the
// axis, statues on plinths flanking the stair, a bandstand, a fountain,
// stalls), a stoa closing its east side (R-M12), a theatre facing it from
// the west (R-M09), the town hall and an inn on its south side.
//
//   u:   -4..-1  0 ............................ W-1  W W+1 W+2
//   v=0..2                 B B B B B                         B belvedere (2 high)
//   v=4..                P P P P P P P                       P podium (3 high), T temple on it
//              s s s     P P T T T P P     s s s             s plaza strips (shops in the wall)
//   v=…                    S S S S S                         S grand stair (rows 2, 1 high)
//   forum  T T  F F F F F F F F F F F F F F F  .  o o         F forum plaza, O obelisk, o stoa
//          h h  F F F F F F F O F F F F F F F  .  o o         h theatre tiers facing the forum
//   south               H H H H     I I I                    H town hall, I inn
//
// Every part beyond the podium, stair and forum is optional: each is built
// only where its own ground is flat and free, so a smaller site still gets a
// complete composition, only a plainer one.

import { CLAIM } from '../grower';
import { search, type Frame } from '../frame';
import { fits, rectFlat, rectFree, startDistrict, type Town, Local } from '../town';
import { pave } from '../route';

interface Size {
  /** Podium width (u) and depth (v); the forum's width and depth. */
  pw: number;
  pd: number;
  fw: number;
  fd: number;
}
const SIZES: readonly Size[] = [
  { pw: 7, pd: 7, fw: 17, fd: 7 },
  { pw: 7, pd: 6, fw: 15, fd: 6 },
  { pw: 5, pd: 5, fw: 13, fd: 6 },
];

export function buildForum(town: Town): boolean {
  const { g, site } = town;
  for (const size of SIZES) {
    const { pw, pd, fw, fd } = size;
    const p0 = 4; // podium's first row
    const s0 = p0 + pd; // stair rows s0, s0 + 1
    const f0 = s0 + 2; // forum's first row
    const f1 = f0 + fd - 1;
    const found = search(g, `forum${pw}${pd}${fw}`, (f) => {
      if (!fits(g, f, 0, p0, fw - 1, f1)) return null;
      const h = rectFlat(g, f, 0, p0, fw - 1, f1);
      if (h < 0) return null;
      const cx = f.x(fw / 2, f0), cz = f.z(fw / 2, f0);
      const water = site.waterDist[Math.round(cx) + Math.round(cz) * 48]!;
      if (water < 3) return null;
      const d = Math.abs(cx - site.centre[0]) + Math.abs(cz - site.centre[1]);
      // Room for the theatre, the stoa and the hall counts in its favour.
      let extras = 0;
      if (rectFree(g, f, -4, f0, -1, f1) && rectFlat(g, f, -4, f0, -1, f1) === h) extras += 6;
      if (rectFree(g, f, fw, f0, fw + 2, f1) && rectFlat(g, f, fw, f0, fw + 2, f1) === h) extras += 5;
      if (rectFree(g, f, 0, f1 + 1, fw - 1, f1 + 3)) extras += 4;
      // Facing the default camera (from the south-east): the stair and the forum toward it.
      const facing = f.r === 0 || f.r === 3 ? -12 : 0;
      return { score: d * 0.6 - extras + (h > 2 ? 3 : 0) - pw + facing, data: h };
    });
    if (!found) continue;
    composeForum(town, found.frame, found.data, size);
    return true;
  }
  return false;
}

function composeForum(town: Town, f: Frame, h: number, size: Size): void {
  const { g } = town;
  const { pw, pd, fw, fd } = size;
  const F = new Local(g, f);
  const c = Math.floor(fw / 2); // the axis
  const p0 = 4, s0 = p0 + pd, f0 = s0 + 2, f1 = f0 + fd - 1;
  const pu0 = c - Math.floor(pw / 2), pu1 = pu0 + pw - 1;
  town.square = { x: f.x(c, f0 + 1), z: f.z(c, f0 + 1), h };
  const d = startDistrict(town, 'square', town.square.x, town.square.z);
  F.claim(0, p0, fw - 1, f1, CLAIM.built);

  const stone = F.color('marble', [[pu0, h, p0]], 'podium');
  const tint = (n: number): number => (stone + n) % 8;

  // ── the ground: the forum, the strips along the podium, the ways in ──
  for (let v = f0; v <= f1; v++) for (let u = 0; u < fw; u++) F.floor('plaza', u, v, h);
  const strip = (u0: number, u1: number): void => {
    for (let v = p0; v < f0; v++) for (let u = u0; u <= u1; u++) if (u >= 0 && u < fw) F.floor('plaza', u, v, h);
  };
  strip(pu0 - 3, pu0 - 1);
  strip(pu1 + 1, pu1 + 3);
  for (const [u, v] of [[0, f1 + 1], [fw - 1, f1 + 1], [pu0 - 3, p0 - 1], [pu1 + 3, p0 - 1]] as const) {
    if (pave(g, f.x(u, v), f.z(u, v))) F.way(d, u, v);
  }

  // ── the podium, 3 high, and its grand stair down to the forum ──
  for (let v = p0; v < s0; v++) for (let u = pu0; u <= pu1; u++) F.stack('marble', u, v, 3, stone);
  for (let u = pu0 + 1; u <= pu1 - 1; u++) {
    F.stack('marble', u, s0, 2, stone);
    F.stack('marble', u, s0 + 1, 1, stone);
  }

  // ── the temple on the podium: three wide, pillars two high, facing down the axis ──
  const tu0 = c - 1, tu1 = c + 1;
  const tv0 = p0 + 1, tv1 = s0 - 1 - (pd >= 7 ? 1 : 0);
  const top = h + 3;
  for (let v = tv0; v <= tv1; v += 2) for (const u of [tu0, tu1]) {
    F.put('pillar', u, top, v, 0);
    F.put('pillar', u, top + 1, v, 0);
  }
  if ((tv1 - tv0) % 2 === 1) for (const u of [tu0, tu1]) {
    F.put('pillar', u, top, tv1, 0);
    F.put('pillar', u, top + 1, tv1, 0);
  }
  for (let v = tv0; v <= tv1; v++) for (let u = tu0; u <= tu1; u++) F.put('marble', u, top + 2, v, tint(2));

  // ── on the forum: the obelisk on the axis, statues flanking the stair, a fountain, stalls ──
  F.stack('marble', c, f0 + Math.floor(fd / 2) + 1, 5, tint(4));
  for (const u of [pu0, pu1]) F.put('marble', u, h, f0, tint(6));
  if (!town.pumps) F.put('fountain', fw - 3, h, f0 + 2);
  F.put('stall', 2, h, f1);
  F.put('stall', fw - 3, h, f1);
  for (const u of [1, fw - 2]) F.put('tree', u, h, f0, 0);

  // ── a bandstand on the forum ──
  const bu = 2, bv = f0 + 2;
  if (fd >= 6) {
    for (const [u, v] of [[bu, bv], [bu + 1, bv], [bu, bv + 1], [bu + 1, bv + 1]] as const) {
      F.put('pillar', u, h, v, 0);
      F.put('pillar', u, h + 1, v, 0);
    }
    for (const [u, v] of [[bu, bv], [bu + 1, bv], [bu, bv + 1], [bu + 1, bv + 1]] as const) F.put('marble', u, h + 2, v, tint(5));
  }

  // ── the stoa closing the east side, a cell off the forum ──
  if (rectFree(g, f, fw, f0, fw + 2, f1) && rectFlat(g, f, fw, f0, fw + 2, f1) === h) {
    F.claim(fw, f0, fw + 2, f1, CLAIM.built);
    for (let v = f0; v <= f1; v++) F.stack('pillar', fw + 1, v, 2, 0);
    for (let v = f0; v <= f1; v++) for (const u of [fw + 1, fw + 2]) F.put('marble', u, h + 2, v, tint(3));
  }

  // ── the theatre facing the forum from the west ──
  if (rectFree(g, f, -4, f0, -1, f1) && rectFlat(g, f, -4, f0, -1, f1) === h && fd >= 6) {
    F.claim(-4, f0, -1, f1, CLAIM.built);
    const r0 = f0 + 1, r1 = f1 - 1;
    for (let tier = 1; tier <= 4; tier++) for (let v = r0; v <= r1; v++) F.stack('marble', -tier, v, tier, tint(1));
    for (let tier = 1; tier <= 3; tier++) for (const v of [f0, f1]) F.stack('marble', -tier, v, tier, tint(1));
  }

  // ── the belvedere terrace behind the temple ──
  if (rectFree(g, f, pu0 + 1, 0, pu1 - 1, 2) && rectFlat(g, f, pu0 + 1, 0, pu1 - 1, 2) === h) {
    F.claim(pu0 + 1, 0, pu1 - 1, 2, CLAIM.built);
    for (let v = 0; v <= 2; v++) for (let u = pu0 + 1; u <= pu1 - 1; u++) F.stack('marble', u, v, 2, tint(7));
  }

  // ── the town hall and the inn on the south side ──
  if (rectFree(g, f, 0, f1 + 1, fw - 1, f1 + 3)) {
    const hall = Math.max(2, Math.floor(fw / 4));
    if (rectFlat(g, f, c - hall - 1, f1 + 1, c - 2, f1 + 2) === h) F.house(c - hall - 1, f1 + 1, c - 2, f1 + 2, 2, 'forum-hall');
    if (rectFlat(g, f, c + 2, f1 + 1, c + 4, f1 + 2) === h) F.house(c + 2, f1 + 1, c + 4, f1 + 2, 2, 'forum-inn');
    F.claim(c - hall - 1, f1 + 1, c + 4, f1 + 2, CLAIM.built);
    for (let u = 0; u < fw; u++) if (u < c - hall - 1 || (u > c - 2 && u < c + 2) || u > c + 4) pave(g, f.x(u, f1 + 1), f.z(u, f1 + 1));
  }
  // A clock tower by the forum's corner, touching no house.
  if (g.free(f.x(fw, f0 - 1), f.z(fw, f0 - 1)) && g.h(f.x(fw, f0 - 1), f.z(fw, f0 - 1)) === h) {
    F.stack('tower', fw, f0 - 1, 5, F.color('tower', [[fw, h, f0 - 1]], 'forum-clock'));
    F.mark(fw, f0 - 1, CLAIM.built);
  }
}
