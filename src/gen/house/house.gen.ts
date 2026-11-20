// The house generator (Houses owner; catalogue J01–J04, J12, J24, J27).
//
// One structure, one building: the cells of a house structure are drawn from
// their OUTLINE (outline.ts), level by level, so there are no interior walls,
// wall surfaces run through every merged cell in one ink group, and base
// trim appears only where a cell really stands on something (J01, J02). Each
// roof region gets a height-field roof (src/gen/roof/roof.ts) of the type its
// 'roof' feature names (J04). Doors, windows, chimneys and the rest are
// features drawn by parts (src/parts/openings) at frames this file supplies.
//
// What it reads is what the structure hash covers: the structure, its role,
// tags, features and supports, the six neighbours of each cell and the
// terrain height of its own and its side columns.

import { above, below, CELL_H, SEA_Y, columnIndex, DIR4, inColumnBounds, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS } from '@/core/kinds';
import { compose, multiply, rotationY, rotationZ, scaling, transformPoint, translation, type Mat4Like, type Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { roofRegions, type RoofRegion } from '@/resolve/facts/roofs.fact';
import type { Feature, ShapePlan, Structure } from '@/resolve/plan';
import { structureStyle } from '@/resolve/structures';
import { HOUSE, mixColor, personalityOf, type Personality } from '@/style/houses';
import { PALETTE, rampColor } from '@/style/palette';
import { defineGenerator, placeFeatures, type PartRegistry } from '../api';
import { faceFrame, facingFrame } from '../frames';
import { MeshBuilder, PATTERN, type ColorInput } from '../mesh';
import { emitRoof, roofField, type EdgeMode, type RoofField } from '../roof/roof';
import { band, leftOf, leftX, rightOf, rightX, wallEdge, wallFace, type WallEdge } from './outline';
import { crossGable, gableMaterial, roofDoor, skylightFrame } from './rooftop';

interface Material {
  color: ColorInput;
  pattern: number;
}

/** Everything the pieces of one house need to know about it. */
export interface House {
  s: Structure;
  plan: ShapePlan;
  b: MeshBuilder;
  has(c: CellKey): boolean;
  /** Terrain or a solid block that is not this house. */
  solid(c: CellKey): boolean;
  persona: Personality;
  material(cell: CellKey): Material;
  /** The wall colour, for pieces that mix their own (a timbered gable). */
  wall: ColorInput & string;
  features: readonly Feature[];
  /** The roof over each roofed cell. */
  fields: Map<CellKey, RoofField>;
}

const edgeId = (cell: CellKey, dir: Dir4): number => cell * 4 + dir;

/**
 * A foundation's top above the floor line: off the plane of the ground beside it, and 0.004 over a
 * dock's deck (itself 0.004 over the ground line, src/gen/dock/dock.gen.ts) that its ledge reaches over.
 */
const FOUNDATION_LIFT = 0.008;

/** The edge that continues this one past its left or right end (round a corner, or straight on). */
function partner(e: WallEdge, side: 'left' | 'right'): [CellKey, Dir4] {
  const lateral = side === 'left' ? leftOf(e.dir) : rightOf(e.dir);
  const t = side === 'left' ? e.left : e.right;
  if (t === 1) return [e.cell, lateral];
  const n = neighbor(e.cell, lateral);
  if (t === 0) return [n, e.dir];
  return [neighbor(n, e.dir), opposite(lateral)];
}

function buildHouse(s: Structure, plan: ShapePlan, parts: PartRegistry): { mesh: ReturnType<MeshBuilder['build']>; anchors: Record<string, Mat4Like> } {
  const b = new MeshBuilder({ ink: s.id });
  const anchors: Record<string, Mat4Like> = {};
  const members = new Set(s.cells);
  const has = (c: CellKey): boolean => c !== NO_CELL && members.has(c);
  const solid = (c: CellKey): boolean => {
    if (c === NO_CELL || members.has(c)) return false;
    if (keyY(c) < plan.terrain.height[columnIndex(keyX(c), keyZ(c))]!) return true;
    const k = plan.kinds.get(c);
    return k !== undefined && KINDS[k].solid;
  };
  const role = plan.roles.get(s.id)?.role;
  const tags = plan.tags.get(s.id);
  const persona = personalityOf(s.seed, s.color, role, s.cells.length, tags?.has('rustic') ?? false, structureStyle(plan.world, s));
  const features = plan.featuresByStructure.get(s.id) ?? [];
  const wall = tags?.has('white-walls') ? PALETTE.white : rampColor('house', s.color);

  // J27: a jettied cell and everything stacked on it is half-timbered.
  const timbered = new Set<CellKey>();
  for (const f of features) {
    if (f.type !== 'jetty' || f.cell === undefined) continue;
    for (let c = f.cell; has(c); c = above(c)) timbered.add(c);
  }
  const material = (cell: CellKey): Material => {
    if (tags?.has('glass-walls')) return { color: PALETTE.glass, pattern: PATTERN.glass };
    // R-H18: a barn is weatherboarded in plain timber, whatever colour it was placed in.
    if (tags?.has('barn')) return { color: PALETTE.wood, pattern: PATTERN.planks };
    if (timbered.has(cell)) return { color: mixColor(wall, PALETTE.white, 0.45), pattern: PATTERN.timber };
    if (tags?.has('stone-ground') && solid(below(cell))) return { color: PALETTE.stoneShade, pattern: PATTERN.stone };
    // U12 (edge half): a rustic house is half-timbered, boarded, or stands on a rough stone storey.
    if (persona.rustic === 'timber') return { color: mixColor(wall, PALETTE.white, 0.45), pattern: PATTERN.timber };
    if (persona.rustic === 'planks') return { color: wall, pattern: PATTERN.planks };
    if (persona.rustic === 'stone' && solid(below(cell))) return { color: PALETTE.stoneShade, pattern: PATTERN.rock };
    if (tags?.has('plank-walls') || (persona.plankUpper && has(below(cell)))) return { color: wall, pattern: PATTERN.planks };
    return { color: wall, pattern: PATTERN.plaster };
  };
  const h: House = { s, plan, b, has, solid, persona, material, wall, features, fields: new Map() };

  shell(h);
  roofs(h);

  const inset = HOUSE.inset;
  placeFeatures(b, anchors, s, plan, parts, (f) => {
    switch (f.type) {
      case 'roof':
      case 'foundation':
      case 'jetty':
      case 'collar':
      case 'coping':
        return null; // drawn by this file
      case 'chimney':
        return chimneyFrame(h, f);
      case 'bell-cupola':
        return finialFrame(h, f);
      case 'finial':
        return finialFrame(h, f);
      case 'dormer':
        if (f.variant === 'cross-gable') {
          crossGable(h, f, parts);
          return null;
        }
        return f.variant === 'skylight' ? skylightFrame(h, f) : dormerFrame(h, f);
      case 'window':
        if (f.variant === 'round' || f.variant === 'rose') return gableFrame(h, f) ?? onWall(f, inset);
        return onWall(f, inset);
      case 'ladder':
        // Another owner's ladder part draws it if there is one; otherwise the plain one below.
        if (parts.has('feature', 'ladder')) return onWall(f, inset);
        ladder(h, f);
        return null;
      case 'door':
        if (f.variant === 'hatch') return undefined;
        // A door whose cell is above the house opens from the roof (J26): it stands in its own housing.
        if (f.cell !== undefined && !has(f.cell) && has(below(f.cell))) return roofDoor(h, f);
        return onWall(f, inset);
      case 'hayloft':
        return gableFrame(h, f) ?? null;
      case 'barn-doors':
      case 'mill-race':
      case 'loading-doors':
      case 'forge-front':
      case 'bridge-brackets':
      case 'balcony':
      case 'portico':
      case 'vista':
      case 'arcade':
        return onWall(f, inset);
      case 'corner-oriel':
        return cornerFrame(f, inset);
      default:
        return undefined;
    }
  });
  return { mesh: b.build(), anchors };
}

/** The frame of a feature on a facade: on the wall plane, not on the cell line. */
function onWall(f: Feature, inset: number): Mat4Like | undefined {
  if (f.cell === undefined || f.dir === undefined) return undefined;
  return multiply(faceFrame(f.cell, f.dir), translation(0, 0, -inset));
}

/** U10: the corner to the right of a facade (facing it), where its wall plane meets the next one; +Z out of the corner. */
function cornerFrame(f: Feature, inset: number): Mat4Like | undefined {
  if (f.cell === undefined || f.dir === undefined) return undefined;
  const d = f.dir as Dir4, r = rightOf(d);
  const [dx, dz] = DIR4[d]!, [rx, rz] = DIR4[r]!;
  const k = 0.5 - inset;
  return facingFrame([keyX(f.cell) + 0.5 + (dx + rx) * k, keyY(f.cell) * CELL_H, keyZ(f.cell) + 0.5 + (dz + rz) * k], dx + rx, dz + rz);
}

/** A plain timber ladder down a wall (R-H04): from just above the floor to the water or the ground below. */
function ladder(h: House, f: Feature): void {
  const at = onWall(f, HOUSE.inset);
  if (!at || f.cell === undefined) return;
  const length = (f.params as { length?: number } | undefined)?.length ?? 1;
  const y1 = 0.26, y0 = -length * CELL_H + SEA_Y - 0.06;
  const { b } = h;
  b.at(at, () => {
    b.with({ color: PALETTE.wood, ink: `ladder${f.cell! * 4 + (f.dir ?? 0)}` }, () => {
      for (const x of [-0.1, 0.1]) b.box([x - 0.014, y0, 0.03], [x + 0.014, y1, 0.058]);
      for (let y = y1 - 0.07; y > y0 + 0.03; y -= 0.115) b.box([-0.1, y - 0.011, 0.034], [0.1, y + 0.011, 0.054], { skip: ['e', 'w'] });
    });
  });
}

// ───────────────────────────────────────────────────────────── the shell ──

function shell(h: House): void {
  const { b, s, has, solid, persona } = h;
  const inset = HOUSE.inset, proud = HOUSE.proud;
  const exposed = (c: CellKey, d: Dir4): boolean => has(c) && !has(neighbor(c, d));
  const foundation = new Map<number, number>();
  const cliff = new Set<number>();
  for (const f of h.features) {
    if (f.type !== 'foundation' || f.cell === undefined || f.dir === undefined) continue;
    if (f.variant === 'cliff') cliff.add(edgeId(f.cell, f.dir));
    else foundation.set(edgeId(f.cell, f.dir), (f.params as { depth?: number } | undefined)?.depth ?? 1);
  }
  // J01: base trim only where a cell stands on the ground or on another piece.
  const wooden = h.plan.tags.get(s.id)?.has('plank-walls') ?? false; // a stilt house stands on timber, not stone
  const plinthOn = (c: CellKey, d: Dir4): boolean => !wooden && exposed(c, d) && !has(below(c)) && solid(below(c)) && !cliff.has(edgeId(c, d));
  // A cell with air under it (carried by brackets, a pillar or stilts) rests on a timber beam instead.
  const beamOn = (c: CellKey, d: Dir4): boolean => exposed(c, d) && !has(below(c)) && (wooden || !solid(below(c)));
  const beltOn = (c: CellKey, d: Dir4): boolean => persona.storeyBands && exposed(c, d) && exposed(above(c), d);
  // Where the ground beside reaches the band's storey line, the band's top stands a hair (0.004) over it.
  const buried = (c: CellKey, d: Dir4): boolean => {
    const n = neighbor(c, d);
    return n !== NO_CELL && inColumnBounds(keyX(n), keyZ(n)) && keyY(n) < h.plan.terrain.height[columnIndex(keyX(n), keyZ(n))]!;
  };
  const foundOn = (c: CellKey, d: Dir4): boolean => foundation.has(edgeId(c, d));
  const glass = h.plan.tags.get(s.id)?.has('glass-walls') ?? false;
  const chapel = h.plan.roles.get(s.id)?.role === 'chapel';
  const doors = new Set<number>();
  for (const f of h.features) if (f.type === 'door' && f.cell !== undefined && f.dir !== undefined) doors.add(edgeId(f.cell, f.dir));
  const caps = (e: WallEdge, on: (c: CellKey, d: Dir4) => boolean): { capLeft: boolean; capRight: boolean } => ({
    capLeft: !on(...partner(e, 'left')),
    capRight: !on(...partner(e, 'right')),
  });

  for (const cell of s.cells) {
    const mat = h.material(cell);
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      if (!exposed(cell, d)) continue;
      const e = wallEdge(has, cell, d);
      b.at(faceFrame(cell, d), () => {
        // J02: one wall surface, one ink group, through every cell and storey.
        b.with({ color: mat.color, pattern: mat.pattern, ink: 'walls' }, () => wallFace(b, e, inset, 0, CELL_H));
        if (plinthOn(cell, d)) {
          b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'plinth' }, () =>
            band(b, e, inset - proud, inset, 0, chapel ? HOUSE.plinthH + 0.05 : HOUSE.plinthH, caps(e, plinthOn)));
        } else if (beamOn(cell, d)) {
          b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'beam' }, () =>
            band(b, e, inset - proud, inset, 0, 0.07, caps(e, beamOn)));
        }
        if (beltOn(cell, d)) {
          b.with({ color: persona.trim, ink: 'belt' }, () =>
            band(b, e, inset - proud, inset, CELL_H - HOUSE.trimH, CELL_H + (buried(cell, d) ? 0.004 : 0), caps(e, beltOn)));
        }
        // R-H01: a chapel's walls are buttressed: one where each bay meets the next, one near each corner.
        if (chapel) {
          const at: number[] = [];
          const doorHere = doors.has(edgeId(cell, d));
          if (e.right === 0) at.push(0.5);
          if (e.right === 1 && !doorHere) at.push(0.5 - inset - 0.075);
          if (e.left === 1 && !doorHere) at.push(-0.5 + inset + 0.075);
          const carriesOn = exposed(above(cell), d);
          b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'buttress' }, () => {
            for (const x of at) buttress(b, x, -inset, carriesOn);
          });
        }
        // R-H13: a greenhouse wall is glass in a white frame: a sill rail, a head rail, glazing bars.
        if (glass) {
          b.with({ color: persona.trim, ink: 'glazing' }, () => {
            band(b, e, inset - 0.018, inset, CELL_H - 0.05, CELL_H, { noTop: true });
            band(b, e, inset - 0.018, inset, 0.27, 0.3);
            for (const x of [-0.25, 0, 0.25]) b.box([x - 0.013, HOUSE.plinthH, -inset], [x + 0.013, CELL_H - 0.05, -inset + 0.018], { skip: ['n', 'top', 'bottom'] });
          });
          // The plants inside, seen through the glass: leafy shapes behind the bars, in the wall's
          // own ink group so nothing outlines them. At night they are silhouettes against the light.
          if (!doors.has(edgeId(cell, d))) {
            const z = -inset + 0.004;
            const leafs = [PALETTE.leafDark, PALETTE.bush, PALETTE.leaf];
            const fruit = [PALETTE.red, PALETTE.yellow, PALETTE.pink];
            for (let i = 0; i < 3; i++) {
              const r = (...k: (number | string)[]): number => rand(s.seed, 'plant', cell, d, i, ...k);
              const cx = -0.3 + i * 0.3 + (r('x') - 0.5) * 0.12, rad = 0.075 + r('r') * 0.05, cy = 0.31 + rad * 0.8 + r('y') * 0.14;
              const pts: Vec3[] = [];
              for (let k = 0; k < 9; k++) {
                const a = (k / 9) * Math.PI * 2, w = 1 + (r('w', k) - 0.5) * 0.35;
                pts.push([cx + Math.cos(a) * rad * w, cy + Math.sin(a) * rad * w * 1.15, z]);
              }
              b.with({ color: leafs[Math.floor(r('c') * 3)]!, pattern: PATTERN.none, ink: 'walls' }, () => {
                b.polygon(pts);
                b.quad([cx - 0.012, 0.3, z], [cx + 0.012, 0.3, z], [cx + 0.012, cy, z], [cx - 0.012, cy, z]);
              });
              if (r('fruit') < 0.6) {
                b.with({ color: fruit[Math.floor(r('f') * 3)]!, pattern: PATTERN.none, ink: 'walls' }, () => {
                  for (let k = 0; k < 2; k++) {
                    const fx = cx + (r('fx', k) - 0.5) * rad, fy = cy + (r('fy', k) - 0.5) * rad, q = 0.016;
                    b.quad([fx - q, fy - q, z + 0.002], [fx + q, fy - q, z + 0.002], [fx + q, fy + q, z + 0.002], [fx - q, fy + q, z + 0.002]);
                  }
                });
              }
            }
          }
        }
        // J24: a stone foundation down to the lower ground on this side.
        const depth = foundation.get(edgeId(cell, d));
        if (depth !== undefined) {
          // Its top stands a hair above the floor line, where the ground or a deck it borders lies;
          // and it stops at the cell line where another building stands beside it, whose own
          // foundation would otherwise lap over this one in the same plane.
          const beside = (lateral: Dir4): boolean => {
            const n = neighbor(cell, lateral);
            return n !== NO_CELL && !has(n) && h.plan.kinds.get(n) !== undefined;
          };
          const L = beside(leftOf(d)) && e.left === 1, R = beside(rightOf(d)) && e.right === 1;
          const cap = caps(e, foundOn);
          b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'plinth' }, () =>
            band(b, e, -HOUSE.foundationOut, inset - proud, -depth * CELL_H - 0.03, FOUNDATION_LIFT, {
              capLeft: cap.capLeft || L,
              capRight: cap.capRight || R,
              ...(L ? { left: 0 as const } : {}),
              ...(R ? { right: 0 as const } : {}),
            }));
        }
      });
    }
  }
}

/**
 * A stepped buttress against a wall at x (in the wall's face frame, the wall at z = `wall`): a
 * lower stage 0.09 proud, a sloped weathering, an upper stage 0.05 proud, and a sloped head. On
 * a storey with another above it, the lower stage simply runs the full height.
 */
function buttress(b: MeshBuilder, x: number, wall: number, carriesOn: boolean): void {
  const w = 0.055, p1 = 0.09, p2 = 0.05;
  const x0 = x - w, x1 = x + w;
  if (carriesOn) {
    b.box([x0, 0, wall], [x1, CELL_H, wall + p1], { skip: ['n', 'bottom', 'top'] });
    return;
  }
  const y1 = 0.4, y2 = 0.62, s = 0.07;
  b.box([x0, 0, wall], [x1, y1, wall + p1], { skip: ['n', 'bottom', 'top'] });
  b.box([x0, y1, wall], [x1, y2, wall + p2], { skip: ['n', 'bottom', 'top'] });
  // The weathering between the stages, and the head running back into the wall.
  b.quad([x0, y1, wall + p1], [x1, y1, wall + p1], [x1, y1 + s, wall + p2], [x0, y1 + s, wall + p2]);
  b.tri([x1, y1, wall + p1], [x1, y1, wall + p2], [x1, y1 + s, wall + p2]);
  b.tri([x0, y1, wall + p2], [x0, y1, wall + p1], [x0, y1 + s, wall + p2]);
  b.quad([x0, y2, wall + p2], [x1, y2, wall + p2], [x1, y2 + s, wall], [x0, y2 + s, wall]);
  b.tri([x1, y2, wall + p2], [x1, y2, wall], [x1, y2 + s, wall]);
  b.tri([x0, y2, wall], [x0, y2, wall + p2], [x0, y2 + s, wall]);
}

// ───────────────────────────────────────────────────────────── the roofs ──

type Side = 'free' | 'party' | 'wall' | 'tower';

/** Ridge tiles: a tone darker than the roof they cap (white bars on a glass roof). */
function capColor(p: Personality): ColorInput {
  if (p.cover === 'glass') return p.trim;
  return mixColor(p.roofColor, p.cover === 'thatch' ? PALETTE.trunk : PALETTE.ink, p.cover === 'thatch' ? 0.3 : 0.2);
}

/**
 * Tile tone: a long roof is laid in two or three seeded bands of slightly different lightness
 * (±6%, ART.md section 6), a cell or two wide, so it never reads as one flat sheet. Short roofs
 * are one tone.
 */
function tileTone(seed: number, region: RoofRegion, p: Personality): ((x: number, z: number) => ColorInput) | undefined {
  const alongX = region.width >= region.depth;
  const length = alongX ? region.width : region.depth;
  if (length < 3 || p.cover === 'glass') return undefined;
  const start = alongX ? region.box.x0 : region.box.z0;
  const shift = rand(seed, 'tone-shift', region.index) < 0.5 ? 0 : 1;
  const base = mixColor(p.roofColor, p.roofColor, 0);
  const tones = new Map<number, ColorInput>();
  return (x, z) => {
    const band = Math.floor((Math.floor(alongX ? x : z) - start + shift) / 2);
    let tone = tones.get(band);
    if (!tone) {
      const k = 1 + (rand(seed, 'tone', region.index, band) - 0.5) * HOUSE.tileTone * 2;
      tone = [Math.min(255, Math.round(base[0] * k)), Math.min(255, Math.round(base[1] * k)), Math.min(255, Math.round(base[2] * k))];
      tones.set(band, tone);
    }
    return tone;
  };
}
/** Thickness of a stepped gable's parapet. */
const STEP_GABLE = 0.09;

function roofs(h: House): void {
  const { b, s, plan, has, solid, persona } = h;
  const role = plan.roles.get(s.id)?.role;
  const regions = roofRegions(plan.facts).byStructure.get(s.id) ?? [];
  const roofFeature = new Map<number, Feature>();
  for (const f of h.features) if (f.type === 'roof' && f.region !== undefined) roofFeature.set(f.region, f);
  const collars = new Set<CellKey>();
  for (const f of h.features) if (f.type === 'collar' && f.cell !== undefined) collars.add(below(f.cell));

  for (const region of regions) {
    const pierced = new Set(region.pierced);
    const cells = region.cells.filter((c) => !pierced.has(c));
    const top = (region.level + 1) * CELL_H;
    const f = roofFeature.get(region.index);
    const variant = f?.variant ?? 'gable';
    const params = (f?.params ?? {}) as { ridge?: 'x' | 'z'; lift?: number; against?: number };
    const roofed = new Set(cells);
    const side = (c: CellKey, d: Dir4): Side => {
      const n = neighbor(c, d);
      if (n !== NO_CELL && pierced.has(n)) return 'tower';
      if (has(n)) return 'wall'; // a member that is not in this region rises higher
      // Only the side neighbour itself: the cell above it is diagonal to this house and not in its hash.
      if (n !== NO_CELL && solid(n)) return 'party';
      return 'free';
    };

    if (cells.length > 0 && variant === 'flat') terrace(h, region, cells, side);
    else if (cells.length > 0) {
      const ridge = params.ridge ?? (region.width >= region.depth ? 'x' : 'z');
      const against = params.against as Dir4 | undefined;
      const stepped = variant === 'stepped-gable';
      const mode = (c: CellKey, d: Dir4): EdgeMode => {
        const what = side(c, d);
        // Round a tower the roof simply runs up to it; the collar closes the joint.
        if (what === 'tower') return 'cut';
        if (variant === 'hip') return what === 'free' ? 'eave' : what === 'party' ? 'eave0' : 'wall';
        if (variant === 'lean-to' && against !== undefined) {
          if (d === opposite(against)) return what === 'free' ? 'eave' : what === 'wall' ? 'gutter' : 'eave0';
          return what === 'free' ? (d === against ? 'cut' : 'rake') : what === 'wall' ? 'wall' : 'cut';
        }
        // gable: the sides along the ridge are eaves, the ends are cut.
        const end = ridge === 'x' ? d === 1 || d === 3 : d === 0 || d === 2;
        if (!end) return what === 'free' ? 'eave' : what === 'wall' ? 'gutter' : 'eave0';
        return what === 'free' ? (stepped ? 'inset' : 'rake') : what === 'wall' ? 'wall' : 'cut';
      };
      const length = Math.max(region.width, region.depth);
      const field = roofField({
        cells,
        mode,
        base: top - HOUSE.eaveDrop,
        pitch: variant === 'lean-to' ? HOUSE.leanRise : undefined,
        // A wing under a taller part of the house keeps its ridge below that part's windows.
        rise: region.againstTaller.length > 0 ? [HOUSE.rise1, Math.min(HOUSE.rise2, 0.7), Math.min(HOUSE.rise3, 0.7)] : [HOUSE.rise1, HOUSE.rise2, HOUSE.rise3],
        lift: params.lift ?? 0,
        sag: Math.min(HOUSE.sagMax, HOUSE.sag * length),
        tilt: persona.lean * 0.025,
        eave: HOUSE.eave,
        rake: HOUSE.rake,
        into: HOUSE.inset + 0.005,
        trim: HOUSE.inset + STEP_GABLE - 0.005,
      });
      for (const c of cells) h.fields.set(c, field);
      emitRoof(b, field, {
        color: persona.roofColor,
        pattern: persona.cover === 'thatch' ? PATTERN.thatch : persona.cover === 'glass' ? PATTERN.glass : PATTERN.shingles,
        ink: `roof${region.index}`,
        thick: HOUSE.roofThick,
        fascia: persona.trim,
        fasciaInk: `fascia${region.index}`,
        cap: { color: capColor(persona), ink: `ridge${region.index}`, width: HOUSE.capWidth, proud: role === 'chapel' ? HOUSE.capProud * 1.6 : HOUSE.capProud },
        tone: tileTone(s.seed, region, persona),
      });
      // Gable walls: where the roof is cut off, the wall below carries on up to it.
      for (const c of cells) {
        for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
          if (roofed.has(neighbor(c, d))) continue;
          const m = field.mode(c, d);
          if (m !== 'rake' && m !== 'cut' && m !== 'inset') continue;
          const inner = has(neighbor(c, d)); // towards a pierced cell: flush with the cell line
          const e = inner ? wallEdge((k) => roofed.has(k), c, d) : wallEdge(has, c, d);
          const stepsHere = m === 'inset';
          gableWall(h, field, e, inner ? 0 : HOUSE.inset, top, stepsHere);
        }
      }
    }

    // Under another structure standing on the roof: a flat top, and a collar round a tower (J12).
    for (const c of region.pierced) {
      const x = keyX(c), z = keyZ(c);
      const i = HOUSE.inset;
      const x0 = x + (has(neighbor(c, 3)) ? 0 : i), x1 = x + 1 - (has(neighbor(c, 1)) ? 0 : i);
      const z0 = z + (has(neighbor(c, 0)) ? 0 : i), z1 = z + 1 - (has(neighbor(c, 2)) ? 0 : i);
      if (!collars.has(c)) {
        b.with({ color: persona.trim, ink: `cap${region.index}` }, () => b.box([x0, top - 0.01, z0], [x1, top, z1], { only: ['top'] }));
        continue;
      }
      // The collar stands a little above the highest roof line that meets it.
      let high = top + 0.1;
      for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
        const n = neighbor(c, d);
        const field = n === NO_CELL ? undefined : h.fields.get(n);
        if (!field) continue;
        const [dx, dz] = DIR4[d]!;
        for (const t of [-0.5, 0, 0.5]) high = Math.max(high, field.heightAt(n, x + 0.5 + 0.5 * dx + dz * t, z + 0.5 + 0.5 * dz - dx * t) + 0.09);
      }
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: `collar${c}` }, () => b.box([x0 - 0.0, top, z0 - 0.0], [x1, high, z1], { skip: ['bottom'] }));
      b.with({ color: persona.trim, ink: `collar-cap${c}` }, () => b.box([x0 - 0.035, high, z0 - 0.035], [x1 + 0.035, high + 0.045, z1 + 0.035]));
    }
  }
}

/** The wall under a cut-off roof edge, from the storey's top up to the roof. In the edge's face frame. */
function gableWall(h: House, field: RoofField, e: WallEdge, inset: number, top: number, stepped: boolean): void {
  const { b } = h;
  const frame = faceFrame(e.cell, e.dir);
  // Some houses have half-timbered gables over plain walls.
  const mat = !stepped && inset > 0 ? gableMaterial(h, e.cell) : h.material(e.cell);
  const xl = leftX(e, inset), xr = rightX(e, inset);
  const heightAt = (x: number): number => {
    const p = transformPoint(frame, [x, 0, -inset - 0.001]);
    // A hair under the roof, so the wall's top edge never shows through the slope it meets.
    return field.heightAt(e.cell, p[0], p[2]) - top - 0.012;
  };
  b.at(compose(frame, translation(0, top - keyY(e.cell) * CELL_H, 0)), () => {
    if (!stepped) {
      const xs = [xl, 0, xr];
      b.with({ color: mat.color, pattern: mat.pattern, ink: 'walls' }, () => {
        for (let i = 0; i + 1 < xs.length; i++) {
          const a = xs[i]!, c = xs[i + 1]!;
          const ha = Math.max(0, heightAt(a)), hc = Math.max(0, heightAt(c));
          if (ha <= 1e-4 && hc <= 1e-4) continue;
          b.quad([a, 0, -inset], [c, 0, -inset], [c, hc, -inset], [a, ha, -inset]);
        }
      });
      return;
    }
    // A stepped (crow-step) gable: the wall rises past the roof in steps, each with a coping.
    // The roof stops at the parapet's back (the 'inset' edge mode), so nothing shows in front.
    const n = 5, back = inset + STEP_GABLE;
    const w = (xr - xl) / n;
    const tops: number[] = [];
    for (let k = 0; k < n; k++) {
      const a = xl + k * w, c = a + w;
      tops.push(Math.max(heightAt(a), heightAt(c), heightAt((a + c) / 2)) + 0.085);
    }
    b.with({ color: mat.color, pattern: mat.pattern, ink: 'walls' }, () => {
      for (let k = 0; k < n; k++) {
        const a = xl + k * w, c = a + w, t = tops[k]!;
        b.quad([a, 0, -inset], [c, 0, -inset], [c, t, -inset], [a, t, -inset]);
        b.quad([c, 0, -back], [a, 0, -back], [a, t, -back], [c, t, -back]);
        const lo = k > 0 ? Math.min(t, tops[k - 1]!) : 0, ro = k + 1 < n ? Math.min(t, tops[k + 1]!) : 0;
        if (t > lo) b.quad([a, lo, -back], [a, lo, -inset], [a, t, -inset], [a, t, -back]);
        if (t > ro) b.quad([c, ro, -inset], [c, ro, -back], [c, t, -back], [c, t, -inset]);
      }
    });
    b.with({ color: h.persona.trim, ink: `coping${e.cell * 4 + e.dir}` }, () => {
      for (let k = 0; k < n; k++) {
        const a = xl + k * w, c = a + w, t = tops[k]!;
        b.box([a - 0.012, t, -back - 0.012], [c + 0.012, t + 0.03, -inset + 0.012], { skip: ['bottom'] });
      }
    });
  });
}

/** A flat, walkable roof with a low parapet on its open sides. */
function terrace(h: House, region: RoofRegion, cells: readonly CellKey[], side: (c: CellKey, d: Dir4) => Side): void {
  const { b, plan, persona } = h;
  const top = (region.level + 1) * CELL_H;
  const i = HOUSE.inset;
  const roofed = new Set(cells);
  const inRoof = (c: CellKey): boolean => c !== NO_CELL && roofed.has(c);
  const ext = (c: CellKey, d: Dir4): number => (inRoof(neighbor(c, d)) ? 0 : side(c, d) === 'wall' ? i : side(c, d) === 'tower' ? 0 : side(c, d) === 'party' ? 0 : -i);
  // Stairs beside the roof, or ground level with it, leave the parapet open there.
  const open = (c: CellKey, d: Dir4): boolean => {
    const n = neighbor(c, d);
    if (n === NO_CELL) return false;
    if (plan.kinds.get(n) === 'stairs') return true;
    const x = keyX(n), z = keyZ(n);
    return inColumnBounds(x, z) && plan.terrain.height[columnIndex(x, z)]! >= region.level + 1;
  };
  // J05/J19: a side that carries a railing or an edge piece gets a low coping, not a parapet.
  const coped = new Set<number>();
  for (const f of h.features) if (f.type === 'coping' && f.cell !== undefined && f.dir !== undefined) coped.add(edgeId(f.cell, f.dir));
  const rim = (c: CellKey, d: Dir4): boolean => inRoof(c) && !inRoof(neighbor(c, d)) && side(c, d) === 'free' && !open(c, d);
  const parapetOn = (c: CellKey, d: Dir4): boolean => rim(c, d) && !coped.has(edgeId(c, d));
  const copingOn = (c: CellKey, d: Dir4): boolean => rim(c, d) && coped.has(edgeId(c, d));
  // The paving a hair (0.004) over the storey line: on a party side it runs to the cell line, over the
  // cornice a marble block beside it reaches out at that line.
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.paving, ink: `terrace${region.index}` }, () => {
    for (const c of cells) {
      const x = keyX(c), z = keyZ(c);
      b.box([x - ext(c, 3), top - 0.01, z - ext(c, 0)], [x + 1 + ext(c, 1), top + 0.004, z + 1 + ext(c, 2)], { only: ['top'] });
    }
  });
  for (const c of cells) {
    const mat = h.material(c);
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      if (copingOn(c, d)) {
        const e = wallEdge(inRoof, c, d);
        b.at(compose(faceFrame(c, d), translation(0, CELL_H, 0)), () =>
          b.with({ color: persona.trim, ink: `coping${region.index}` }, () =>
            band(b, e, i - 0.018, i + 0.098, -0.012, 0.048, { inner: true, capLeft: !copingOn(...partner(e, 'left')), capRight: !copingOn(...partner(e, 'right')) })));
        continue;
      }
      if (!parapetOn(c, d)) continue;
      const e = wallEdge(inRoof, c, d);
      const capL = !parapetOn(...partner(e, 'left')), capR = !parapetOn(...partner(e, 'right'));
      b.at(compose(faceFrame(c, d), translation(0, CELL_H, 0)), () => {
        b.with({ color: mat.color, pattern: mat.pattern, ink: 'walls' }, () =>
          band(b, e, i, i + 0.08, 0, HOUSE.parapetH, { inner: true, noTop: true, capLeft: capL, capRight: capR }));
        b.with({ color: persona.trim, ink: `coping${region.index}` }, () =>
          band(b, e, i - 0.018, i + 0.098, HOUSE.parapetH, HOUSE.parapetH + 0.026, { inner: true, capLeft: capL, capRight: capR }));
      });
    }
  }
}

// ──────────────────────────────────────────── frames for roof-borne parts ──

/** A chimney stands astride the ridge of its cell, a little off centre, leaning a touch. */
function chimneyFrame(h: House, f: Feature): Mat4Like | null | undefined {
  if (f.cell === undefined) return undefined;
  const field = h.fields.get(f.cell);
  if (!field) return undefined; // on a flat roof or terrace: the cell's floor centre is right
  const seed = h.s.seed;
  // A tall flue climbs the taller wall beside it: its frame is on that wall, at this roof's wall top.
  const against = (f.params as { against?: number } | undefined)?.against as Dir4 | undefined;
  if (f.variant === 'tall-flue' && against !== undefined) {
    const n = neighbor(f.cell, against);
    const theirs = n !== NO_CELL && h.plan.kinds.get(n) === 'house' ? HOUSE.inset : 0; // a house wall stands inside its cell line
    const along = (rand(seed, 'flue-along', f.cell) - 0.5) * 0.4;
    return compose(faceFrame(f.cell, against), translation(along, CELL_H, theirs));
  }
  const c = field.crest(f.cell);
  // Which way the ridge runs here: the direction in which the roof does not fall away.
  const fallX = c.y - Math.min(field.heightAt(f.cell, c.x + 0.2, c.z), field.heightAt(f.cell, c.x - 0.2, c.z));
  const fallZ = c.y - Math.min(field.heightAt(f.cell, c.x, c.z + 0.2), field.heightAt(f.cell, c.x, c.z - 0.2));
  const along = (rand(seed, 'chimney-along', f.cell) < 0.5 ? -1 : 1) * (0.17 + rand(seed, 'chimney-off', f.cell) * 0.08);
  const down = (rand(seed, 'chimney-side', f.cell) < 0.5 ? -1 : 1) * 0.07;
  const alongX = fallX <= fallZ;
  const x = clampIn(keyX(f.cell), c.x + (alongX ? along : down));
  const z = clampIn(keyZ(f.cell), c.z + (alongX ? down : along));
  const y = field.heightAt(f.cell, x, z);
  const lean = (rand(seed, 'chimney-lean', f.cell) - 0.5) * 0.09;
  return compose(translation(x, y, z), rotationY(alongX ? 0 : Math.PI / 2), rotationZ(lean));
}
const clampIn = (cell0: number, v: number): number => Math.max(cell0 + 0.14, Math.min(cell0 + 0.86, v));

/** A finial stands on the ridge at the gable end it names. */
function finialFrame(h: House, f: Feature): Mat4Like | null | undefined {
  if (f.cell === undefined) return undefined;
  const field = h.fields.get(f.cell);
  if (!field) return undefined;
  const c = field.crest(f.cell);
  let x = c.x, z = c.z;
  if (f.dir !== undefined) {
    const [dx, dz] = DIR4[f.dir]!;
    if (dx !== 0) x = keyX(f.cell) + 0.5 + dx * (0.5 - HOUSE.inset);
    if (dz !== 0) z = keyZ(f.cell) + 0.5 + dz * (0.5 - HOUSE.inset);
  }
  return translation(x, field.heightAt(f.cell, x, z), z);
}

/** A dormer sits half-way up the slope that faces its direction. */
function dormerFrame(h: House, f: Feature): Mat4Like | null | undefined {
  if (f.cell === undefined || f.dir === undefined) return undefined;
  const field = h.fields.get(f.cell);
  if (!field) return null;
  const [dx, dz] = DIR4[f.dir]!;
  const x = keyX(f.cell) + 0.5 + dx * 0.2, z = keyZ(f.cell) + 0.5 + dz * 0.2;
  return facingFrame([x, field.heightAt(f.cell, x, z), z], dx, dz);
}

/**
 * A round or rose window sits in the middle of its gable: centred across the
 * whole gable end (which may be two cells wide) and a third of the way up.
 * Null if the cell side is not a gable end after all.
 */
function gableFrame(h: House, f: Feature): Mat4Like | null {
  if (f.cell === undefined || f.dir === undefined) return null;
  const field = h.fields.get(f.cell);
  const m = field?.mode(f.cell, f.dir);
  if (!field || (m !== 'rake' && m !== 'cut' && m !== 'inset')) return null;
  // The run of cells that share this gable end.
  let lo = 0, hi = 0;
  const L = leftOf(f.dir), R = rightOf(f.dir);
  for (let c = neighbor(f.cell, L); c !== NO_CELL && field.has(c) && field.mode(c, f.dir) === m; c = neighbor(c, L)) lo--;
  for (let c = neighbor(f.cell, R); c !== NO_CELL && field.has(c) && field.mode(c, f.dir) === m; c = neighbor(c, R)) hi++;
  const frame = faceFrame(f.cell, f.dir);
  const mid = (lo + hi) / 2;
  const top = (keyY(f.cell) + 1) * CELL_H;
  const p = transformPoint(frame, [mid, 0, -HOUSE.inset - 0.001]);
  const peak = field.heightAt(f.cell, p[0], p[2]) - top;
  if (peak < 0.3) return null;
  const wide = hi - lo + 1;
  const scale = f.variant === 'rose' ? Math.min(1.6, 0.7 + 0.3 * wide) : Math.min(1.3, 0.85 + 0.15 * wide);
  // The parts draw these windows centred half-way up a storey; lift that point to a third of the gable.
  return compose(frame, translation(mid, CELL_H + peak * 0.36, -HOUSE.inset), scaling(scale), translation(0, -CELL_H / 2, 0));
}

export default defineGenerator({
  kind: 'house',
  build: buildHouse,
});
