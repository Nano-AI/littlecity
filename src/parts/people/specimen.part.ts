// Life's small drawings held still for a gallery (scenarios/gallery/soft-ink.scenario.ts): the
// scuffle's cloud, its swearing and what pops out of it, the chat bubble, a dog in each pose, what
// people carry. In a town they only appear while something happens; no rule of the game emits this.
// variant = which kind; params.n = which one; params.yaw, params.pitch = the camera (degrees), which
// the balloons turn to face as the people system turns them.

import { compose, rotationX, rotationY, scaling } from '@/core/mat4';
import { definePart, type Part } from '@/gen/api';
import cat from '@/parts/actors/small/cat.part';
import chicken, { sheep } from '@/parts/actors/small/animals.part';
import pigeon from '@/parts/actors/birds/pigeon.part';
import gull from '@/parts/actors/birds/gull.part';
import type { MeshData } from '@/gen/mesh';
import { DOG_POSES, dogMesh } from './dog';
import { bubbleMesh } from './extras';
import { restingMesh, type Load } from './loads';
import { cloudMesh, dazeStarMesh, popMesh, swearMesh, type PopKind } from './scuffle-art';
import { SCUFFLE } from '@/style/town-life';

const ANIMALS: readonly [Part, number][] = [[cat, 0], [cat, 1], [cat, 2], [chicken, 0], [chicken, 1], [sheep, 0], [pigeon, 0], [gull, 0]];
const POPS: readonly PopKind[] = ['fist', 'shoe', 'hat', 'star'];
const LOADS: readonly Load[] = ['basket', 'bouquet', 'lantern', 'loaf', 'fishes', 'sack', 'barrel', 'petals', 'bucket', 'crate'];

export default definePart({
  actor: 'specimen',
  build(item, ctx) {
    const n = Math.max(0, Math.round(item.params?.n ?? 0));
    const deg = Math.PI / 180;
    const face = compose(rotationY((item.params?.yaw ?? 45) * deg), rotationX(-(item.params?.pitch ?? 35) * deg));
    let mesh: MeshData;
    let m = compose();
    switch (item.variant) {
      case 'cloud':
        mesh = cloudMesh(n % 3, SCUFFLE.cloudR, SCUFFLE.cloudH);
        break;
      case 'swear':
        mesh = swearMesh(n % 4);
        m = compose(face, scaling(1.35));
        break;
      case 'chat':
        mesh = bubbleMesh();
        m = face;
        break;
      case 'pop':
        mesh = popMesh(POPS[n % POPS.length]!);
        m = compose(rotationY((item.params?.yaw ?? 45) * deg), scaling(1.7));
        break;
      case 'daze':
        mesh = dazeStarMesh();
        m = scaling(1.5);
        break;
      case 'dog':
        mesh = dogMesh(DOG_POSES[n % DOG_POSES.length]!, Math.floor(n / DOG_POSES.length));
        m = scaling(1.35); // as the dogs chain draws them
        break;
      case 'animal': {
        // The town's animals as their own parts draw them (in a town their behaviours place them).
        const [part, look] = ANIMALS[n % ANIMALS.length]!;
        mesh = part.build({ ...item, type: 'x', variant: undefined, params: { look, hold: 0 } } as never, ctx).mesh;
        m = scaling(1);
        break;
      }
      default:
        mesh = restingMesh(LOADS[n % LOADS.length]!);
        break;
    }
    const b = ctx.mesh();
    b.add(mesh, m);
    return { mesh: b.build() };
  },
});
