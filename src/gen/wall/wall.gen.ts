// Walls (J20, styled by R-E02): a run of cell pieces and edge pieces drawn
// as straight stretches of stone between piers.
//
//   low-wall      the spike's low wall: a coped wall with blocks along the
//                 top and taller piers at corners and ends
//   garden-wall   a plain coped wall with pointed piers; with the tag
//                 'creepers' leaf hangs over it in places
//   curtain-wall  one storey tall, in the stone of the tower or keep it
//                 touches: a battered foot, a corbel course carrying a
//                 continuous parapet band that oversails the wall, merlons
//                 standing on the band (wider than the gaps between them),
//                 an arrow slit every third cell, square turrets with the
//                 same top at corners and ends
//
// Where J20 found a path crossing, the wall has an arched opening: in the
// low walls a stone arch standing over the path, in a curtain wall a gateway
// through it. A run that meets a structure goes into it with no pier.
//
// Ink groups for the whole run: body, cap, blocks, piers, pier caps, gate.
// Triangles: about 40 a cell for the low walls, 110 for a curtain wall.
//
// Reads: the structure, its role, tags and features, each cell piece's side
// neighbours and side-column terrain (through buildRun).

import { CELL_H } from '@/core/grid';
import type { Mat4Like, Vec3 } from '@/core/mat4';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { MeshBuilder, PATTERN, type ColorInput } from '@/gen/mesh';
import { lump, mixColor, SHADE_SIDE, TONE, vary } from '@/parts/ground/kit';
import { along, buildRun, gateAxis, placeRng, runFrame, segmentFrame, trimAt, type RunNode, type RunSegment } from '@/parts/ground/runs';
import { FENCE, WALL } from '@/style/edges';
import { PALETTE, rampColor } from '@/style/palette';

type WallStyle = 'low-wall' | 'garden-wall' | 'curtain-wall';
const STYLES: readonly WallStyle[] = ['low-wall', 'garden-wall', 'curtain-wall'];

/** Length along the wall of a block on a low wall; two to a cell, so the blocks are wider than the gaps. */
const BLOCK = 0.3;
/** Thickness of one row of merlons. */
const MERLON_T = 0.1;

/** Merlons along a stretch, at fixed places in the world, keeping clear of what stands at `keepClear`. */
function eachMerlon(seg: RunSegment, x0: number, x1: number, keepClear: readonly number[], clearance: number, fn: (x: number) => void): void {
  const period = WALL.merlon + WALL.crenel;
  const phase = along(seg.from, seg.axis);
  for (let i = Math.floor((phase + x0) / period) - 1; ; i++) {
    const x = (i + 0.5) * period - phase;
    if (x - WALL.merlon / 2 > x1) break;
    if (x + WALL.merlon / 2 < x0) continue;
    if (keepClear.some((p) => Math.abs(p - x) < clearance + WALL.merlon / 2)) continue;
    fn(x);
  }
}

const pierHalf = (style: WallStyle): number => (style === 'curtain-wall' ? WALL.turret : WALL.pier) / 2;
const standsAt = (n: RunNode): boolean => n.kind === 'joint' || n.kind === 'post';

/** Blocks along the top, at fixed places in the world, keeping clear of piers. */
function eachBlock(seg: RunSegment, x0: number, x1: number, clearance: number, size: number, fn: (x: number) => void): void {
  const phase = along(seg.from, seg.axis);
  const keepClear: number[] = [];
  if (standsAt(seg.from)) keepClear.push(0);
  if (standsAt(seg.to)) keepClear.push(seg.length);
  for (let i = Math.floor((phase + x0) * 2) - 1; ; i++) {
    const x = (i + 0.5) / 2 - phase;
    if (x + size / 2 > x1 + 1e-6) break;
    if (x - size / 2 < x0 - 1e-6) continue;
    if (keepClear.some((p) => Math.abs(p - x) < clearance + size / 2 + 0.02)) continue;
    fn(x);
  }
}

/**
 * A slab of wall with an arched opening through it, centred on the origin,
 * along X: half-width W, thickness T, the opening `a` either side of the
 * centre springing at `hs`. `top` is the height of a flat top, or 'round'
 * for an arch ring concentric with the opening.
 */
function archSlab(b: MeshBuilder, W: number, T: number, a: number, hs: number, top: number | 'round', drawTop: boolean): void {
  const outline: [number, number][] = [[-W, 0], [-a, 0]];
  const STEPS = 8;
  for (let i = 0; i <= STEPS; i++) {
    const t = Math.PI * (1 - i / STEPS);
    outline.push([a * Math.cos(t), hs + a * Math.sin(t)]);
  }
  outline.push([a, 0], [W, 0]);
  const topStart = outline.length;
  if (top === 'round') {
    for (let i = 0; i <= STEPS; i++) {
      const t = (Math.PI * i) / STEPS;
      outline.push([W * Math.cos(t), hs + W * Math.sin(t)]);
    }
  } else {
    outline.push([W, top], [-W, top]);
  }
  const zb = T / 2, za = -T / 2;
  b.polygon(outline.map(([x, y]): Vec3 => [x, y, zb]));
  b.polygon([...outline].reverse().map(([x, y]): Vec3 => [x, y, za]));
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const p = outline[i]!, q = outline[(i + 1) % n]!;
    if (p[1] === 0 && q[1] === 0) continue; // on the ground
    if (!drawTop && top !== 'round' && i === topStart) continue; // under the wall-walk
    b.quad([p[0], p[1], zb], [p[0], p[1], za], [q[0], q[1], za], [q[0], q[1], zb]);
  }
}

export default defineGenerator({
  kind: 'wall',
  build(s, plan, parts) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: s.id });
    const role = plan.roles.get(s.id)?.role;
    const style: WallStyle = STYLES.includes(role as WallStyle) ? (role as WallStyle) : 'low-wall';
    const curtain = style === 'curtain-wall';
    // A curtain wall is built of the stone of the tower or keep it touches (R-E02 pins the tint).
    let tint = -1;
    for (const t of plan.tags.get(s.id) ?? []) if (t.startsWith('stone:')) tint = Number(t.slice(6));
    const stone: ColorInput = curtain && tint >= 0 ? rampColor('tower', tint) : rampColor('wall', s.color);
    const shade: ColorInput = PALETTE.stoneShade;
    // J20-F: an edge piece with nothing flat to stand on (round a pitched roof's eaves) is not drawn.
    const bare = new Set<number>();
    for (const f of plan.featuresByStructure.get(s.id) ?? []) if (f.type === 'run-bare' && f.edge !== undefined) bare.add(f.edge);
    const run = buildRun(bare.size ? { ...s, edges: s.edges.filter((e) => !bare.has(e)) } : s, plan);
    const T = curtain ? WALL.curtainThick : WALL.thick;
    // A curtain wall, bottom to top: body, corbel course, parapet band, merlons. One storey in all.
    const H = curtain ? CELL_H - WALL.merlonHeight - WALL.band - WALL.corbel : style === 'garden-wall' ? WALL.gardenHeight : WALL.height;
    const yBand = H + WALL.corbel, yWalk = yBand + WALL.band;
    const halfBand = T / 2 + WALL.oversail;

    for (const seg of run.segments) {
      const L = seg.length;
      const a = trimAt(seg.from), c = L - trimAt(seg.to);
      b.at(segmentFrame(seg, run.y), () => {
        // The body. Its ends are always inside a pier, a gate or the structure it meets.
        if (c - a > 0.01) {
          b.with({ color: stone, pattern: PATTERN.stone, ink: 'body' }, () => b.box([a, 0, -T / 2], [c, H, T / 2], { only: ['n', 's'] }));
        }
        if (curtain) {
          // The batter: the foot of the wall leans out.
          if (c - a > 0.01 && WALL.batter > 0) {
            const o = T / 2 + WALL.batterOut, i = T / 2 + 0.012, h = WALL.batter;
            b.with({ color: shade, pattern: PATTERN.stone, ink: 'batter' }, () => {
              b.quad([a, 0, o], [c, 0, o], [c, h, i], [a, h, i]);
              b.quad([c, 0, -o], [a, 0, -o], [a, h, -i], [c, h, -i]);
              b.quad([a, h, i], [c, h, i], [c, h, T / 2], [a, h, T / 2]);
              b.quad([c, h, -i], [a, h, -i], [a, h, -T / 2], [c, h, -T / 2]);
            });
          }
          // The corbel course and the parapet band run on over a gateway and into the turrets.
          const k = T / 2 + WALL.oversail * 0.5;
          b.with({ color: shade, pattern: PATTERN.none, ink: 'corbel' }, () => b.box([0, H, -k], [L, yBand, k], { only: ['n', 's'] }));
          b.with({ color: stone, pattern: PATTERN.stone, ink: 'parapet' }, () => {
            b.box([0, yBand, -halfBand], [L, yWalk, halfBand], { only: ['n', 's'] });
            // The underside of the oversail shows from below the wall's own level only; the walk on top always.
            b.box([0, yBand, -halfBand], [L, yWalk, halfBand], { only: ['top'] });
            const clear: number[] = [];
            if (standsAt(seg.from)) clear.push(0);
            if (standsAt(seg.to)) clear.push(L);
            eachMerlon(seg, 0, L, clear, WALL.turret / 2 + WALL.oversail + 0.02, (x) => {
              const r = placeRng(s, seg.from.x + (seg.axis === 'x' ? x : 0), seg.from.z + (seg.axis === 'z' ? x : 0));
              // No two merlons are quite the same height or width: laid by hand.
              const mh = WALL.merlonHeight * (0.88 + r('mh') * 0.12), mw = WALL.merlon * (0.94 + r('mw') * 0.1);
              for (const side of [-1, 1]) b.boxAt([x, yWalk, side * (halfBand - MERLON_T / 2)], [mw, mh, MERLON_T], { skip: ['bottom'] });
            });
          });
          // Arrow slits: a dark loop in the face of every third cell, on both sides.
          b.with({ color: mixColor(PALETTE.metal, stone, 0.25), pattern: PATTERN.none, ink: 'slits' }, () => {
            const phase = along(seg.from, seg.axis);
            for (let cell = Math.floor(phase + a); cell + 0.5 - phase < c; cell++) {
              const x = cell + 0.5 - phase;
              if (x - a < 0.3 || c - x < 0.3) continue;
              if (((cell % WALL.slitEvery) + WALL.slitEvery) % WALL.slitEvery !== 0) continue;
              const y0 = WALL.batter + 0.08, y1 = Math.min(H - 0.06, y0 + 0.2);
              for (const side of [-1, 1]) b.box([x - 0.022, y0, side * (T / 2) - 0.006], [x + 0.022, y1, side * (T / 2) + 0.006], { only: [side > 0 ? 's' : 'n'] });
            }
          });
        } else if (c - a > 0.01) {
          const w = T / 2 + 0.03;
          b.with({ color: shade, pattern: PATTERN.none, ink: 'cap' }, () => {
            if (style === 'garden-wall') {
              // A saddle coping: two slopes meeting in a ridge.
              const lip = WALL.coping * 0.5, ridge = WALL.coping + 0.035;
              // The lip's sides are as wide as a pier: they stop at its faces rather than run on into it
              // in the plane of its sides.
              const pw = WALL.pier / 2 - 0.02;
              const la = a + (standsAt(seg.from) ? pw : 0), lc = c - (standsAt(seg.to) ? pw : 0);
              if (lc - la > 0.01) b.box([la, H, -w], [lc, H + lip, w], { only: ['n', 's'] });
              b.quad([a, H + lip, w], [c, H + lip, w], [c, H + ridge, 0], [a, H + ridge, 0]);
              b.quad([c, H + lip, -w], [a, H + lip, -w], [a, H + ridge, 0], [c, H + ridge, 0]);
            } else {
              b.box([a, H, -w], [c, H + WALL.coping, w], { only: ['top', 'n', 's'] });
            }
          });
          if (style === 'low-wall') {
            b.with({ color: stone, pattern: PATTERN.none, ink: 'blocks' }, () =>
              eachBlock(seg, a, c, pierHalf(style), BLOCK, (x) => b.boxAt([x, H + WALL.coping, 0], [BLOCK, 0.11, T + 0.02], { skip: ['bottom'] })),
            );
          }
        }
      });
    }

    for (const n of run.nodes) {
      if (standsAt(n)) {
        if (curtain) {
          // A square turret with the wall's own top, a little higher: batter, shaft, corbel course, band, merlons.
          const w = WALL.turret, yc = run.y + H + WALL.turretRise, yb = yc + WALL.corbel, yw = yb + WALL.band;
          const wo = w + WALL.oversail * 2;
          if (WALL.batter > 0) {
            const o = w / 2 + WALL.batterOut, i = w / 2, h = WALL.batter;
            b.with({ color: shade, pattern: PATTERN.stone, ink: 'batter' }, () => {
              const lo: Vec3[] = [[n.x - o, run.y, n.z + o], [n.x + o, run.y, n.z + o], [n.x + o, run.y, n.z - o], [n.x - o, run.y, n.z - o]];
              const hi: Vec3[] = [[n.x - i, run.y + h, n.z + i], [n.x + i, run.y + h, n.z + i], [n.x + i, run.y + h, n.z - i], [n.x - i, run.y + h, n.z - i]];
              for (let q = 0; q < 4; q++) b.quad(lo[q]!, lo[(q + 1) % 4]!, hi[(q + 1) % 4]!, hi[q]!);
            });
          }
          b.with({ color: stone, pattern: PATTERN.stone, ink: 'pier' }, () => b.boxAt([n.x, run.y, n.z], [w, yc - run.y, w], { skip: ['bottom', 'top'] }));
          b.with({ color: shade, pattern: PATTERN.none, ink: 'corbel' }, () => b.boxAt([n.x, yc, n.z], [w + WALL.oversail, WALL.corbel, w + WALL.oversail], { skip: ['bottom', 'top'] }));
          b.with({ color: stone, pattern: PATTERN.stone, ink: 'parapet' }, () => {
            b.boxAt([n.x, yb, n.z], [wo, WALL.band, wo], { skip: ['bottom'] });
            // Corner merlons, each wider than the gap between them.
            const m = wo * 0.36, o = wo / 2 - m / 2;
            for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
              b.boxAt([n.x + sx * o, yw, n.z + sz * o], [m, WALL.merlonHeight, m], { skip: ['bottom'] });
            }
          });
        } else if (style === 'garden-wall') {
          const w = WALL.pier - 0.04, h = H + 0.1;
          b.with({ color: stone, pattern: PATTERN.stone, ink: 'pier' }, () => b.boxAt([n.x, run.y, n.z], [w, h, w], { skip: ['bottom', 'top'] }));
          b.with({ color: shade, pattern: PATTERN.none, ink: 'piercap' }, () => {
            const cw = w / 2 + 0.03, y0 = run.y + h, y1 = y0 + 0.03;
            b.box([n.x - cw, y0, n.z - cw], [n.x + cw, y1, n.z + cw], { skip: ['bottom', 'top'] });
            const tip: Vec3 = [n.x, y1 + 0.1, n.z];
            const k: Vec3[] = [[n.x - cw, y1, n.z + cw], [n.x + cw, y1, n.z + cw], [n.x + cw, y1, n.z - cw], [n.x - cw, y1, n.z - cw]];
            for (let i = 0; i < 4; i++) b.tri(k[i]!, k[(i + 1) % 4]!, tip);
          });
        } else {
          const w = WALL.pier, h = WALL.pierHeight;
          b.with({ color: stone, pattern: PATTERN.stone, ink: 'pier' }, () => b.boxAt([n.x, run.y, n.z], [w, h, w], { skip: ['bottom', 'top'] }));
          b.with({ color: shade, pattern: PATTERN.none, ink: 'piercap' }, () => b.boxAt([n.x, run.y + h, n.z], [w + 0.06, 0.06, w + 0.06], { skip: ['bottom'] }));
        }
      } else if (n.kind === 'gate') {
        b.at(runFrame(gateAxis(n), n.x, run.y, n.z), () => {
          if (curtain) {
            const half = Math.min(WALL.archHalf, FENCE.gateHalf - 0.1);
            b.with({ color: stone, pattern: PATTERN.stone, ink: 'gate' }, () => archSlab(b, FENCE.gateHalf, T + 0.04, half, WALL.curtainSpring, H, false));
            b.with({ color: shade, pattern: PATTERN.none, ink: 'keystone' }, () =>
              b.boxAt([0, WALL.curtainSpring + half - 0.03, 0], [0.1, Math.min(0.13, H - WALL.curtainSpring - half + 0.02), T + 0.1], { skip: ['bottom', 'top'] }),
            );
          } else {
            const ring = 0.12, half = WALL.archHalf;
            b.with({ color: stone, pattern: PATTERN.stone, ink: 'gate' }, () => archSlab(b, half + ring, T + 0.1, half, WALL.archSpring, 'round', true));
            b.with({ color: shade, pattern: PATTERN.none, ink: 'keystone' }, () =>
              b.boxAt([0, WALL.archSpring + half - 0.02, 0], [0.11, ring + 0.05, T + 0.14], { skip: ['bottom'] }),
            );
          }
        });
      }
    }

    // Creepers: ivy lying along the coping in patches and hanging down one face in tongues. Drawn in
    // world axes (the tone normals are world directions). A patch is long and low, so it reads as
    // something growing over the wall, and its tongues share its outline.
    if (style === 'garden-wall' && plan.tags.get(s.id)?.has('creepers')) {
      const top = run.y + H + WALL.coping;
      for (const seg of run.segments) {
        const a = trimAt(seg.from) + 0.2, c = seg.length - trimAt(seg.to) - 0.2;
        const world = (u: number, w: number): [number, number] => (seg.axis === 'x' ? [seg.from.x + u, seg.from.z + w] : [seg.from.x - w, seg.from.z + u]);
        // The radii of a lump lying along the run.
        const radii = (alongRun: number, across: number): [number, number] => (seg.axis === 'x' ? [alongRun, across] : [across, alongRun]);
        for (let u = a; u < c; u += 0.62) {
          const [px, pz] = world(u, 0);
          const r = placeRng(s, px, pz);
          if (r('grows') > 0.62) continue;
          const side = r('side') < 0.5 ? -1 : 1;
          const [nx, nz] = seg.axis === 'x' ? [0, side] : [-side, 0]; // the way the hanging face looks
          const shaded = nx * SHADE_SIDE[0] + nz * SHADE_SIDE[1] > 0;
          const leaf = vary(PALETTE.bush, r('leaf'), 0.9);
          const dark = mixColor(leaf, PALETTE.leafDark, 0.55);
          const len = Math.min(0.2 + r('len') * 0.12, (c - a) / 2 + 0.1);
          const centre = Math.min(Math.max(u + (r('shift') - 0.5) * 0.2, a + len * 0.5), c - len * 0.5);
          b.with({ color: leaf, pattern: PATTERN.leaves, ink: 'creeper', sway: 0.1 }, () => {
            const [x, z] = world(centre, side * 0.04);
            const [rx, rz] = radii(len, T / 2 + 0.07);
            lump(b, x, top + 0.01, z, rx, 0.075, rz, { seg: 9, rings: 4, normal: TONE.lit, twist: r('tw') * 6 });
            const [x2, z2] = world(centre + (r('bump') - 0.5) * len, side * 0.02);
            const [bx, bz] = radii(len * 0.45, T / 2 + 0.05);
            lump(b, x2, top + 0.05, z2, bx, 0.07, bz, { seg: 7, rings: 4, normal: TONE.lit, twist: r('tw2') * 6 });
          });
          b.with({ color: dark, pattern: PATTERN.leaves, ink: 'creeper', sway: 0.1 }, () => {
            const tongues = 2 + (r('tongues') < 0.4 ? 1 : 0);
            for (let i = 0; i < tongues; i++) {
              const du = (i / (tongues - 1) - 0.5) * len * 1.3 + (r('tu', i) - 0.5) * 0.06;
              const drop = 0.12 + r('drop', i) * 0.16;
              const [x, z] = world(centre + du, side * (T / 2 + 0.03));
              const [rx, rz] = radii(0.07 + r('tw', i) * 0.03, 0.05);
              lump(b, x, top - drop / 2 + 0.02, z, rx, drop / 2 + 0.03, rz, { seg: 6, rings: 4, normal: shaded ? TONE.shade : TONE.mid, twist: r('tt', i) * 6 });
            }
          });
          if (r('flower') < 0.5) {
            b.with({ color: r('fc') < 0.5 ? PALETTE.pink : PALETTE.yellow, pattern: PATTERN.none, ink: 'creeper', sway: 0.1 }, () => {
              for (let i = 0; i < 4; i++) {
                const [x, z] = world(centre + (r('fu', i) - 0.5) * len * 1.5, side * 0.04 + (r('fw', i) - 0.5) * 0.16);
                lump(b, x, top + 0.085 + r('fy', i) * 0.02, z, 0.024, 0.02, 0.024, { seg: 5, rings: 3, normal: TONE.lit });
              }
            });
          }
        }
      }
    }

    placeFeatures(b, anchors, s, plan, parts, (f) => (f.type === 'gate' || f.type === 'run-end' || f.type === 'run-inset' || f.type === 'run-bare' ? null : undefined));
    return { mesh: b.build(), anchors };
  },
});
