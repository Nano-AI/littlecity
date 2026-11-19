// The tower (J13): a stack of tower cells is one body. Base trim only at the
// bottom, a band course every two storeys, small windows where the rules put
// them, a slight seeded lean, and a cap by role. Round bodies for the
// watchtower, turret, observatory and dovecote; square ones for the steeple,
// clock tower and campanile, whose top storey may be an open belfry.

import { above, CELL_H, columnIndex, keyX, keyY, keyZ, SEA_Y, type Dir4 } from '@/core/grid';
import { compose, rotationX, rotationY, rotationZ, translation, type Mat4, type Mat4Like } from '@/core/mat4';
import { rand } from '@/core/rand';
import { defineGenerator, placeFeature } from '@/gen/api';
import { featureFrame } from '@/gen/frames';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import type { Feature, ShapePlan, Structure } from '@/resolve/plan';
import { MONUMENTS } from '@/style/monuments';
import { PALETTE, RAMPS, rampColor } from '@/style/palette';
import { battlementCap, coneCap, domeCap, dovecoteCap, flatCap, pyramidCap, spireCap, type CapLook } from '@/parts/monuments/caps';
import { ownSockets, wallFrame } from '@/parts/monuments/kit';
import { arrowSlit, clockFace, doveHoles, slitWindow, towerDoor } from '@/parts/monuments/openings';
import { profileSlab } from '@/parts/monuments/slab';

const DOORS = [PALETTE.redDark, PALETTE.wood, PALETTE.glass, PALETTE.leafDark];

export interface TowerShape {
  storeys: number;
  round: boolean;
  /** Height of the footing it stands on in the sea; 0 on land. */
  foot: number;
  /** The storey (0 = lowest) that is an open belfry, or −1. */
  belfry: number;
  /** A cap is drawn on top (nothing stands on the tower). */
  capped: boolean;
  /** The frame of the tower's foot in the world, lean included. */
  world: Mat4;
}

/** What the generator works out about a tower before drawing (all inside the structure hash). */
export function towerShape(s: Structure, plan: ShapePlan): TowerShape {
  const bottom = s.cells[0]!;
  const top = s.cells[s.cells.length - 1]!;
  const tags = plan.tags.get(s.id);
  const features = plan.featuresByStructure.get(s.id) ?? [];
  const inWater = keyY(bottom) === 0 && plan.terrain.height[columnIndex(keyX(bottom), keyZ(bottom))] === 0;
  const belfryAt = features.find((f) => f.type === 'belfry')?.cell;
  const free = !plan.kinds.has(above(top));
  const lean = free && s.cells.length >= 2 ? MONUMENTS.towerLean : 0;
  const world = compose(
    translation(keyX(bottom) + 0.5, keyY(bottom) * CELL_H, keyZ(bottom) + 0.5),
    rotationZ((rand(s.seed, 'lean-x') - 0.5) * 2 * lean),
    rotationX((rand(s.seed, 'lean-z') - 0.5) * 2 * lean),
  );
  return {
    storeys: s.cells.length,
    round: !(tags?.has('body:square') ?? false),
    foot: inWater ? SEA_Y + MONUMENTS.footingRise : 0,
    belfry: belfryAt === undefined ? -1 : keyY(belfryAt) - keyY(bottom),
    capped: features.some((f) => f.type === 'cap'),
    world,
  };
}

/** A bell hanging from a beam. Origin: the middle of the belfry floor; `span` is the room's width. */
function bell(b: MeshBuilder, span: number, y: number): void {
  b.with({ color: PALETTE.wood, pattern: PATTERN.none, ink: 'bell-beam' }, () => b.boxAt([0, y + 0.3, 0], [span, 0.05, 0.06]));
  b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'bell' }, () =>
    b.lathe([[0.15, y + 0.05], [0.135, y + 0.075], [0.1, y + 0.14], [0.085, y + 0.24], [0.045, y + 0.29], [0, y + 0.3]], { segments: 10, capBottom: true }),
  );
}

export default defineGenerator({
  kind: 'tower',
  build(s, plan, parts) {
    const b = new MeshBuilder({ ink: s.id });
    const anchors: Record<string, Mat4Like> = {};
    const shape = towerShape(s, plan);
    const { storeys: n, round, foot, belfry, world } = shape;
    const bottomY = keyY(s.cells[0]!);
    const stone = rampColor('tower', s.color);
    const roof = RAMPS.roof[Math.floor(rand(s.seed, 'roof') * RAMPS.roof.length)]!;
    const look: CapLook = { stone, roof, vary: rand(s.seed, 'cap') };
    const top = n * CELL_H;
    const R = MONUMENTS.towerRadius, half = MONUMENTS.towerHalf;
    /** Radius (round) or half-width (square) of the body at height y above the foot of the stack. */
    const rAt = (y: number): number => (round ? R - (MONUMENTS.towerBatter * y) / CELL_H : half);
    const features = plan.featuresByStructure.get(s.id) ?? [];

    b.at(world, () => {
      // ── the foot ──
      if (foot > 0) {
        b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'footing' }, () => {
          if (round) b.lathe([[R + 0.13, 0], [R + 0.13, foot - 0.05], [R + 0.08, foot], [0, foot]], { segments: 18 });
          else b.boxAt([0, 0, 0], [half * 2 + 0.22, foot, half * 2 + 0.22], { skip: ['bottom'] });
        });
      }
      const plinthTop = foot + 0.11;
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'plinth' }, () => {
        if (round) b.lathe([[R + 0.065, foot], [R + 0.065, foot + 0.07], [R + 0.02, plinthTop]], { segments: 18 });
        else {
          b.boxAt([0, foot, 0], [half * 2 + 0.12, 0.08, half * 2 + 0.12], { skip: ['bottom'] });
          b.boxAt([0, foot + 0.08, 0], [half * 2 + 0.05, 0.03, half * 2 + 0.05], { skip: ['bottom'] });
        }
      });

      // ── the body ──
      const sill = 0.14; // the belfry's parapet, part of the solid body
      const bodyTop = belfry >= 0 ? belfry * CELL_H + sill : top;
      b.with({ color: stone, pattern: PATTERN.stone, ink: 'body' }, () => {
        if (round) {
          b.lathe([[rAt(plinthTop), plinthTop], [rAt(bodyTop), bodyTop]], { segments: 18 });
        } else {
          b.box([-half, plinthTop, -half], [half, bodyTop, half], { skip: belfry >= 0 ? ['bottom'] : ['bottom', 'top'] });
          if (belfry >= 0) {
            // Four thin walls, each with an arched opening, round the bell.
            const inner = half - 0.085;
            for (let d = 0; d < 4; d++) {
              b.at(rotationY((d * Math.PI) / 2), () =>
                profileSlab(b, {
                  u0: -half, u1: half, v0: bodyTop, v1: top, z0: inner, z1: half,
                  openings: [{ lo: -0.2, hi: 0.2, spring: 0.17, rise: 0.2 }],
                  segments: 10,
                }),
              );
            }
          }
        }
      });
      if (belfry >= 0 && !round) bell(b, half * 2 - 0.1, bodyTop);

      // ── band courses ──
      const every = Math.max(1, Math.round(MONUMENTS.bandEvery));
      for (let k = every; k < n; k += every) {
        const y = k * CELL_H;
        if (belfry >= 0 && k >= belfry) break;
        b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: `band${k}` }, () => {
          const r = rAt(y);
          if (round) b.lathe([[r - 0.005, y - 0.05], [r + 0.035, y - 0.035], [r + 0.035, y + 0.035], [r - 0.005, y + 0.05]], { segments: 18 });
          else b.boxAt([0, y - 0.04, 0], [half * 2 + 0.07, 0.08, half * 2 + 0.07]);
        });
      }
      if (belfry >= 0 && !round) {
        b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'belfry-sill' }, () =>
          b.boxAt([0, bodyTop - 0.05, 0], [half * 2 + 0.08, 0.05, half * 2 + 0.08], { skip: ['bottom'] }),
        );
      }
      if (!shape.capped) b.at(translation(0, top, 0), () => flatCap(b, rAt(top), round));
    });

    // ── features ──
    const wall = (f: Feature, y: number, sink = 0.012): Mat4 => wallFrame(f.dir as Dir4, rAt(y) - (round ? sink : 0), y);
    const storeyOf = (f: Feature): number => keyY(f.cell!) - bottomY;
    for (const f of features) {
      const id = f.id;
      const draw = (local: Mat4Like, fn: (mb: MeshBuilder) => Record<string, Mat4Like> | void): void => {
        const mb = new MeshBuilder({ ink: id });
        const sockets = fn(mb);
        const at = compose(world, local);
        b.add(mb, at);
        if (sockets) ownSockets(plan, anchors, id, at, sockets);
      };
      switch (f.type) {
        case 'cap': {
          const r = rAt(top);
          draw(translation(0, top, 0), (mb) => {
            switch (f.variant) {
              case 'spire': return spireCap(mb, r, look);
              case 'pyramid': return pyramidCap(mb, r, look);
              case 'battlements': return battlementCap(mb, r, look);
              case 'dome': return domeCap(mb, r, { ...look, roof: PALETTE.shallow });
              case 'dovecote': return dovecoteCap(mb, r, look);
              case 'flat': return flatCap(mb, r, round);
              default: return round ? coneCap(mb, r, look) : pyramidCap(mb, r, look);
            }
          });
          break;
        }
        case 'belfry':
          ownSockets(plan, anchors, id, world, { bell: translation(0, storeyOf(f) * CELL_H + 0.4, 0) });
          break;
        case 'window': {
          const y = Math.max(storeyOf(f) * CELL_H, foot) + 0.3 + ((f.params as { lift?: number } | undefined)?.lift ?? 0) + (rand(s.seed, id) - 0.5) * 0.03;
          draw(wall(f, y), (mb) => slitWindow(mb, 'w', PALETTE.stoneShade));
          break;
        }
        case 'arrow-slit':
          draw(wall(f, storeyOf(f) * CELL_H + 0.26, 0.004), (mb) => arrowSlit(mb, 'a', PALETTE.stoneShade));
          break;
        case 'door': {
          const y = Math.max(storeyOf(f) * CELL_H, foot);
          const leaf = DOORS[Math.floor(rand(s.seed, 'door') * DOORS.length)]!;
          draw(wall(f, y, 0.02), (mb) => towerDoor(mb, PALETTE.stoneShade, leaf, (f.params as { steps?: number } | undefined)?.steps ?? 0));
          break;
        }
        case 'clock-face':
          draw(wall(f, storeyOf(f) * CELL_H + 0.42, 0), (mb) => clockFace(mb, 'c', 0.25, 1 + Math.floor(rand(s.seed, 'hour') * 11) + rand(s.seed, 'minute')));
          break;
        case 'dove-holes':
          draw(wall(f, storeyOf(f) * CELL_H + 0.1, 0.01), (mb) => doveHoles(mb, 'd', PALETTE.stoneShade));
          break;
        default: {
          // Anything another owner's rule built into the tower (a collar, a foundation): its part draws it.
          const at = featureFrame(f);
          if (at) placeFeature(b, anchors, f, at, { plan, structure: s, parts });
        }
      }
    }
    return { mesh: b.build(), anchors };
  },
});
