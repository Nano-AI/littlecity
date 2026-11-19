// LOOK FIXTURE. The art guide's "do and don't" pictures: six pairs of small
// samples, the right way in the front row and the wrong way behind it. It
// draws only in the look-dodont scenario (by seed).
//
// Each sample is written the way a generator would write it, so the code
// here is also the worked example for docs/swarm/ART.md.

import { CELL_H, CHUNK } from '@/core/grid';
import { compose, rotationY, rotationZ, translation } from '@/core/mat4';
import { defineLayer } from '@/gen/api';
import { MeshBuilder, PATTERN, type BoxFace } from '@/gen/mesh';
import { PALETTE, RAMPS } from '@/style/palette';

export const DODONT_SEED = 0x100c7e;
/** Sample i stands at x = DODONT_X + i × DODONT_PITCH; "do" at z = DODONT_DO, "don't" at z = DODONT_DONT. */
export const DODONT_X = 14;
export const DODONT_PITCH = 3.4;
export const DODONT_DO = 26;
export const DODONT_DONT = 21;
export const DODONT_NAMES = ['ink groups', 'fine detail', 'palette', 'hand', 'real edges', 'light'] as const;

type Sample = (b: MeshBuilder, good: boolean) => void;

const SAMPLES: Sample[] = [
  // 1. Ink groups. A wall three cells long is ONE surface: one ink group, no faces between the cells.
  //    Don't: an ink group per cell draws a seam at every joint.
  (b, good) => {
    b.setColor(RAMPS.wall[4]!).setPattern(PATTERN.plaster);
    for (let i = 0; i < 3; i++) {
      b.setInk(good ? 'wall' : `wall${i}`);
      const skip: BoxFace[] = ['bottom', 'top']; // the trim band covers the top
      if (good && i > 0) skip.push('w');
      if (good && i < 2) skip.push('e');
      b.box([i - 1.5, 0, -0.4], [i - 0.5, CELL_H, 0.4], { skip });
    }
    b.setColor(PALETTE.white).setPattern(PATTERN.none).setInk('trim');
    b.box([-1.53, CELL_H - 0.05, -0.43], [1.53, CELL_H, 0.43]);
  },
  // 2. Fine detail. A fence is a few bold pickets sharing one ink group with their rails.
  //    Don't: many thin pickets, each its own group, turn to a black smudge.
  (b, good) => {
    b.setColor(PALETTE.white);
    const n = good ? 6 : 16, w = good ? 0.075 : 0.03;
    for (let i = 0; i < n; i++) {
      const x = -1.2 + (2.4 * i) / (n - 1);
      b.setInk(good ? 'fence' : `picket${i}`);
      b.boxAt([x, 0, 0], [w, 0.36, 0.045], { skip: ['bottom'] });
    }
    b.setInk(good ? 'fence' : 'rails');
    for (const y of [0.09, 0.23]) b.box([-1.24, y, -0.012], [1.24, y + 0.045, 0.012]);
  },
  // 3. Palette. Colours come from src/style/palette.ts; the shader adds tone and pencil.
  //    Don't: pure, saturated colours read as plastic.
  (b, good) => {
    b.setColor(good ? RAMPS.wall[2]! : '#ff2a2a').setPattern(PATTERN.plaster).setInk('body');
    b.boxAt([0, 0, 0], [1.1, CELL_H, 1.1], { skip: ['bottom'] });
    b.setColor(good ? RAMPS.roof[3]! : '#00d43b').setPattern(PATTERN.shingles).setInk('roof');
    b.at(compose(translation(0, CELL_H, 0), rotationY(Math.PI / 4)), () => b.lathe([[0.95, 0], [0, 0.6]], { segments: 4, smooth: false, capBottom: true }));
  },
  // 4. Hand. A plinth, a trim band, an overhang, a degree of lean: nothing looks extruded-by-default.
  //    Don't: a bare box with a bare prism on it.
  (b, good) => {
    const wall = RAMPS.wall[0]!, roof = RAMPS.roof[1]!;
    if (!good) {
      b.setColor(wall).setInk('body').boxAt([0, 0, 0], [1, CELL_H, 1], { skip: ['bottom'] });
      b.setColor(roof).setInk('roof');
      b.quad([0.5, CELL_H, 0.5], [0.5, CELL_H, -0.5], [0, CELL_H + 0.5, -0.5], [0, CELL_H + 0.5, 0.5]);
      b.quad([-0.5, CELL_H, -0.5], [-0.5, CELL_H, 0.5], [0, CELL_H + 0.5, 0.5], [0, CELL_H + 0.5, -0.5]);
      b.setColor(wall).setInk('body');
      b.tri([-0.5, CELL_H, 0.5], [0.5, CELL_H, 0.5], [0, CELL_H + 0.5, 0.5]).tri([0.5, CELL_H, -0.5], [-0.5, CELL_H, -0.5], [0, CELL_H + 0.5, -0.5]);
      return;
    }
    b.at(rotationZ(0.012), () => {
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'plinth' }, () => b.boxAt([0, 0, 0], [1.06, 0.07, 1.06], { skip: ['bottom'] }));
      b.with({ color: wall, pattern: PATTERN.plaster, ink: 'body' }, () => b.boxAt([0, 0, 0], [1, CELL_H, 1], { skip: ['bottom', 'top'] }));
      b.with({ color: PALETTE.white, ink: 'trim' }, () => b.boxAt([0, CELL_H - 0.05, 0], [1.06, 0.05, 1.06]));
      b.with({ color: roof, pattern: PATTERN.shingles, ink: 'roof' }, () => {
        const e = 0.64, l = 0.58, r = 0.52, y = CELL_H;
        b.quad([e, y, l], [e, y, -l], [0, y + r, -l], [0, y + r, l]);
        b.quad([-e, y, -l], [-e, y, l], [0, y + r, l], [0, y + r, -l]);
        b.quad([-e, y, l], [-e, y, -l], [e, y, -l], [e, y, l]);
      });
      b.with({ color: wall, pattern: PATTERN.plaster, ink: 'gable' }, () => {
        const e = 0.64, l = 0.5, r = 0.52, y = CELL_H;
        b.tri([-e, y, l], [e, y, l], [0, y + r, l]).tri([e, y, -l], [-e, y, -l], [0, y + r, -l]);
      });
      b.with({ color: PALETTE.white, ink: 'frame' }, () => b.box([-0.14, 0.26, 0.5], [0.14, 0.6, 0.53]));
      b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'pane' }, () => b.box([-0.1, 0.3, 0.53], [0.1, 0.56, 0.535], { only: ['s'] }));
    });
  },
  // 5. Real edges. A frame is a different object from the wall, so it gets its own ink group
  //    and the renderer outlines it. Don't: sharing the wall's group leaves a patch of colour with no line.
  (b, good) => {
    b.setColor(RAMPS.wall[3]!).setPattern(PATTERN.plaster).setInk('wall');
    b.boxAt([0, 0, 0], [1.6, CELL_H, 0.5], { skip: ['bottom'] });
    for (const x of [-0.4, 0.4]) {
      b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: good ? `frame${x}` : 'wall' }, () => b.box([x - 0.16, 0.2, 0.25], [x + 0.16, 0.6, good ? 0.28 : 0.2505], good ? {} : { only: ['s'] }));
      b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: good ? `pane${x}` : 'wall' }, () => b.box([x - 0.11, 0.25, 0.25], [x + 0.11, 0.55, good ? 0.285 : 0.251], { only: ['s'] }));
    }
  },
  // 6. Light. Things that shine use PATTERN.glow (or glass): they stay bright when the page goes dark.
  //    Don't: a bright vertex colour is just paint, and night tints it like everything else.
  (b, good) => {
    b.setColor(PALETTE.metal).setPattern(PATTERN.metal).setInk('post');
    b.boxAt([0, 0, 0], [0.16, 0.06, 0.16], { skip: ['bottom'] });
    b.lathe([[0.04, 0.06], [0.03, 0.9]], { segments: 8 });
    b.setColor(PALETTE.yellow).setPattern(good ? PATTERN.glow : PATTERN.none).setInk('lantern');
    b.boxAt([0, 0.9, 0], [0.2, 0.22, 0.2]);
    b.setColor(PALETTE.metal).setPattern(PATTERN.metal).setInk('cap');
    b.at(rotationY(Math.PI / 4), () => b.lathe([[0.18, 1.12], [0, 1.25]], { segments: 4, smooth: false, capBottom: true }));
  },
];

export const dodontLayer = defineLayer({
  layer: 'look-dodont',
  build(chunk, plan) {
    const out = new MeshBuilder({ ink: 'dodont' });
    if (plan.world.seed !== DODONT_SEED) return { mesh: out.build(), anchors: {} };
    SAMPLES.forEach((sample, i) => {
      const x = DODONT_X + i * DODONT_PITCH;
      for (const good of [true, false]) {
        const z = good ? DODONT_DO : DODONT_DONT;
        if (Math.floor(x / CHUNK) !== chunk.cx || Math.floor(z / CHUNK) !== chunk.cz) continue;
        const b = new MeshBuilder({ ink: `dodont:${i}:${good}` });
        sample(b, good);
        out.add(b, translation(x, CELL_H, z));
      }
    });
    return { mesh: out.build(), anchors: {} };
  },
  hash: (chunk, plan) => (plan.world.seed === DODONT_SEED ? 1 + chunk.cx * 3 + chunk.cz : 0),
});
