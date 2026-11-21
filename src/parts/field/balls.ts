// The balls of the playing field (src/life/field): drawn by life as spawned
// meshes, centred on the origin, world units. Each has a seam or a patch so
// its spin shows when it rolls or flies.

import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { smoothBall } from '@/gen/soft';
import { PALETTE } from '@/style/palette';

export type BallKind = 'basketball' | 'tennis' | 'football' | 'bowl' | 'bowl-b' | 'jack' | 'boule' | 'croquet-a' | 'croquet-b' | 'croquet-c' | 'croquet-d';


const COLOURS: Record<BallKind, string> = {
  basketball: '#e8743f',
  tennis: '#dff05a',
  football: '#fbf8f0',
  bowl: '#4a3a33',
  'bowl-b': '#6d4f8a',
  jack: '#fbf8f0',
  boule: '#b9bcc6',
  'croquet-a': '#4f7fd0',
  'croquet-b': '#d9483b',
  'croquet-c': '#2f2d33',
  'croquet-d': '#f2c230',
};

export function ballMesh(kind: BallKind, r: number): MeshData {
  const b = new MeshBuilder({ ink: `ball-${kind}` });
  b.setInk('ball').setColor(COLOURS[kind]).setPattern(PATTERN.none);
  // Smooth both ways (src/gen/soft.ts): a lathe ball's rings showed as bands round it.
  smoothBall(b, 0, 0, 0, r, r, r, 12, 7);
  // Something to see it turn by.
  if (kind === 'basketball') {
    b.setInk('seam').setColor('#3a2f2a');
    // A band round its middle, a hair proud of the skin, and one round the poles.
    b.lathe([[r * 1.02, -r * 0.08], [r * 1.02, r * 0.08]], { segments: 10 });
    b.rotateX(Math.PI / 2);
    b.lathe([[r * 1.02, -r * 0.08], [r * 1.02, r * 0.08]], { segments: 10 });
  } else if (kind === 'football') {
    b.setInk('patch').setColor('#2f2d33');
    for (const [ax, ay] of [[0, 0], [Math.PI / 2, 0], [Math.PI, 0], [-Math.PI / 2, 0], [0, Math.PI / 2], [0, -Math.PI / 2]] as const) {
      b.push().rotateY(ay).rotateX(ax);
      b.lathe([[r * 0.38, r * 0.93], [1e-4, r * 1.03]], { segments: 5 });
      b.pop();
    }
  } else if (kind === 'tennis') {
    b.setInk('seam').setColor(PALETTE.white);
    b.lathe([[r * 1.03, -r * 0.1], [r * 1.03, r * 0.1]], { segments: 8 });
  } else if (kind === 'bowl' || kind === 'bowl-b') {
    b.setInk('disc').setColor(PALETTE.white);
    b.push().rotateX(Math.PI / 2);
    b.lathe([[r * 0.3, r * 0.97], [1e-4, r * 1.02]], { segments: 6 });
    b.pop();
  }
  return b.build();
}
