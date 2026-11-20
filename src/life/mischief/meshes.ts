// The drawn things of mischief (design section 13b): flames as flat licking
// shapes, sparks, smoke puffs, embers, the bomb, the flash of a blast, a
// water spout. Built once, in the game's hand: flat colour, a pen line round
// each shape, self-lit where it burns. Owner: Mischief.

import { compose, rotationY, scaling, translation, type Vec3 } from '@/core/mat4';
import { airborne, MIST } from '@/gen/airborne';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { ball } from '@/parts/actors/kit';
import { DAMAGE_COLORS } from '@/style/damage';
import { PALETTE } from '@/style/palette';

const GLOW = airborne(PATTERN.glow);

/** A tongue of flame in the XY plane, base at the origin, 1 tall: a few licks, the middle one tallest. */
function tongue(look: number, scale: number): [number, number][] {
  const L = [
    [[-0.32, 0], [-0.3, 0.32], [-0.2, 0.58], [-0.14, 0.38], [-0.05, 1], [0.06, 0.5], [0.15, 0.74], [0.22, 0.36], [0.31, 0.22], [0.3, 0]],
    [[-0.3, 0], [-0.33, 0.24], [-0.24, 0.66], [-0.1, 0.42], [0.02, 0.92], [0.1, 0.55], [0.24, 0.8], [0.27, 0.34], [0.32, 0]],
    [[-0.31, 0], [-0.28, 0.4], [-0.16, 0.76], [-0.06, 0.48], [0.06, 1], [0.14, 0.44], [0.29, 0.6], [0.32, 0]],
  ][look % 3]!;
  return L.map(([x, y]) => [x! * scale, y! * scale]);
}

function sheet(b: MeshBuilder, pts: readonly [number, number][], z: number, rot: number): void {
  const p3: Vec3[] = pts.map(([x, y]) => [x * Math.cos(rot) + z * Math.sin(rot), y, -x * Math.sin(rot) + z * Math.cos(rot)]);
  b.polygon(p3);
  b.polygon([...p3].reverse());
}

const flames = new Map<number, MeshData>();
/** A flame: three nested tongues (red-orange, orange, yellow) on two crossed sheets. About 1 tall. */
export function flameMesh(look: number): MeshData {
  let m = flames.get(look);
  if (m) return m;
  const b = new MeshBuilder({ ink: `flame${look}` });
  b.setPattern(GLOW).setInk('flame');
  for (const rot of [0, Math.PI / 2]) {
    b.setColor(DAMAGE_COLORS.flameRoot);
    sheet(b, tongue(look, 1), 0, rot);
    b.setColor(DAMAGE_COLORS.flameMid).setInk('flame-mid');
    sheet(b, tongue(look + 1, 0.7), 0.012, rot);
    sheet(b, tongue(look + 1, 0.7), -0.012, rot);
    b.setColor(DAMAGE_COLORS.flameTip).setInk('flame-tip');
    sheet(b, tongue(look + 2, 0.42), 0.024, rot);
    sheet(b, tongue(look + 2, 0.42), -0.024, rot);
    b.setInk('flame');
  }
  flames.set(look, (m = b.build()));
  return m;
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

const smokes = new Map<string, MeshData>();
/** A puff of smoke: a drawn, inked dark puff low down; a soft mist wash higher up (it thins against the sky). */
export function smokeMesh(mist: boolean, look: number): MeshData {
  const k = `${mist}${look % 3}`;
  let m = smokes.get(k);
  if (m) return m;
  const b = new MeshBuilder({ ink: `smoke${k}` });
  const a = (look % 3) * 2.1 + 0.3;
  if (mist) b.setColor(DAMAGE_COLORS.smokePale).setPattern(MIST).setInk('mist');
  else b.setColor(DAMAGE_COLORS.smokeDark).setPattern(airborne(PATTERN.none)).setInk('smoke');
  ball(b, 0, 0, 0, 0.4, 0.36, 0.4, 9, 5);
  ball(b, Math.cos(a) * 0.25, 0.08, Math.sin(a) * 0.25, 0.27, 0.25, 0.27, 7, 4);
  ball(b, -Math.cos(a) * 0.2, 0.12, -Math.sin(a) * 0.22, 0.22, 0.2, 0.22, 7, 4);
  smokes.set(k, (m = b.build()));
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
  ball(b, 0, 0, 0, 1, 0.75, 1, 12, 6);
  return (warm = b.build());
}
