// FX-10: a crowd of towers is not a row of cones. Of five towers within 4 of
// each other only the first keeps the cone; the others get a seeded other
// look (a square tower under a tiled pyramid, or a crenellated tower
// house). A tower standing alone keeps its cone.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-T07.crowd',
  seed: 4207,
  about: 'Five towers clustered in a 5 × 3 patch (one cone, the rest varied); a lone tower (a cone).',
  build(b) {
    for (const [x, z] of [[10, 10], [12, 10], [14, 11], [10, 13], [13, 13]] as const) b.tower(x, z, { floors: 3 + ((x + z) % 2) });
    b.tower(24, 12, { floors: 3 });
  },
  cameras: [{ name: 'towers', yaw: 40, pitch: 30, zoom: 3, target: [16, 2, 12] }],
  expect(plan, _dressing, check) {
    const caps = check.features({ type: 'cap' });
    const capOf = (x: number, z: number): string | undefined => caps.find((f) => f.structure === check.structure(x, 1, z).id)?.variant;
    check.equal(capOf(10, 10), 'cone', 'the first of the crowd keeps the cone');
    check.equal(capOf(24, 12), 'cone', 'a lone tower keeps the cone');
    const others = [[12, 10], [14, 11], [10, 13], [13, 13]].map(([x, z]) => capOf(x!, z!));
    check.ok(others.filter((v) => v !== 'cone').length >= 2, `the crowd varies: ${others.join(', ')}`);
    for (const [x, z] of [[10, 10], [12, 10], [24, 12]] as const) check.role(x, 1, z, 'watchtower');
    void plan;
  },
});
