// Discovery round 1: a grown town on generator 2's island for seed 23.
//
//   npm run shots -- disc1-grown-a

import { grownTown } from '../../core/grown-town';

const base = grownTown(101, 23, 2);
export default {
  ...base,
  name: 'disc1-grown-a',
  cameras: [...(base.cameras ?? []), { name: 'fingerposts', yaw: 45, pitch: 34, zoom: 5, target: [19, 1.2, 7.5] }],
};
