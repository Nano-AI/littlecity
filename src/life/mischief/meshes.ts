// The drawn things of mischief (design section 13b): flames as flat licking
// shapes, sparks, smoke puffs, embers, the bomb, the flash of a blast, a
// water spout. Built once, in the game's hand: flat colour, a pen line round
// each shape, self-lit where it burns. Owner: Mischief.

import { compose, rotationY, scaling, translation, type Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { airborne, MIST } from '@/gen/airborne';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { ball } from '@/parts/actors/kit';
import { DAMAGE_COLORS } from '@/style/damage';
import { PALETTE } from '@/style/palette';

const GLOW = airborne(PATTERN.glow);

function sheet(b: MeshBuilder, pts: readonly [number, number][], z: number, rot: number): void {
  const p3: Vec3[] = pts.map(([x, y]) => [x * Math.cos(rot) + z * Math.sin(rot), y, -x * Math.sin(rot) + z * Math.cos(rot)]);
  b.polygon(p3);
  b.polygon([...p3].reverse());
}

/**
 * The outline of a cluster of tongues sharing one base, in the XY plane: base centred on the origin,
 * buried a little below it (it grows out of whatever it stands on), about 1 tall and `w` wide. Each
 * tongue tapers to a curling tip; the middle one is tallest. Points go anticlockwise.
 */
function cluster(look: number, w: number, h: number): [number, number][] {
  // Tips: [x of the tip, height, lean of the tip] per tongue, left to right.
  const sets: [number, number, number][][] = [
    [[-0.3, 0.55, -0.08], [-0.04, 1, 0.06], [0.27, 0.7, 0.1]],
    [[-0.28, 0.72, -0.1], [0.02, 0.92, -0.05], [0.3, 0.5, 0.08]],
    [[-0.32, 0.48, -0.04], [-0.1, 0.8, 0.02], [0.14, 1, 0.08], [0.33, 0.58, 0.12]],
  ];
  const tips = sets[look % sets.length]!;
  const out: [number, number][] = [];
  const base = -0.08;
  // The base: a shallow round bottom from right to left.
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    out.push([Math.cos(a) * 0.42 * w, base - Math.sin(a) * 0.04]);
  }
  // Up the left side, then over each tongue: a curved flank up to the tip, down into the notch.
  const left = -0.42 * w;
  let x = left;
  let y = 0.05;
  for (let t = 0; t < tips.length; t++) {
    const [tx0, th, lean] = tips[t]!;
    const tx = tx0 * w;
    const ty = th * h;
    // Flank up: bulge outward, then taper (sampled on a quadratic curve).
    const cx = (x + tx) / 2 - 0.08 * w, cy = y + (ty - y) * 0.45;
    for (let k = 1; k <= 5; k++) {
      const u = k / 5;
      const px = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * (tx + lean * w * 0.3);
      const py = (1 - u) * (1 - u) * y + 2 * (1 - u) * u * cy + u * u * ty;
      out.push([px, py]);
    }
    // Down into the notch before the next tongue (or down the right side to the base).
    const nx = t + 1 < tips.length ? (tx + tips[t + 1]![0] * w) / 2 : 0.42 * w;
    const ny = t + 1 < tips.length ? Math.min(ty, tips[t + 1]![1] * h) * 0.42 : 0.05;
    const dx = (tx + nx) / 2 + 0.06 * w, dy = ny + (ty - ny) * 0.55;
    for (let k = 1; k <= 4; k++) {
      const u = k / 4;
      out.push([
        (1 - u) * (1 - u) * (tx + lean * w * 0.3) + 2 * (1 - u) * u * dx + u * u * nx,
        (1 - u) * (1 - u) * ty + 2 * (1 - u) * u * dy + u * u * ny,
      ]);
    }
    x = nx;
    y = ny;
  }
  // The outline was built base right→left, then left→right over the top: make it one anticlockwise loop.
  // Anticlockwise seen from +Z (the side that faces the reader).
  let area = 0;
  for (let i = 0; i < out.length; i++) {
    const p = out[i]!, q = out[(i + 1) % out.length]!;
    area += p[0] * q[1] - q[0] * p[1];
  }
  return area < 0 ? out.reverse() : out;
}

/** Every flame shares one ink id: layers and neighbouring flames are one drawn shape, outlined only outside. */
const FLAME_INK = 0x7f1e;
const flames = new Map<number, MeshData>();
/**
 * A flame, drawn flat as a hand would draw it, to be turned toward the reader: a dark red-orange
 * cluster of tongues, an orange one inside it, a yellow core low in the middle, all on one base.
 * About 1 tall, base at the origin, facing +Z.
 */
export function flameMesh(look: number): MeshData {
  let m = flames.get(look);
  if (m) return m;
  const b = new MeshBuilder();
  b.setPattern(GLOW).setInkId(FLAME_INK);
  const layer = (color: string, w: number, h: number, z: number, l: number): void => {
    b.setColor(color);
    b.polygon(cluster(l, w, h).map(([x, y]) => [x, y, z] as Vec3));
  };
  layer(DAMAGE_COLORS.flameDeep, 1, 1, 0, look);
  layer(DAMAGE_COLORS.flameRoot, 0.82, 0.8, 0.012, look + 1);
  layer(DAMAGE_COLORS.flameMid, 0.62, 0.58, 0.024, look + 2);
  layer(DAMAGE_COLORS.flameTip, 0.4, 0.34, 0.036, look);
  flames.set(look, (m = b.build()));
  return m;
}

let windowGlow: MeshData | null = null;
/** The glow of a fire inside, filling a window: a flat self-lit pane, 1 × 1, facing +Z, centred. */
export function windowGlowMesh(): MeshData {
  if (windowGlow) return windowGlow;
  const b = new MeshBuilder({ ink: 'window-glow' });
  b.setPattern(PATTERN.glow).setInk('glow').setColor(DAMAGE_COLORS.flameRoot);
  b.polygon([[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]]);
  b.setColor(DAMAGE_COLORS.flameMid);
  b.polygon([[-0.3, -0.5, 0.004], [0.32, -0.5, 0.004], [0.2, 0.15, 0.004], [0.02, 0.38, 0.004], [-0.18, 0.1, 0.004]]);
  return (windowGlow = b.build());
}

let spark: MeshData | null = null;
/** A spark or a flying ember: a tiny bright diamond, crossed. */
export function sparkMesh(): MeshData {
  if (spark) return spark;
  const b = new MeshBuilder({ ink: 'spark' });
  b.setColor(DAMAGE_COLORS.flameTip).setPattern(GLOW).setInk('spark');
  const d: [number, number][] = [[0, -0.5], [0.35, 0], [0, 0.5], [-0.35, 0]];
  sheet(b, d, 0, 0);
  sheet(b, d, 0, Math.PI / 2);
  return (spark = b.build());
}

let ember: MeshData | null = null;
/** Embers glowing in the ash of a burnt-out shell: a few flat specks, lying down, about 0.8 across. */
export function emberMesh(): MeshData {
  if (ember) return ember;
  const b = new MeshBuilder({ ink: 'embers' });
  b.setColor(DAMAGE_COLORS.ember).setPattern(PATTERN.glow).setInk('embers');
  const specks: [number, number, number][] = [[-0.22, -0.1, 0.09], [0.12, -0.2, 0.07], [0.2, 0.15, 0.1], [-0.05, 0.22, 0.06], [-0.25, 0.2, 0.05], [0.02, 0.0, 0.08]];
  for (const [x, z, r] of specks) {
    const pts: Vec3[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pts.push([x + Math.cos(a) * r, 0, z - Math.sin(a) * r]);
    }
    b.polygon(pts);
  }
  return (ember = b.build());
}

/**
 * Clouds (smoke and dust) are drawn as ONE shape however many puffs make them: every puff shares an ink
 * id, and its normals lean gently up instead of round, so where two puffs meet there is neither a seam nor
 * a crease, only the outline round the outside of the whole billowing mass.
 */
export const SMOKE_INK = 0x5a0e;
export const DUST_INK = 0x5a0f;

/** Normals that lean up, tilted only a little toward the puff's own side: puffs meeting do not crease. */
function cloudNormals(m: MeshData, tilt = 0.18): MeshData {
  const n = m.normal;
  for (let i = 0; i < n.length; i += 3) {
    const px = m.position[i]!, py = m.position[i + 1]!, pz = m.position[i + 2]!;
    const l = Math.hypot(px, py, pz) || 1;
    const x = (px / l) * tilt, y = 1 + (py / l) * tilt * 0.5, z = (pz / l) * tilt;
    const k = Math.hypot(x, y, z);
    n[i] = x / k;
    n[i + 1] = y / k;
    n[i + 2] = z / k;
  }
  return m;
}

function cloudPuff(b: MeshBuilder, look: number): void {
  const a = (look % 3) * 2.1 + 0.3;
  ball(b, 0, 0, 0, 0.42, 0.38, 0.42, 12, 6);
  ball(b, Math.cos(a) * 0.24, 0.07, Math.sin(a) * 0.24, 0.3, 0.28, 0.3, 10, 5);
  ball(b, -Math.cos(a) * 0.2, 0.11, -Math.sin(a) * 0.22, 0.26, 0.24, 0.26, 10, 5);
}

const smokes = new Map<string, MeshData>();
/**
 * A puff of smoke. `shade` 0 is the dark puff low over the fire, 1 a grey one higher up, 2 a pale one;
 * `mist` is the soft wash it becomes at last, thinning against the sky.
 */
export function smokeMesh(mist: boolean, look: number, shade = 0): MeshData {
  const k = `${mist}${look % 3}${shade}`;
  let m = smokes.get(k);
  if (m) return m;
  const b = new MeshBuilder();
  if (mist) b.setColor(DAMAGE_COLORS.smokePale).setPattern(MIST).setInk('mist');
  else b.setColor([DAMAGE_COLORS.smokeDark, DAMAGE_COLORS.smokeMid, DAMAGE_COLORS.smokeLight][shade] ?? DAMAGE_COLORS.smokeDark).setPattern(airborne(PATTERN.none)).setInkId(SMOKE_INK);
  cloudPuff(b, look);
  smokes.set(k, (m = cloudNormals(b.build())));
  return m;
}

const dusts = new Map<number, MeshData>();
/** A puff of the dust a blast throws up: the same fused drawing as smoke, in the colour of plaster dust. */
export function dustMesh(look: number): MeshData {
  let m = dusts.get(look % 3);
  if (m) return m;
  const b = new MeshBuilder();
  b.setColor(DAMAGE_COLORS.dust).setPattern(airborne(PATTERN.none)).setInkId(DUST_INK);
  cloudPuff(b, look);
  dusts.set(look % 3, (m = cloudNormals(b.build(), 0.22)));
  return m;
}

let bomb: MeshData | null = null;
/** The bomb: a round black ball with a shine, a cap and a curly fuse. Origin at its foot. About 0.4 across. */
export function bombMesh(): MeshData {
  if (bomb) return bomb;
  const b = new MeshBuilder({ ink: 'bomb' });
  b.setColor(PALETTE.metal).setPattern(PATTERN.metal).setInk('ball');
  ball(b, 0, 0.2, 0, 0.2, 0.2, 0.2, 14, 8);
  b.setColor(PALETTE.metal).setPattern(PATTERN.none).setInk('cap');
  b.at(translation(0, 0.37, 0), () => b.lathe([[0.06, 0], [0.065, 0.06], [0, 0.065]], { segments: 8 }));
  // A shine.
  b.setColor(PALETTE.white).setPattern(PATTERN.none).setInk('shine');
  ball(b, -0.08, 0.3, 0.12, 0.035, 0.05, 0.02, 6, 3);
  // The fuse: a little curl.
  b.setColor(DAMAGE_COLORS.rope).setInk('fuse');
  const pts: Vec3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push([Math.sin(t * 2.6) * 0.07, 0.43 + t * 0.14, Math.cos(t * 2.6) * 0.03 - 0.03]);
  }
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i]!, q = pts[i + 1]!;
    b.boxAt([(p[0] + q[0]) / 2, Math.min(p[1], q[1]), (p[2] + q[2]) / 2], [0.022, Math.abs(q[1] - p[1]) + 0.01, 0.022]);
  }
  return (bomb = b.build());
}

/** The tip of the fuse in the bomb's frame (sparks fizz from here). */
export const FUSE_TIP: Vec3 = [Math.sin(2.6) * 0.07, 0.58, Math.cos(2.6) * 0.03 - 0.03];

let flash: MeshData | null = null;
/** The flash of a blast: a jagged star, drawn flat on three crossed sheets, self-lit. Radius 1. */
export function flashMesh(): MeshData {
  if (flash) return flash;
  const b = new MeshBuilder({ ink: 'flash' });
  const star = (r0: number, r1: number, n: number, off: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 + off;
      const r = i % 2 === 0 ? r1 * (0.8 + 0.2 * ((i * 7) % 3) / 2) : r0;
      out.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return out;
  };
  for (const [rot, tilt] of [[0, 0], [Math.PI / 2, 0], [0, 1]] as const) {
    const place = (pts: [number, number][], z: number): Vec3[] =>
      pts.map(([x, y]) => {
        if (tilt) return [x, z, y] as Vec3;
        return [x * Math.cos(rot) + z * Math.sin(rot), y, -x * Math.sin(rot) + z * Math.cos(rot)] as Vec3;
      });
    b.setColor(DAMAGE_COLORS.flameRoot).setPattern(GLOW).setInk('burst');
    const outer = place(star(0.55, 1, 9, 0.2), 0);
    b.polygon(outer);
    b.polygon([...outer].reverse());
    b.setColor(DAMAGE_COLORS.flameTip).setInk('burst-in');
    for (const z of [0.015, -0.015]) {
      const inner = place(star(0.3, 0.6, 7, 0.5), z);
      b.polygon(inner);
      b.polygon([...inner].reverse());
    }
  }
  return (flash = b.build());
}

let spout: MeshData | null = null;
/** A spout of water from a bomb in the sea: a column with a crown of splashes. 1 tall, origin at the water. */
export function spoutMesh(): MeshData {
  if (spout) return spout;
  const b = new MeshBuilder({ ink: 'spout' });
  b.setColor(PALETTE.foam).setPattern(airborne(PATTERN.foam)).setInk('column');
  b.lathe([[0.32, 0], [0.2, 0.3], [0.14, 0.8], [0.22, 0.95], [0, 1]], { segments: 12 });
  b.setInk('crown');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.at(compose(rotationY(a), translation(0.22, 0.9, 0), scaling(0.08, 0.16, 0.08)), () =>
      b.lathe([[0.6, 0], [0.9, 0.5], [0, 1]], { segments: 6 }),
    );
  }
  return (spout = b.build());
}

let warm: MeshData | null = null;
/** Firelight: a soft warm wash (mist, translucent) round a fire, so at night the walls about it glow. Radius 1. */
export function firelightMesh(): MeshData {
  if (warm) return warm;
  const b = new MeshBuilder({ ink: 'firelight' });
  b.setColor(DAMAGE_COLORS.flameMid).setPattern(MIST).setInk('firelight');
  // Nested shells: the wash builds up toward the middle and fades to nothing at the rim (no hard edge).
  for (const r of [1, 0.8, 0.62, 0.45, 0.3]) ball(b, 0, 0, 0, r, r * 0.75, r, 14, 7);
  return (warm = b.build());
}

const sails = new Map<boolean, MeshData>();
/**
 * A windmill's sails, come down: a hub and four lattice arms with their cloth, in the XY plane facing +Z,
 * hub at the origin, about 0.7 from the hub to a tip. Burnt: charred frames and no cloth left.
 */
export function fallenSailsMesh(burnt: boolean): MeshData {
  let m = sails.get(burnt);
  if (m) return m;
  const b = new MeshBuilder({ ink: `fallen-sails${burnt}` });
  const wood = burnt ? DAMAGE_COLORS.char : PALETTE.wood;
  b.setColor(wood).setPattern(PATTERN.planks).setInk('arms');
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.3;
    const c = Math.cos(a), s = Math.sin(a);
    // The arm, and slats across it.
    const arm = (x0: number, y0: number, x1: number, y1: number, w: number): void => {
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
      const nx = (-dy / l) * w, ny = (dx / l) * w;
      b.polygon([[x0 + nx, y0 + ny, 0.02], [x0 - nx, y0 - ny, 0.02], [x1 - nx, y1 - ny, 0.02], [x1 + nx, y1 + ny, 0.02]]);
      b.polygon([[x1 + nx, y1 + ny, -0.02], [x1 - nx, y1 - ny, -0.02], [x0 - nx, y0 - ny, -0.02], [x0 + nx, y0 + ny, -0.02]]);
    };
    arm(0, 0, c * 0.72, s * 0.72, 0.022);
    for (let i = 1; i <= 4; i++) {
      const r = 0.18 + i * 0.12;
      // A slat across the arm, off to one side (the sail's frame); broken short on a burnt one.
      const len = burnt && i % 2 === 0 ? 0.06 : 0.14;
      arm(c * r, s * r, c * r - s * len, s * r + c * len, 0.01);
    }
    if (!burnt) {
      b.setColor(PALETTE.white).setPattern(PATTERN.cloth).setInk(`cloth${k}`);
      const p0: Vec3 = [c * 0.2, s * 0.2, 0.025], p1: Vec3 = [c * 0.68, s * 0.68, 0.025];
      const p2: Vec3 = [c * 0.68 - s * 0.13, s * 0.68 + c * 0.13, 0.025], p3: Vec3 = [c * 0.2 - s * 0.13, s * 0.2 + c * 0.13, 0.025];
      b.polygon([p0, p1, p2, p3]);
      b.polygon([[p3[0], p3[1], -0.025], [p2[0], p2[1], -0.025], [p1[0], p1[1], -0.025], [p0[0], p0[1], -0.025]]);
      b.setColor(wood).setPattern(PATTERN.planks).setInk('arms');
    }
  }
  b.setColor(PALETTE.metal).setPattern(PATTERN.none).setInk('hub');
  b.at([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, -0.05, 1], () => b.lathe([[0.07, 0], [0.07, 0.1]], { segments: 8, capTop: true, capBottom: true }));
  sails.set(burnt, (m = b.build()));
  return m;
}

let fireball: MeshData | null = null;
/** The nuke's fireball: a self-lit ball, a hotter core showing at one side. Radius 1. */
export function fireballMesh(): MeshData {
  if (fireball) return fireball;
  const b = new MeshBuilder();
  b.setColor(DAMAGE_COLORS.flameRoot).setPattern(GLOW).setInkId(0x5a10);
  ball(b, 0, 0, 0, 1, 0.92, 1, 14, 8);
  b.setColor(DAMAGE_COLORS.flameTip).setInkId(0x5a10);
  ball(b, 0.15, 0.1, 0.35, 0.68, 0.62, 0.68, 12, 6);
  return (fireball = b.build());
}

// ── the nuke (design section 13b, the owner's nuke) ─────────────────────

let casing: MeshData | null = null;
/**
 * The nuke itself, as it falls: a fat drab casing with a rounded nose, a yellow nose band and black-and-
 * yellow stripes, a tail cone with four broad fins in a ring. Nose down at the origin, about 1.3 long.
 */
export function nukeCasingMesh(): MeshData {
  if (casing) return casing;
  const b = new MeshBuilder({ ink: 'nuke' });
  const drab = '#7b8063';
  b.setColor(drab).setPattern(PATTERN.metal).setInk('body');
  // Nose (bottom) round, body fat, then tapering to the tail.
  b.lathe([[0, 0], [0.12, 0.03], [0.2, 0.11], [0.25, 0.24], [0.26, 0.62], [0.24, 0.78], [0.15, 0.98], [0.08, 1.04]], { segments: 16 });
  b.setColor(PALETTE.yellow).setPattern(PATTERN.none).setInk('band');
  b.at(translation(0, 0.13, 0), () => b.lathe([[0.215, 0], [0.235, 0.09]], { segments: 16 }));
  // Stripes round the middle.
  for (let i = 0; i < 3; i++) {
    b.setColor(i % 2 ? PALETTE.ink : PALETTE.yellow).setInk(`stripe${i}`);
    b.at(translation(0, 0.42 + i * 0.05, 0), () => b.lathe([[0.263, 0], [0.263, 0.05]], { segments: 16 }));
  }
  // The fins: four broad plates round the tail, and a ring through them.
  b.setColor(drab).setPattern(PATTERN.metal).setInk('fins');
  for (let k = 0; k < 4; k++) {
    b.at(rotationY((k * Math.PI) / 2), () => {
      b.polygon([[0.06, 0.82, 0.012], [0.36, 0.98, 0.012], [0.36, 1.3, 0.012], [0.06, 1.2, 0.012]]);
      b.polygon([[0.06, 1.2, -0.012], [0.36, 1.3, -0.012], [0.36, 0.98, -0.012], [0.06, 0.82, -0.012]]);
    });
  }
  b.setColor(PALETTE.metal).setPattern(PATTERN.none).setInk('ring');
  b.at(translation(0, 1.16, 0), () => {
    b.lathe([[0.36, 0], [0.36, 0.1]], { segments: 16 });
    b.lathe([[0.33, 0.1], [0.33, 0]], { segments: 16 });
  });
  return (casing = b.build());
}

/** Fire lobes share one ink: the fireball and the fire in the cloud are one drawn shape. */
export const FIRE_INK = 0x5a11;
const FIRE_TONES = ['#b8352b', '#f06a32', '#ffb648', '#fff1b8'];
const fireLobes = new Map<string, MeshData>();
/** A lobe of fire for the fireball and the cap: the puff shape, self-lit. Tone 0 deep red … 3 yellow-white. */
export function fireLobeMesh(look: number, tone: number): MeshData {
  const k = `${look % 3}${tone}`;
  let m = fireLobes.get(k);
  if (m) return m;
  const b = new MeshBuilder();
  b.setColor(FIRE_TONES[tone] ?? FIRE_TONES[1]!).setPattern(airborne(PATTERN.glow)).setInkId(FIRE_INK);
  cloudPuff(b, look);
  fireLobes.set(k, (m = cloudNormals(b.build())));
  return m;
}

let shockRing: MeshData | null = null;
/** The shockwave on the ground: a bright flat ring of radius 1 (inner 0.86), self-lit, never shaded. */
/** Arcs the ring and the dust wall are drawn in, each spanning this share of the circle from angle 0. */
export const ARCS = 24;
export function shockRingMesh(): MeshData {
  if (shockRing) return shockRing;
  const b = new MeshBuilder({ ink: 'shock' });
  b.setColor('#fffbe6').setPattern(airborne(PATTERN.glow)).setInk('ring');
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n / ARCS) * Math.PI * 2, a1 = ((i + 1) / n / ARCS) * Math.PI * 2;
    b.quad([Math.cos(a0) * 0.94, 0, Math.sin(a0) * 0.94], [Math.cos(a1) * 0.94, 0, Math.sin(a1) * 0.94], [Math.cos(a1), 0, Math.sin(a1)], [Math.cos(a0), 0, Math.sin(a0)]);
  }
  return (shockRing = b.build());
}

const walls = new Map<string, MeshData>();
/**
 * The low wall of dust behind the shockwave: one lumpy ring of radius 1 (lumps about 0.06 of it wide
 * and up to 0.5 tall in world units, so it is scaled by the ring's radius across and not up), drawn as
 * one fused shape with one outline. `mist`: the same as a wash, for when it thins and settles.
 */
export function dustWallMesh(kind: 'dust' | 'spray' | 'mist', look: number): MeshData {
  const k = `${kind}${look % 3}`;
  let m = walls.get(k);
  if (m) return m;
  const b = new MeshBuilder();
  if (kind === 'mist') b.setColor(DAMAGE_COLORS.smokePale).setPattern(MIST).setInk('mist');
  else if (kind === 'spray') b.setColor(PALETTE.foam).setPattern(airborne(PATTERN.foam)).setInkId(DUST_INK);
  else b.setColor(DAMAGE_COLORS.dust).setPattern(airborne(PATTERN.none)).setInkId(DUST_INK);
  // One arc (1/ARCS of the circle): lumps of two sizes, overlapping, a little in and out of the line.
  const n = 5;
  for (let i = 0; i < n; i++) {
    const j = i + (look % 3) * n;
    const a = ((i + 0.5) / n / ARCS) * Math.PI * 2;
    const k2 = (Math.sin(j * 2.3) + Math.sin(j * 0.7 + 1)) * 0.25;
    const h = 0.38 + 0.18 * k2;
    const rr = 0.985 + 0.012 * Math.sin(j * 1.7);
    ball(b, Math.cos(a) * rr, h * 0.4, Math.sin(a) * rr, 0.07 + 0.015 * Math.sin(j), h, 0.07, 8, 4);
  }
  walls.set(k, (m = kind === 'mist' ? b.build() : cloudNormals(b.build(), 0.22)));
  return m;
}

let shockBand: MeshData | null = null;
/** The front of the shockwave standing up off the ground: a pale wash band of radius 1, 1 tall (it brightens what it passes). */
export function shockBandMesh(): MeshData {
  if (shockBand) return shockBand;
  const b = new MeshBuilder({ ink: 'shock-band' });
  b.setColor(PALETTE.white).setPattern(MIST).setInk('band');
  b.lathe([[1, 0], [1, 0.5], [0.97, 1]], { segments: 48 });
  b.lathe([[0.97, 1], [1, 0.5], [1, 0]], { segments: 48 });
  return (shockBand = b.build());
}

let core: MeshData | null = null;
/** The instant of the flash: a white-hot ball, radius 1. */
export function nukeCoreMesh(): MeshData {
  if (core) return core;
  const b = new MeshBuilder({ ink: 'nuke-core' });
  b.setColor('#fffdf2').setPattern(airborne(PATTERN.glow)).setInk('core');
  ball(b, 0, 0, 0, 1, 1, 1, 14, 8);
  return (core = b.build());
}

let spray: MeshData | null = null;
/** Spray the shockwave throws up off water: a white puff, fused like the dust. */
export function sprayMesh(): MeshData {
  if (spray) return spray;
  const b = new MeshBuilder();
  b.setColor(PALETTE.foam).setPattern(airborne(PATTERN.foam)).setInkId(DUST_INK);
  cloudPuff(b, 1);
  return (spray = cloudNormals(b.build(), 0.22));
}

let ash: MeshData | null = null;
/** A fleck of falling ash: a tiny grey diamond, crossed. */
export function ashMesh(): MeshData {
  if (ash) return ash;
  const b = new MeshBuilder({ ink: 'ash' });
  b.setColor('#6f6964').setPattern(airborne(PATTERN.none)).setInk('ash');
  const d: [number, number][] = [[0, -0.5], [0.4, 0], [0, 0.5], [-0.4, 0]];
  sheet(b, d, 0, 0);
  sheet(b, d, 0, Math.PI / 2);
  return (ash = b.build());
}

// ── lightning (the Lightning tool: a little storm cloud gathers and strikes) ──

/** All the storm cloud's puffs share this ink: one cloud, one outline. */
export const STORM_INK = 0x5a12;
const STORM_SHADES = ['#9a9fb0', '#6c7287', '#474c61'];
const storms = new Map<string, MeshData>();
/** A puff of the little storm cloud: shade 0 pale grey (gathering) to 2 thundery slate; `mist` the wash it thins to. */
export function stormPuffMesh(look: number, shade: number, mist = false): MeshData {
  const k = `${look % 3}${shade}${mist}`;
  let m = storms.get(k);
  if (m) return m;
  const b = new MeshBuilder();
  if (mist) b.setColor('#8d92a3').setPattern(MIST).setInk('storm-mist');
  else b.setColor(STORM_SHADES[shade] ?? STORM_SHADES[2]!).setPattern(airborne(PATTERN.none)).setInkId(STORM_INK);
  cloudPuff(b, look);
  storms.set(k, (m = mist ? b.build() : cloudNormals(b.build(), 0.3)));
  return m;
}

const bolts = new Map<number, MeshData>();
/**
 * A lightning bolt: a jagged ribbon from the cloud (y = 1) down to where it strikes (y = 0), with a short
 * fork, in the XY plane facing +Z (turned to the camera), drawn both sides, self-lit, pale yellow-white with
 * a pen line. About 0.14 wide at the top; scaled in y to its length.
 */
export function boltMesh(look: number): MeshData {
  const l = look % 3;
  let m = bolts.get(l);
  if (m) return m;
  const b = new MeshBuilder({ ink: `bolt${l}` });
  b.setColor('#fffbe0').setPattern(GLOW).setInk('bolt');
  const seed = 0xb017 + l * 31;
  // The zigzag: a few kinks, swinging left and right, narrowing to the strike.
  const n = 7;
  const pts: [number, number][] = [[0, 1]];
  for (let i = 1; i < n; i++) {
    const y = 1 - i / n + (rand(seed, 'y', i) - 0.5) * 0.05;
    pts.push([(i % 2 ? 1 : -1) * (0.08 + rand(seed, 'x', i) * 0.12), y]);
  }
  pts.push([0, 0]);
  const ribbon = (line: [number, number][], w0: number, w1: number): void => {
    for (let i = 0; i + 1 < line.length; i++) {
      const [x0, y0] = line[i]!, [x1, y1] = line[i + 1]!;
      const t0 = i / (line.length - 1), t1 = (i + 1) / (line.length - 1);
      const a = w0 + (w1 - w0) * t0, c = w0 + (w1 - w0) * t1;
      // Across the segment, in x (the bolt is mostly vertical).
      sheet(b, [[x0 - a, y0], [x1 - c, y1], [x1 + c, y1], [x0 + a, y0]], 0, 0);
    }
  };
  ribbon(pts, 0.07, 0.025);
  // The fork: off the third kink, a short branch falling away.
  const [fx, fy] = pts[3]!;
  const s = fx > 0 ? 1 : -1;
  ribbon([[fx, fy], [fx + s * 0.16, fy - 0.1], [fx + s * 0.12, fy - 0.2]], 0.035, 0.012);
  m = b.build();
  bolts.set(l, m);
  return m;
}

let strikeFlash: MeshData | null = null;
/** The flash where the bolt lands: a white-hot little star (a ball with spikes), radius about 1. */
export function strikeFlashMesh(): MeshData {
  if (strikeFlash) return strikeFlash;
  const b = new MeshBuilder({ ink: 'strike-flash' });
  b.setColor('#ffffff').setPattern(GLOW).setInk('flash');
  ball(b, 0, 0, 0, 0.45, 0.45, 0.45, 10, 6);
  for (let i = 0; i < 6; i++) sheet(b, [[-0.08, 0], [0, 1], [0.08, 0]], 0, (i / 6) * Math.PI * 2);
  for (let i = 0; i < 6; i++) sheet(b, [[-0.08, 0], [0, -0.8], [0.08, 0]], 0, (i / 6) * Math.PI * 2 + 0.5);
  return (strikeFlash = b.build());
}

let boltLight: MeshData | null = null;
/** The bolt's light on the town round it: nested shells of a cold white wash, fading to nothing at the rim. */
export function boltLightMesh(): MeshData {
  if (boltLight) return boltLight;
  const b = new MeshBuilder({ ink: 'bolt-light' });
  b.setColor('#e8eeff').setPattern(MIST).setInk('bolt-light');
  for (const r of [1, 0.86, 0.72, 0.58, 0.44, 0.3]) ball(b, 0, 0, 0, r, r * 0.7, r, 14, 7);
  return (boltLight = b.build());
}
