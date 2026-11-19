// A resident standing still (People, Stage 3; L21). This is what the plan
// draws at the home's door before life takes over: the crowd
// (src/life/people) hides this instance and draws the same person from the
// same pieces, posed and walking.

import { scaling } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { emptyMesh } from '@/gen/mesh';
import { assemblePerson, buildPerson, lookOf } from './person';
import { poseOf, rigMatrices } from './pose';

export default definePart({
  actor: 'resident',
  build(item, ctx) {
    if (item.variant === 'indoors') return { mesh: emptyMesh() }; // never comes out
    const look = lookOf(item.params?.look ?? ctx.seed, item.variant === 'child');
    const m = rigMatrices(look, poseOf('stand', 0));
    const b = ctx.mesh();
    b.at(scaling(look.scale), () => assemblePerson(buildPerson(look, item.id), [0, 1, 2, 3, 4].map((i) => m.subarray(i * 16, i * 16 + 16)), b));
    return { mesh: b.build(), animated: true };
  },
});
