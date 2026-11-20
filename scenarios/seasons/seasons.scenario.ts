// Seasons and weather (design section 13a): the showcase town with a handful of cameras to judge a
// season or a kind of weather by, overview and close, from all four quarters.
//
//   npm run shots -- seasons --season winter --weather snow
//   npm run shots -- seasons --season festival --time dusk
//   npm run shots -- seasons --season autumn
//   npm run shots -- seasons --weather rain

import { scenario } from '@/scenario';
import everything from '../core/everything.scenario';

export default scenario({
  name: 'seasons',
  seed: everything.seed,
  terrain: everything.terrain,
  terrainGen: everything.terrainGen,
  startingTrees: everything.startingTrees,
  build: everything.build,
  about: 'The showcase town, for judging seasons and weather: overview and close, from the four quarters.',
  cameras: [
    { name: 'overview', yaw: 45, pitch: 35, zoom: 1.6, target: [23.5, 1, 24.5] },
    { name: 'town', yaw: 45, pitch: 33, zoom: 2.6, target: [24, 1.5, 30] },
    { name: 'town-ne', yaw: 135, pitch: 33, zoom: 2.6, target: [24, 1.5, 28] },
    { name: 'castle-nw', yaw: 225, pitch: 32, zoom: 3.4, target: [17, 2.5, 17.5] },
    { name: 'hill-sw', yaw: 315, pitch: 32, zoom: 3.2, target: [33, 3, 19] },
    { name: 'square', yaw: 45, pitch: 32, zoom: 4.2, target: [26, 1.5, 31.5] },
    { name: 'close-row', yaw: 45, pitch: 28, zoom: 7, target: [16.5, 1.6, 33] },
    { name: 'close-shops', yaw: 45, pitch: 28, zoom: 7.5, target: [24.5, 1.8, 31.5] },
  ],
});
