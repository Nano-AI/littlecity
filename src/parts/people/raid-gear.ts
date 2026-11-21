// The raiders' tools (design section 13b, the raid): a flaming brand, a
// bearded axe, a knobbly club, the chief's great horn. Held on the body piece
// along a shaft in the right hand, as the sentry's torch and the soldier's
// pike are (hands.ts SHAFTS: the hand closes on the shaft at arm's length),
// so each is held up and forward over the head. Drawn big: they must read
// from the town view. Pure.

import { compose, rotationX, translation, type Vec3 } from '@/core/mat4';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { tube } from '@/parts/ground/kit';
import { PALETTE } from '@/style/palette';

export type RaidTool = 'brand' | 'axe' | 'club' | 'horn';
export const RAID_TOOLS: readonly RaidTool[] = ['brand', 'axe', 'club', 'horn'];

/** [foot, top] of each raid tool's shaft in the body frame (figure units). */
export const RAID_SHAFTS: Readonly<Record<RaidTool, [Vec3, Vec3]>> = {
  brand: [[0.09, 0.24, 0.08], [0.1, 0.5, 0.1]],
  axe: [[0.09, 0.22, 0.08], [0.11, 0.52, 0.11]],
  club: [[0.09, 0.22, 0.08], [0.1, 0.48, 0.11]],
  horn: [[0.085, 0.27, 0.09], [0.075, 0.4, 0.14]],
};

export function drawRaidTool(b: MeshBuilder, tool: RaidTool): void {
  const [a, c] = RAID_SHAFTS[tool];
  b.setInk('tool').setColor(PALETTE.trunk).setPattern(PATTERN.none);
  if (tool !== 'horn') tube(b, [a, c], [0.009, 0.011], { seg: 5 });
  const [x, y, z] = c;
  switch (tool) {
    case 'brand':
      // Rags bound round its head, and a big flame licking up out of them.
      b.setInk('rags').setColor('#6b4a34');
      b.at(translation(x, y - 0.02, z), () => b.lathe([[0.016, -0.02], [0.022, 0.0], [0.016, 0.022]], { segments: 6 }));
      b.setInk('flame').setColor(PALETTE.yellow).setPattern(PATTERN.glow);
      b.at(translation(x, y, z), () => b.lathe([[0, 0], [0.036, 0.03], [0.028, 0.075], [0.012, 0.11], [0, 0.14]], { segments: 7 }));
      break;
    case 'axe': {
      // A bearded blade forward of the haft's head, both faces and its edge, and the eye round the haft.
      b.setInk('axe-head').setColor('#b9bac4').setPattern(PATTERN.metal);
      const by = y - 0.02;
      const blade: Vec3[] = [[x, by + 0.035, z + 0.012], [x, by + 0.065, z + 0.085], [x, by - 0.04, z + 0.09], [x, by - 0.02, z + 0.012]];
      for (const d of [-0.006, 0.006]) {
        const pts = blade.map(([px, py, pz]): Vec3 => [px + d, py, pz]);
        b.polygon(d < 0 ? pts : [...pts].reverse());
      }
      b.quad([x + 0.006, by + 0.065, z + 0.085], [x - 0.006, by + 0.065, z + 0.085], [x - 0.006, by - 0.04, z + 0.09], [x + 0.006, by - 0.04, z + 0.09]);
      b.box([x - 0.013, by - 0.022, z - 0.02], [x + 0.013, by + 0.036, z + 0.014]);
      break;
    }
    case 'club':
      b.setInk('club-head').setColor('#8a5a32');
      b.at(translation(x, y, z), () => b.lathe([[0.012, -0.05], [0.034, -0.01], [0.038, 0.03], [0.022, 0.06], [0, 0.068]], { segments: 7 }));
      b.setInk('studs').setColor('#9a9ba4');
      for (let i = 0; i < 5; i++) {
        const t = (i / 5) * Math.PI * 2;
        b.at(translation(x + Math.cos(t) * 0.036, y + 0.012, z + Math.sin(t) * 0.036), () => b.lathe([[0.009, -0.006], [0, 0.01]], { segments: 4, capBottom: true }));
      }
      break;
    case 'horn':
      // A great curved ox horn, pale, with a gold rim at the bell.
      b.setInk('horn').setColor('#efe3c4');
      tube(b, [a, [a[0] + 0.012, a[1] + 0.05, a[2] + 0.035], c, [x - 0.012, y + 0.04, z + 0.05]], [0.007, 0.015, 0.025, 0.036], { seg: 7 });
      b.setInk('horn-rim').setColor(PALETTE.yellow).setPattern(PATTERN.metal);
      b.at(compose(translation(x - 0.012, y + 0.04, z + 0.05), rotationX(0.8)), () => b.lathe([[0.034, -0.006], [0.04, 0.006]], { segments: 8 }));
      break;
  }
}
