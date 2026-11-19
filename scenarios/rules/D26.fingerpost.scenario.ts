// Fixture for D26 (fingerposts). Six junctions and a bend:
//   crossroads and tees of streets                about half get a fingerpost, an arm down each branch
//   a branch that runs down to the sea            its arm shows the sea
//   a bend (two branches)                         never

import { scenario } from '@/scenario';

export default scenario({
  name: 'D26.fingerpost',
  seed: 2626,
  about: 'About half the junctions of three or more branches get a fingerpost with an arm down each branch, each with a picture of what lies that way; bends get none.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
  },
  build(b) {
    b.path(6, 10, 40, 10);
    for (const x of [10, 18, 26, 34]) b.path(x, 6, x, 9).path(x, 11, x, 14);
    b.path(6, 20, 40, 20);
    for (const x of [14, 30]) b.path(x, 21, x, 28);
    // A bend.
    b.path(6, 24, 9, 24).path(9, 25, 9, 27);
  },
  cameras: [
    { name: 'all', yaw: 30, pitch: 42, zoom: 2.4, target: [22, 1, 17] },
    { name: 'close', yaw: 30, pitch: 26, zoom: 8, target: [14, 1.3, 20] },
  ],
  expect(_plan, dressing, check) {
    const posts = dressing.props.filter((p) => p.type === 'fingerpost');
    check.ok(posts.length >= 2 && posts.length <= 5, `about half of six junctions (${posts.length})`);
    for (const p of posts) {
      const mask = (p.params as { mask: number }).mask;
      const arms = [0, 1, 2, 3].filter((d) => mask & (1 << d)).length;
      check.ok(arms >= 3, 'an arm down each branch');
    }
    check.ok(!posts.some((p) => 'cell' in p.at && (p.at.cell & 63) === 9), 'never at a bend');
    const seaward = posts.filter((p) => 'cell' in p.at && ((p.at.cell >> 6) & 63) === 20);
    for (const p of seaward) check.equal(((p.params as { signs: number }).signs >> 4) & 3, 1, 'the arm down to the sea shows the sea');
  },
});
