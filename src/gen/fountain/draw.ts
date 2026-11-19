// The four fountains (R-F01), each drawn standing on the local origin (the
// centre of its cell's floor). Not a generator file: fountain.gen.ts picks
// one by the structure's role and places it.
//
// Each returns the local frames of the sockets R-F01 declares for it, keyed
// by socket name (src/rules/roles/ground-props.ts).
//
// Water. A pool is a flat sheet with PATTERN.water. The renderer draws
// shallows and a lapping foam ring from the `edge` attribute (the distance
// to the shore), so the big basins pass the distance to their rim and get a
// ring that moves for free; small dishes pass a constant (pale, still water)
// and the well leaves it far (deep, dark). Falling water is PATTERN.water on
// a side face, which the renderer streaks downward.

import { frame, translation, type Mat4, type Vec3 } from '@/core/mat4';
import { EDGE_FAR, PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { lump, mixColor, mound, TONE, tube, type Rng } from '@/parts/ground/kit';
import { PALETTE, RAMPS } from '@/style/palette';
import { FOUNTAIN } from '@/style/props';

export type FountainAnchors = Record<string, Mat4>;

const UP: Vec3 = [0, 1, 0];
/** A frame whose +Y points level along (dx, dz): where a spout or a lip sends its water. */
function spoutFrame(x: number, y: number, z: number, dx: number, dz: number): Mat4 {
  return frame([x, y, z], [-dz, 0, dx], [dx, 0, dz], UP);
}
/** A frame with +Y up and +Z level along (dx, dz): a perch on a rim, facing out. */
function rimFrame(x: number, y: number, z: number, dx: number, dz: number): Mat4 {
  return frame([x, y, z], [dz, 0, -dx], UP, [dx, 0, dz]);
}

/** Water in the air: nearly white, a breath of blue so it stands off pale stone. */
const WATER_WHITE = mixColor(PALETTE.foam, PALETTE.shallow, 0.45);
/** `edge` for pale still water with no shore marks (see the header). */
const STILL = 0.22;

/** A pool of water: a disc at height y. `shore`: 'ring' laps at the rim, 'still' is pale and calm, 'deep' is dark. */
function pool(b: MeshBuilder, ink: string, y: number, radius: number, segments: number, shore: 'ring' | 'still' | 'deep', start = 0): void {
  const centre = shore === 'ring' ? radius : shore === 'still' ? STILL : EDGE_FAR;
  const rim = shore === 'ring' ? 0 : centre;
  b.with({ color: PALETTE.shallow, pattern: PATTERN.water, ink }, () => {
    for (let j = 0; j < segments; j++) {
      const t0 = start + (j / segments) * Math.PI * 2, t1 = start + ((j + 1) / segments) * Math.PI * 2;
      b.tri([0, y, 0], [radius * Math.cos(t1), y, radius * Math.sin(t1)], [radius * Math.cos(t0), y, radius * Math.sin(t0)], { edge: [centre, rim, rim] });
    }
  });
}

/** The tint of a fountain's stone for a palette index (the paint tool works on fountains too). */
export function stoneOf(color: number): string {
  const ramp = RAMPS.stone;
  return ramp[((color % ramp.length) + ramp.length) % ramp.length]!;
}

// ───────────────────────────────────────────────────── tiered fountain ──

/**
 * In a square: a wide round basin, a stem, an upper bowl spilling into the
 * basin in a few tongues of water, and a bud finial. About 0.77 tall.
 */
export function tieredFountain(b: MeshBuilder, r: Rng, stone: ColorInput): FountainAnchors {
  const R = FOUNTAIN.basinRadius, H = FOUNTAIN.basinHeight;
  const br = FOUNTAIN.bowlRadius, bh = FOUNTAIN.bowlHeight, top = FOUNTAIN.height;
  const wy = H - 0.055; // the basin's water level
  const seg = 16;
  const twist = r('twist') * 0.4;
  b.with({ color: PALETTE.stoneShade, ink: 'step' }, () => b.lathe([[R + 0.03, 0], [R + 0.03, 0.045], [R - 0.01, 0.045]], { segments: seg, start: twist }));
  b.with({ color: stone, pattern: PATTERN.stone, ink: 'basin' }, () =>
    b.lathe([[R - 0.01, 0.045], [R, 0.045 + (H - 0.09) * 0.5], [R - 0.02, H - 0.045]], { segments: seg, start: twist }),
  );
  b.with({ color: PALETTE.stoneShade, ink: 'rim' }, () =>
    b.lathe([[R - 0.02, H - 0.045], [R + 0.015, H - 0.045], [R + 0.015, H], [R - 0.07, H], [R - 0.07, H - 0.06]], { segments: seg, start: twist }),
  );
  pool(b, 'water', wy, R - 0.068, seg, 'ring', twist);

  // The stem and the upper bowl are one piece of carved stone.
  b.with({ color: stone, ink: 'stem' }, () =>
    b.lathe(
      [[0.13, wy - 0.02], [0.13, wy + 0.045], [0.075, wy + 0.085], [0.058, bh - 0.14], [0.1, bh - 0.1], [br - 0.015, bh - 0.03], [br, bh], [br - 0.045, bh], [br - 0.06, bh - 0.025]],
      { segments: 12, start: twist },
    ),
  );
  pool(b, 'water2', bh - 0.02, br - 0.055, 12, 'still', twist);
  b.with({ color: stone, ink: 'finial' }, () => {
    b.lathe([[0.045, bh - 0.03], [0.035, top - 0.13], [0.062, top - 0.11], [0.062, top - 0.09], [0.03, top - 0.075]], { segments: 8 });
    lump(b, 0, top - 0.046, 0, 0.042, 0.046, 0.042, { seg: 8, rings: 3 });
  });

  const anchors: FountainAnchors = {
    pool: translation(0, wy, 0),
    bowl: translation(0, bh - 0.02, 0),
    top: translation(0, top, 0),
  };
  // Water spilling over the upper bowl's lip into the basin: a few plump arcs, splaying outward.
  // (Straight threads of water read as rods holding the bowl up; a full veil reads as a lampshade.)
  const n = Math.round(FOUNTAIN.falls);
  const a0 = r('falls') * 6.28;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * Math.PI * 2 + (r('fall', k) - 0.5) * 0.25;
    const dx = Math.cos(a), dz = Math.sin(a);
    const reach = 0.075 + r('reach', k) * 0.02;
    const at = (d: number, y: number): Vec3 => [dx * d, y, dz * d];
    b.with({ color: WATER_WHITE, pattern: PATTERN.foam, ink: 'falls' }, () =>
      tube(b, [at(br - 0.02, bh - 0.012), at(br + reach * 0.55, bh - 0.03), at(br + reach * 0.95, bh - 0.15), at(br + reach, wy)], [0.022, 0.026, 0.03, 0.036], { seg: 5 }),
    );
    anchors[`rim${k}`] = spoutFrame(br * dx, bh, br * dz, dx, dz);
  }
  return anchors;
}

// ──────────────────────────────────────────────────────── small basin ──

/**
 * Anywhere else: a low eight-sided basin with a square pier in the middle, a
 * ball on top, and two spouts playing into the water. About 0.58 tall.
 */
export function smallBasin(b: MeshBuilder, r: Rng, stone: ColorInput): FountainAnchors {
  const R = FOUNTAIN.smallRadius, ph = FOUNTAIN.pierHeight;
  const flat = { segments: 8, smooth: false, start: Math.PI / 8 } as const;
  const wy = 0.175;
  b.with({ color: PALETTE.stoneShade, ink: 'step' }, () => b.lathe([[R + 0.025, 0], [R + 0.025, 0.04], [R - 0.005, 0.04]], flat));
  b.with({ color: stone, pattern: PATTERN.stone, ink: 'basin' }, () => b.lathe([[R - 0.005, 0.04], [R - 0.005, 0.17]], flat));
  b.with({ color: PALETTE.stoneShade, ink: 'rim' }, () =>
    b.lathe([[R - 0.005, 0.17], [R + 0.02, 0.17], [R + 0.02, 0.215], [R - 0.07, 0.215], [R - 0.07, 0.16]], flat),
  );
  pool(b, 'water', wy, R - 0.068, 8, 'ring', Math.PI / 8);
  b.with({ color: stone, pattern: PATTERN.stone, ink: 'pier' }, () => b.boxAt([0, wy - 0.02, 0], [0.15, ph - wy + 0.02, 0.15], { skip: ['bottom', 'top'] }));
  b.with({ color: PALETTE.stoneShade, ink: 'cap' }, () => b.boxAt([0, ph, 0], [0.21, 0.04, 0.21]));
  b.with({ color: stone, ink: 'ball' }, () => lump(b, 0, ph + 0.04 + 0.052, 0, 0.056, 0.056, 0.056, { seg: 10, rings: 5 }));

  // Two spouts on opposite faces of the pier (which two is seeded), each playing an arc into the pool.
  const alongX = r('axis') < 0.5;
  const ys = ph - 0.1 + (r('spout') - 0.5) * 0.03;
  const anchors: FountainAnchors = { pool: translation(0, wy, 0) };
  for (let k = 0; k < 2; k++) {
    const sgn = k === 0 ? 1 : -1;
    const dx = alongX ? sgn : 0, dz = alongX ? 0 : sgn;
    const at = (d: number, y: number): Vec3 => [dx * d, y, dz * d];
    b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'spouts' }, () => tube(b, [at(0.07, ys), at(0.135, ys)], 0.024, { seg: 6, capEnd: true }));
    b.with({ color: WATER_WHITE, pattern: PATTERN.foam, ink: 'jets' }, () =>
      tube(b, [at(0.13, ys), at(0.19, ys - 0.02), at(0.235, ys - 0.085), at(0.255, wy)], [0.022, 0.027, 0.03, 0.034], { seg: 6 }),
    );
    anchors[`spout${k}`] = spoutFrame(dx * 0.135, ys, dz * 0.135, dx, dz);
  }
  return anchors;
}

// ─────────────────────────────────────────────────────────── birdbath ──

/** On a garden: a slim pedestal and a shallow dish of water, with a few flowers at its foot. */
export function birdbath(b: MeshBuilder, r: Rng, stone: ColorInput): FountainAnchors {
  const d = FOUNTAIN.dishRadius, h = FOUNTAIN.dishHeight;
  b.with({ color: stone, ink: 'bath' }, () =>
    b.lathe(
      [[0.14, 0], [0.14, 0.035], [0.09, 0.05], [0.05, 0.09], [0.04, h - 0.17], [0.07, h - 0.11], [d - 0.015, h - 0.045], [d, h - 0.012], [d, h], [d - 0.035, h], [d - 0.05, h - 0.022]],
      { segments: 12, start: r('twist') },
    ),
  );
  pool(b, 'water', h - 0.018, d - 0.046, 12, 'still');
  // Flowers round the foot: three little clumps, each a flat mass of leaf with a flat mass of colour on it.
  const blooms = [PALETTE.pink, PALETTE.yellow, PALETTE.white, PALETTE.red];
  const a0 = r('a0') * 6.28;
  for (let i = 0; i < 3; i++) {
    const a = a0 + i * 2.1 + (r('fa', i) - 0.5) * 0.7, dist = 0.2 + r('fd', i) * 0.08;
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist, size = 0.05 + r('fs', i) * 0.02;
    b.with({ color: PALETTE.leafDark, pattern: PATTERN.leaves, ink: 'flowers', sway: 0.15 }, () => mound(b, x, 0.015, z, size * 1.7, size * 1.1, size * 1.7, { seg: 6, rings: 2, normal: TONE.mid }));
    b.with({ color: blooms[Math.floor(r('fc', i) * blooms.length)]!, ink: 'flowers', sway: 0.2 }, () => {
      for (let k = 0; k < 2; k++) {
        const ba = a + 1.2 + k * 2.6, bd = size * 0.75;
        lump(b, x + Math.cos(ba) * bd, 0.015 + size * (1.0 - k * 0.2), z + Math.sin(ba) * bd, size * 0.62, size * 0.42, size * 0.62, { seg: 5, rings: 2, normal: TONE.lit, twist: ba });
      }
    });
  }
  const pa = r('perch') * 6.28;
  return {
    pool: translation(0, h - 0.018, 0),
    rim: rimFrame(Math.cos(pa) * (d - 0.018), h, Math.sin(pa) * (d - 0.018), Math.cos(pa), Math.sin(pa)),
  };
}

// ─────────────────────────────────────────────────────────────── well ──

/**
 * In a courtyard: a round stone well under a little shingled roof on two
 * posts, with a windlass, a coil of rope and a bucket hanging in its mouth.
 * The posts stand along local x; the caller turns it. About 0.88 tall.
 */
export function well(b: MeshBuilder, r: Rng, stone: ColorInput): FountainAnchors {
  const R = FOUNTAIN.wellRadius, H = FOUNTAIN.wellHeight, top = FOUNTAIN.wellRoof;
  const seg = 14;
  b.with({ color: stone, pattern: PATTERN.stone, ink: 'ring' }, () => b.lathe([[R, 0], [R + 0.01, H * 0.4], [R - 0.01, H - 0.045]], { segments: seg }));
  b.with({ color: PALETTE.stoneShade, ink: 'coping' }, () =>
    b.lathe([[R - 0.01, H - 0.045], [R + 0.03, H - 0.045], [R + 0.03, H], [R - 0.07, H], [R - 0.07, H - 0.14]], { segments: seg }),
  );
  pool(b, 'water', H - 0.13, R - 0.068, seg, 'deep');

  const px = R + 0.07;
  const eave = top - 0.19;
  const wood = RAMPS.wood[1]!, dark = RAMPS.wood[3]!;
  b.with({ color: wood, pattern: PATTERN.planksAcross, ink: 'posts' }, () => {
    for (const sx of [-1, 1]) b.boxAt([sx * px, 0, 0], [0.055, eave + 0.03, 0.055], { skip: ['bottom', 'top'] });
  });
  // The windlass, its rope and its crank.
  const wy = 0.53;
  b.with({ color: dark, pattern: PATTERN.bark, ink: 'windlass' }, () => tube(b, [[-px, wy, 0], [px + 0.03, wy, 0]], 0.03, { seg: 6, capEnd: true }));
  b.with({ color: PALETTE.dirt, ink: 'rope' }, () => {
    tube(b, [[-0.08, wy, 0], [0.08, wy, 0]], 0.046, { seg: 7, capEnd: true, capStart: true });
    tube(b, [[0.02, wy - 0.03, 0], [0.02, H + 0.1, 0]], 0.014, { seg: 4 });
  });
  b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'crank' }, () => {
    tube(b, [[px + 0.055, wy + 0.01, 0], [px + 0.055, wy - 0.09, 0.02]], 0.016, { seg: 4, capEnd: true, capStart: true });
    tube(b, [[px + 0.04, wy - 0.085, 0.02], [px + 0.1, wy - 0.085, 0.02]], 0.016, { seg: 4, capEnd: true });
  });
  // The bucket, hanging in the mouth of the well.
  const by = H + 0.005 + r('bucket') * 0.02;
  b.with({ color: wood, pattern: PATTERN.planksAcross, ink: 'bucket' }, () =>
    b.lathe([[0.05, by], [0.068, by + 0.1], [0.054, by + 0.1], [0.052, by + 0.085]], { segments: 8, capBottom: true }),
  );
  b.with({ color: PALETTE.shallow, ink: 'bucket' }, () => b.lathe([[0.052, by + 0.085], [0, by + 0.085]], { segments: 8 }));

  // The roof: two shingled slopes on a plain board, the ridge running post to post.
  const L = px + 0.085, w = 0.23;
  const roof = RAMPS.roof[Math.floor(r('roof') * RAMPS.roof.length)]!;
  const lift = (r('lift') - 0.5) * 0.03;
  const ridge = top + lift;
  b.with({ color: roof, pattern: PATTERN.shingles, ink: 'roof' }, () => {
    b.quad([-L, eave, w], [L, eave, w], [L, ridge, 0], [-L, ridge, 0]);
    b.quad([L, eave, -w], [-L, eave, -w], [-L, ridge, 0], [L, ridge, 0]);
  });
  b.with({ color: wood, ink: 'gable' }, () => {
    b.tri([L, eave, w], [L, eave, -w], [L, ridge, 0]);
    b.tri([-L, eave, -w], [-L, eave, w], [-L, ridge, 0]);
    b.quad([-L, eave, -w], [L, eave, -w], [L, eave, w], [-L, eave, w]);
  });
  return { pool: translation(0, H - 0.13, 0) };
}
