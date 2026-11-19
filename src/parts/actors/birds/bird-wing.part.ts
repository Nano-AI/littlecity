// One wing of a bird, drawn apart from the body so it can beat (the bird
// behaviours spawn two and turn them about the shoulder; rules never emit
// one). Variant = the species; `side` +1 is the bird's left wing (along +X),
// −1 its right.
//
//   gull    long and pointed, kinked at the wrist (the M of a gliding gull),
//           grey with a dark tip
//   pigeon  short and broad, pale with a dark hand
//   swift   a thin sickle swept back
//
// Frame: the root at the origin, the wing lying flat and reaching out along
// side × X, its leading edge toward +Z. One ink group.

import { scaling } from '@/core/mat4';
import { airborne } from '@/gen/airborne';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { birdColors, wingPanels, wingScale, type Rgb, type Species, type Station } from './kit';

const WINGS: Record<Species, readonly Station[]> = {
  gull: [
    [0, 0.05, -0.048, 0],
    [0.1, 0.064, -0.034, 0.03],
    [0.19, 0.04, -0.04, 0.02],
    [0.27, -0.012, -0.04, 0.002],
  ],
  pigeon: [
    [0, 0.042, -0.044, 0],
    [0.07, 0.052, -0.04, 0.014],
    [0.13, 0.03, -0.042, 0.01],
    [0.17, -0.008, -0.034, 0.002],
  ],
  swift: [
    [0, 0.03, -0.022, 0],
    [0.06, 0.036, -0.006, 0.006],
    [0.13, 0.004, -0.03, 0.006],
    [0.2, -0.07, -0.086, 0.002],
  ],
};

export default definePart({
  actor: 'bird-wing',
  build(item, ctx) {
    const b = ctx.mesh().setPattern(airborne(PATTERN.none)); // in the air: no shade on the ground (src/gen/airborne.ts)
    const species: Species = item.variant ?? 'gull';
    const side = (item.params?.side ?? 1) < 0 ? -1 : 1;
    const c = birdColors();
    const colors: Rgb[] = species === 'gull' ? [c.gullGrey, c.gullGrey, c.gullTip] : species === 'pigeon' ? [c.pigeonLight, c.pigeonLight, c.pigeonDark] : [c.swift];
    b.setInk('wing');
    b.at(scaling(wingScale(species)), () => wingPanels(b, side, WINGS[species], colors));
    return { mesh: b.build(), animated: true };
  },
});
