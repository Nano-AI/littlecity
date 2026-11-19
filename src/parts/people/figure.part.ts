// A little person held in one pose (People, Stage 3). No rule of the game
// emits it; gallery sheets do, to show every look and every pose standing
// still. variant = the pose; params.look = the look seed; params.phase = the
// stride phase (walk, run) or seconds into the pose (the rest).

import { scaling } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { assemblePerson, buildPerson, lookOf, rigOf } from './person';
import { poseOf, rigMatrices, sitDrop } from './pose';

export default definePart({
  actor: 'figure',
  build(item, ctx) {
    const look = lookOf(item.params?.look ?? ctx.seed, item.params?.child === 1);
    const pose = item.variant ?? 'stand';
    const rig = rigOf(look);
    const m = rigMatrices(look, poseOf(pose, item.params?.phase ?? 0), undefined, pose === 'sit' ? sitDrop(rig, 0) : 0, rig);
    const b = ctx.mesh();
    b.at(scaling(look.scale), () => assemblePerson(buildPerson(look, item.id), [0, 1, 2, 3, 4].map((i) => m.subarray(i * 16, i * 16 + 16)), b));
    return { mesh: b.build() };
  },
});
