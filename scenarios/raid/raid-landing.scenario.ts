// The raid (design section 13b, catalogue L69): a landing raid on the grown harbour town. A scenario
// cannot start one (nothing destructive happens without a click); it is the town to raid, with a
// camera on the beach the longship runs up onto. Watch it whole from the town view, and close up:
//
//   node src/life/testing/sequence.mjs raid-landing --edit 'raidland@24,0,24' --warm 3000 --frames 16 --every 8000 --name whole
//   node src/life/testing/sequence.mjs raid-landing --edit 'raidland@24,0,24' --warm 3000 --delay 14000 --frames 12 --every 5000 --zoom 7 --follow-raid --name close
//   … --then 'shipsink@0,0,0' --after 34000     the longship sunk with the band ashore: stranded

import { scenario } from '@/scenario';
import { grownTown } from '../core/grown-town';

const town = grownTown('harbour', 2, 2, 'harbour');

export default scenario({
  ...town,
  name: 'raid-landing',
  about: 'A grown harbour town to raid: the landing longship runs up the beach on its west shore (the Raid tool, or the sequence verb raidland).',
  cameras: [town.cameras![0]!, { name: 'beach', yaw: 45, pitch: 35, zoom: 5, target: [13, 1, 33] }],
});
