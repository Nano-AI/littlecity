// Discovery round 1: a grown town on generator 2's island for seed 64.
//
//   npm run shots -- disc1-grown-b

import { grownTown } from '../../core/grown-town';

export default { ...grownTown(102, 64, 2), name: 'disc1-grown-b' };
