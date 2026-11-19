// The fishing boat afloat. Until L18 (tier 2) sends it out at dawn and home
// at dusk, it lies where it was put and rides the swell.

import { BOATS } from '@/style/boats';
import { defineBehaviour } from '../api';
import { floatingAt, poseFloating, refloat, type Floating } from './floating';

export default defineBehaviour<'fishing-boat', Floating>({
  actor: 'fishing-boat',
  create: (_item, ctx) => floatingAt(ctx.instance.base, ctx.rand('swell'), BOATS.fishLength, BOATS.fishBeam),
  changed: (state, ctx) => refloat(state, ctx.instance.base),
  update(state, _dt, signals, ctx) {
    poseFloating(state, signals, ctx.instance, ctx.stage, ctx.dressing);
  },
});
