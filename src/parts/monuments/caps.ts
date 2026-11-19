// Tower tops. Each is drawn round the local origin, which is the centre of
// the top of the tower's body (the top of its highest cell), and returns the
// local frames of the sockets a cap owns: 'tower-top' and 'flag-mount'.
//
// `r` is the body's radius (round towers) or half-width (square towers) at
// the top.

import { rotationY, translation, type Mat4Like } from '@/core/mat4';
import { PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { MONUMENTS } from '@/style/monuments';
import { PALETTE } from '@/style/palette';
import { around, ball, TAU } from './kit';

export interface CapLook {
  stone: ColorInput;
  roof: ColorInput;
  /** 0–1, seeded per tower: small differences in rise and overhang. */
  vary: number;
}

type Sockets = Record<string, Mat4Like>;
const tip = (y: number): Sockets => ({ 'tower-top': translation(0, y, 0), 'flag-mount': translation(0, y, 0) });

/** A finial: a little stem and ball, where a flag's pole stands. */
function finial(b: MeshBuilder, y: number, color: ColorInput = PALETTE.yellow): number {
  b.with({ color, pattern: PATTERN.none, ink: 'finial' }, () => {
    b.lathe([[0.022, y - 0.03], [0.016, y + 0.05]], { segments: 6 });
    ball(b, 0, y + 0.075, 0, 0.04, 0.04, 8);
  });
  return y + 0.115;
}

/** The corbel table under a round roof: the wall swells out to carry the eave. */
function roundCorbel(b: MeshBuilder, r: number, out: number, drop = 0.13): void {
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'corbel' }, () =>
    b.lathe(
      [
        [r, -drop],
        [r + out * 0.55, -drop * 0.55],
        [r + out, -drop * 0.3],
        [r + out, 0],
      ],
      { segments: 18 },
    ),
  );
}

/** Watchtower: a cone roof with a bell-cast eave on a corbel table. */
export function coneCap(b: MeshBuilder, r: number, look: CapLook, rise = MONUMENTS.coneRise): Sockets {
  const out = 0.05;
  roundCorbel(b, r, out);
  const eave = r + MONUMENTS.towerEave + look.vary * 0.02;
  const h = rise * (0.94 + look.vary * 0.14);
  b.with({ color: look.roof, pattern: PATTERN.shingles, ink: 'roof' }, () =>
    b.lathe(
      [
        [r + out - 0.01, 0],
        [eave, -0.015],
        [eave, 0.03],
        [eave * 0.74, h * 0.2],
        [eave * 0.46, h * 0.5],
        [eave * 0.2, h * 0.8],
        [0, h],
      ],
      { segments: 18 },
    ),
  );
  return tip(finial(b, h - 0.01));
}

/** Dovecote: a low cone with a little open lantern where the birds go in. */
export function dovecoteCap(b: MeshBuilder, r: number, look: CapLook): Sockets {
  const out = 0.04;
  roundCorbel(b, r, out, 0.1);
  const eave = r + MONUMENTS.towerEave;
  const h = 0.42;
  b.with({ color: look.roof, pattern: PATTERN.shingles, ink: 'roof' }, () =>
    b.lathe([[r + out - 0.01, 0], [eave, -0.015], [eave, 0.03], [eave * 0.6, h * 0.45], [0.13, h]], { segments: 18 }),
  );
  b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'lantern' }, () => {
    around(b, 6, 0.1, 0, () => b.boxAt([0, h - 0.01, 0], [0.035, 0.15, 0.035]));
    b.lathe([[0.13, h - 0.01], [0.13, h + 0.01]], { segments: 10 });
  });
  b.with({ color: look.roof, pattern: PATTERN.shingles, ink: 'lantern-roof' }, () =>
    b.lathe([[0.17, h + 0.13], [0.17, h + 0.15], [0, h + 0.33]], { segments: 10, capBottom: true }),
  );
  const sockets = tip(finial(b, h + 0.32));
  sockets.perch = translation(0, h + 0.02, 0.15);
  return sockets;
}

/** Castle turret: the wall flares out on corbels into a ring of merlons round a flat roof. */
export function battlementCap(b: MeshBuilder, r: number, look: CapLook): Sockets {
  const out = 0.075, wall = 0.085, parapet = 0.11, merlon = 0.13;
  const R = r + out;
  b.with({ color: look.stone, pattern: PATTERN.stone, ink: 'crown' }, () => {
    b.lathe(
      [
        [r, -0.2],
        [r + out * 0.5, -0.13],
        [R, -0.07],
        [R, parapet],
        [R - wall, parapet],
        [R - wall, 0.0],
        [0, 0.0],
      ],
      { segments: 16 },
    );
    // Eight merlons, each a slice of the same ring.
    const n = 8, sweep = (TAU / n) * 0.55;
    for (let i = 0; i < n; i++) {
      const start = (i / n) * TAU + look.vary;
      const ringAt = (rad: number, y: number, t: number): [number, number, number] => [rad * Math.cos(t), y, rad * Math.sin(t)];
      b.lathe([[R, parapet], [R, parapet + merlon], [R - wall, parapet + merlon], [R - wall, parapet]], { segments: 2, start, sweep });
      for (const [t, flip] of [[start, false], [start + sweep, true]] as const) {
        const a = ringAt(R, parapet, t), c = ringAt(R, parapet + merlon, t), d = ringAt(R - wall, parapet + merlon, t), e = ringAt(R - wall, parapet, t);
        if (flip) b.quad(a, c, d, e);
        else b.quad(e, d, c, a);
      }
    }
  });
  // A short flag staff rises from the middle of the roof.
  b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'staff' }, () => b.lathe([[0.02, 0], [0.014, 0.42]], { segments: 6, capTop: true }));
  return { 'tower-top': translation(0, 0.42, 0), 'flag-mount': translation(0, 0.42, 0), perch: translation(0, parapet + merlon, R - wall / 2) };
}

/** Observatory: a low drum and a dome with a dark observing slit. */
export function domeCap(b: MeshBuilder, r: number, look: CapLook): Sockets {
  const R = r + 0.035;
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'drum' }, () =>
    b.lathe([[r, -0.08], [R + 0.03, -0.04], [R + 0.03, 0.05], [R, 0.05]], { segments: 18 }),
  );
  const dome: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    dome.push([i === 6 ? 0 : R * Math.cos(a), 0.05 + R * 0.95 * Math.sin(a)]);
  }
  b.with({ color: look.roof, pattern: PATTERN.metal, ink: 'dome' }, () => b.lathe(dome, { segments: 18 }));
  // The slit: a dark band from the rim to just past the top, standing a hair proud of the dome.
  const turn = look.vary * TAU;
  b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'slit' }, () =>
    b.at(rotationY(turn), () => {
      for (let i = 0; i < 5; i++) {
        const a0 = (i / 5) * (Math.PI / 2) * 1.08 + 0.08, a1 = ((i + 1) / 5) * (Math.PI / 2) * 1.08 + 0.08;
        const p = (a: number, x: number): [number, number, number] => [x, 0.05 + (R * 0.95 + 0.012) * Math.sin(a), (R + 0.012) * Math.cos(a)];
        b.quad(p(a0, -0.055), p(a0, 0.055), p(a1, 0.055), p(a1, -0.055));
      }
    }),
  );
  const top = 0.05 + R * 0.95;
  return { 'tower-top': translation(0, top, 0), 'flag-mount': translation(0, top, 0), telescope: rotationY(turn) };
}

// ── square towers ──

/** A four-sided roof on a square tower: `eave` is its half-width at the foot. */
function pyramid(b: MeshBuilder, half: number, eave: number, rise: number, skirt: number): void {
  const k = Math.SQRT2;
  b.at(rotationY(Math.PI / 4), () =>
    b.lathe(
      skirt > 0
        ? [
            [half * k, 0],
            [eave * k, -0.02],
            [eave * k, 0.025],
            [half * 0.86 * k, skirt],
            [0, rise],
          ]
        : [
            [half * k, 0],
            [eave * k, -0.02],
            [eave * k, 0.025],
            [0, rise],
          ],
      { segments: 4, smooth: false },
    ),
  );
}

/** The cornice a square tower's roof sits on. */
function squareCornice(b: MeshBuilder, half: number): void {
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'cornice' }, () =>
    b.boxAt([0, -0.07, 0], [half * 2 + 0.08, 0.07, half * 2 + 0.08], { skip: ['top'] }),
  );
}

/** Steeple: a tall spire with a bell-cast skirt, a ball and a cross. */
export function spireCap(b: MeshBuilder, half: number, look: CapLook): Sockets {
  squareCornice(b, half);
  const rise = MONUMENTS.spireRise * (0.95 + look.vary * 0.12);
  b.with({ color: look.roof, pattern: PATTERN.shingles, ink: 'roof' }, () => pyramid(b, half, half + MONUMENTS.towerEave - 0.02, rise, 0.24));
  const y = rise - 0.02;
  b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'finial' }, () => {
    ball(b, 0, y + 0.03, 0, 0.045, 0.045, 8);
    b.boxAt([0, y + 0.06, 0], [0.03, 0.22, 0.03]);
    b.boxAt([0, y + 0.17, 0], [0.14, 0.03, 0.03]);
  });
  return tip(y + 0.28);
}

/** Clock tower, campanile: a pyramid roof. */
export function pyramidCap(b: MeshBuilder, half: number, look: CapLook): Sockets {
  squareCornice(b, half);
  const rise = MONUMENTS.pyramidRise * (0.95 + look.vary * 0.12);
  b.with({ color: look.roof, pattern: PATTERN.shingles, ink: 'roof' }, () => pyramid(b, half, half + MONUMENTS.towerEave, rise, 0));
  return tip(finial(b, rise - 0.015));
}

/** A tower cut short, or with something standing on it: a plain kerbed slab. */
export function flatCap(b: MeshBuilder, r: number, round: boolean): Sockets {
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'kerb' }, () => {
    if (round) b.lathe([[r, -0.06], [r + 0.04, -0.045], [r + 0.04, 0.03], [0, 0.03]], { segments: 18 });
    else b.boxAt([0, -0.06, 0], [r * 2 + 0.08, 0.09, r * 2 + 0.08], { skip: ['bottom'] });
  });
  return tip(0.03);
}
