// The raid (design section 13b, catalogue L70): a boats raid on the grown market town. A scenario
// cannot start one; it is the town to raid, with a camera where the big longship stands off.
//
//   node src/life/testing/sequence.mjs raid-boats --edit 'raidboats@24,0,24' --warm 3000 --frames 12 --every 9000 --name whole
//   node src/life/testing/sequence.mjs raid-boats --edit 'raidboats@24,0,24' --warm 3000 --delay 12000 --frames 12 --every 5000 --zoom 4 --follow-raid --name close

import { scenario } from '@/scenario';
import { grownTown } from '../core/grown-town';

const town = grownTown('market', 3, 1, 'market');

export default scenario({
  ...town,
  name: 'raid-boats',
  about: 'A grown market town to raid: two to four rowing boats come in from beyond the edge of the map, each to its own landing (the Raid tool, or the sequence verb raidboats).',
  cameras: [town.cameras![0]!, { name: 'shore', yaw: 45, pitch: 35, zoom: 3.2, target: [38, 1, 18] }],
});
