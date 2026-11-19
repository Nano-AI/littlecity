// The windmill generator (Houses owner; R-W01, J25). A round tapered tower
// on a stone foot, small windows winding up it, and a boat-shaped cap whose
// hub carries the sails. The sails are NOT drawn here: they are an actor
// (src/parts/openings/windmill-sails.part.ts) at the 'mill-hub' socket this
// file reports, so the Animation owner can turn them.
//
// The cap is the structure's 'cap/mill-cap' feature; this generator draws it
// itself (it must fit the tower's neck) and reports the hub frame for the
// socket the feature owns. The door is a 'door' feature drawn by the door
// part on the tower's leaning wall.

import { CELL_H, DIR4, keyX, keyY, keyZ, type Dir4 } from '@/core/grid';
import { compose, rotationX, rotationY, scaling, translation, type Mat4Like } from '@/core/mat4';
import { rand } from '@/core/rand';
import { RAMPS, PALETTE } from '@/style/palette';
import { WINDMILL } from '@/style/houses';
import { defineGenerator, placeFeatures } from '../api';
import { MeshBuilder, PATTERN } from '../mesh';

/** The rotation about Y that turns +Z to face side `dir`. */
const yawOf = (dir: Dir4): number => Math.atan2(DIR4[dir]![0], DIR4[dir]![1]);

export default defineGenerator({
  kind: 'windmill',
  build(s, plan, parts) {
    const b = new MeshBuilder({ ink: s.id });
    const anchors: Record<string, Mat4Like> = {};
    const cells = [...s.cells].sort((a, c) => keyY(a) - keyY(c));
    const bottom = cells[0]!;
    const n = cells.length;
    const H = n * CELL_H;
    const cx = keyX(bottom) + 0.5, cz = keyZ(bottom) + 0.5, y0 = keyY(bottom) * CELL_H;
    const raised = plan.tags.get(s.id)?.has('raised') ?? false;
    const foot = raised ? 0.36 : WINDMILL.footR + Math.min(0.06, (n - 1) * 0.03);
    const neck = WINDMILL.neckR;
    const radiusAt = (y: number): number => foot + (neck - foot) * (y / H);
    const lean = Math.atan2(foot - neck, H); // how far the wall leans in from upright
    const features = plan.featuresByStructure.get(s.id) ?? [];
    const cap = features.find((f) => f.type === 'cap');
    const facing = (cap?.dir ?? 2) as Dir4;
    const door = features.find((f) => f.type === 'door');

    b.at(translation(cx, y0, cz), () => {
      // Foot: a stone ring. Body: one smooth white surface, a hair fatter in the middle like a drawn line.
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'foot' }, () =>
        b.lathe([[foot + 0.045, 0], [foot + 0.045, 0.09], [foot + 0.01, 0.12]], { segments: 16 }));
      b.with({ color: PALETTE.white, pattern: PATTERN.plaster, ink: 'body' }, () =>
        b.lathe([[foot, 0], [radiusAt(H * 0.5) + 0.012, H * 0.5], [neck, H]], { segments: 16 }));
      // A band course where each further cell begins, so a tall mill has storeys.
      for (let k = 1; k < n; k++) {
        const y = k * CELL_H, r = radiusAt(y) + 0.012;
        b.with({ color: PALETTE.stoneShade, ink: `band${k}` }, () => b.lathe([[r + 0.02, y - 0.03], [r + 0.02, y + 0.03]], { segments: 16, capTop: true }));
      }
      // Windows: two per storey on opposite sides, winding a quarter turn each storey, so every
      // quarter of the compass sees some. Never where the door is, nor behind the sails.
      for (let k = 0; k < n; k++) {
        const y = k * CELL_H + 0.42;
        for (const side of [1, 3]) {
          const d = (((((door?.dir ?? facing) + side + k) % 4) + 4) % 4) as Dir4;
          if ((k === 0 && d === door?.dir) || (k === n - 1 && d === facing)) continue;
          b.at(compose(rotationY(yawOf(d)), translation(0, y, radiusAt(y) - 0.012), rotationX(-lean)), () => {
            b.with({ color: PALETTE.stoneShade, ink: `window${k}-${side}` }, () => {
              b.box([-0.085, -0.11, 0], [0.085, 0.13, 0.045], { skip: ['n'] });
              b.box([-0.11, -0.145, 0], [0.11, -0.11, 0.07], { skip: ['n'] });
              b.with({ color: PALETTE.glass, pattern: PATTERN.glass }, () => b.quad([-0.05, -0.08, 0.049], [0.05, -0.08, 0.049], [0.05, 0.1, 0.049], [-0.05, 0.1, 0.049]));
            });
          });
        }
      }
      // J25: a raised mill gets a timber gallery under the cap.
      if (features.some((f) => f.type === 'gallery')) {
        const y = H - 0.5, r = radiusAt(y);
        b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'gallery' }, () => {
          b.lathe([[r, y - 0.06], [r + 0.2, y - 0.02], [r + 0.2, y + 0.02]], { segments: 12, capTop: true });
        });
        b.with({ color: PALETTE.wood, ink: 'gallery-rail' }, () => {
          b.lathe([[r + 0.185, y + 0.2], [r + 0.2, y + 0.225]], { segments: 12, capTop: false });
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            b.boxAt([Math.cos(a) * (r + 0.19), y + 0.02, Math.sin(a) * (r + 0.19)], [0.025, 0.19, 0.025], { skip: ['bottom', 'top'] });
          }
        });
      }

      // The cap: a boat-shaped hood turned to face `facing`, on a white curb ring.
      const roof = RAMPS.roof[rand(s.seed, 'cap') < 0.7 ? 0 : 4]!;
      b.at(compose(translation(0, H, 0), rotationY(yawOf(facing))), () => {
        b.with({ color: PALETTE.white, ink: 'curb' }, () => b.lathe([[neck + 0.035, -0.03], [neck + 0.035, 0.035]], { segments: 16, capTop: true }));
        b.with({ color: roof, pattern: PATTERN.shingles, ink: 'cap' }, () => {
          // Longer front to back than side to side, like an upturned boat.
          b.at(compose(translation(0, 0.035, -0.03), scaling(1, 1, 1.22)), () =>
            b.lathe([[neck + 0.05, 0], [neck + 0.02, 0.13], [neck * 0.72, 0.25], [neck * 0.34, 0.33], [0, 0.36]], { segments: 14 }));
        });
        // A ball on the crown.
        b.with({ color: PALETTE.white, ink: 'crown' }, () => b.at(translation(0, 0.4, -0.03), () => b.lathe([[0, -0.045], [0.032, -0.032], [0.045, 0], [0.032, 0.032], [0, 0.045]], { segments: 8 })));
        // The windshaft: a stub out of the cap's face for the sails to sit on.
        b.with({ color: PALETTE.wood, ink: 'shaft' }, () =>
          b.at(compose(translation(0, 0.17, neck + 0.02), rotationX(Math.PI / 2 - 0.1)), () => b.lathe([[0.045, 0], [0.04, 0.16]], { segments: 8, capTop: true })));
      });
    });

    // The hub: where the sails turn. +Z runs along the windshaft, out of the cap, tipped up a little.
    const hub = compose(translation(cx, y0 + H + 0.17, cz), rotationY(yawOf(facing)), translation(0, 0, neck + 0.02), rotationX(-0.1), translation(0, 0, 0.17));
    if (cap) for (const socket of plan.socketsByOwner.get(cap.id) ?? []) anchors[socket.id] = hub;

    placeFeatures(b, anchors, s, plan, parts, (f) => {
      if (f.type === 'cap' || f.type === 'gallery') return null;
      if (f.type === 'door' && f.dir !== undefined) {
        // On the leaning wall at the foot, a little sunk in so the round wall closes round the frame.
        return compose(translation(cx, y0, cz), rotationY(yawOf(f.dir as Dir4)), translation(0, 0, foot - 0.03), rotationX(-lean));
      }
      return undefined;
    });
    return { mesh: b.build(), anchors };
  },
});
