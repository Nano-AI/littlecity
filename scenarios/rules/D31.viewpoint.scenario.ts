// Fixture for D31 (viewpoint). A hill of three terraces with a path winding
// up it, a lower lane elsewhere:
//   the highest cell the path reaches, at the hill's edge   a coin telescope looking out, a bench beside it
//   anywhere else                                           neither

import { scenario } from '@/scenario';

export default scenario({
  name: 'D31.viewpoint',
  seed: 3131,
  about: 'The highest walkable point reached from the town’s floors gets a coin telescope looking out over the drop and a bench beside it; there is only one in a town.',
  terrain(t) {
    t.flat(1);
    t.rect(14, 10, 26, 22, 2);
    t.rect(17, 12, 24, 19, 3);
  },
  build(b) {
    b.path(10, 16, 13, 16);
    b.path(14, 16, 16, 16);
    b.path(17, 16, 20, 16);
    b.path(8, 26, 30, 26);
  },
  cameras: [
    { name: 'hill', yaw: 300, pitch: 30, zoom: 3.6, target: [18, 2.2, 16] },
    { name: 'close', yaw: 280, pitch: 22, zoom: 8, target: [17.5, 3, 16] },
  ],
  expect(_plan, dressing, check) {
    const scopes = dressing.props.filter((p) => p.type === 'coin-telescope');
    check.equal(scopes.length, 1, 'one viewpoint in the town');
    const at = scopes[0]?.at;
    check.ok(!!at && 'cell' in at && at.cell >> 12 === 3, 'on the highest level the path reaches');
    check.ok(dressing.props.some((p) => p.rule === 'D31.viewpoint' && p.type === 'bench'), 'with a bench beside it');
  },
});
