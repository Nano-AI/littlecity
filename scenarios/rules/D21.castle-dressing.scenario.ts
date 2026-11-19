// Fixture for D21 (castle dressing). A little castle on the shore:
//   a curtain wall of seven cells between two towers   banners on every third cell
//   a keep of 2 × 3, four storeys                      a banner on each long side below the top
//   a gatehouse: an arch between two marble towers     torches either side of the arch, both ways
//   a quay wall along the water                        a cannon on it, for some quays (seed)
//   a plain low wall on open ground                    nothing

import { scenario } from '@/scenario';

export default scenario({
  name: 'D21.castle-dressing',
  seed: 2121,
  about: 'Banners on curtain walls and keeps, torches either side of a gatehouse arch, a cannon on some quay walls; a low garden wall gets nothing.',
  terrain(t) {
    t.flat(1);
    t.water(4, 26, 43, 43);
  },
  build(b) {
    b.tower(10, 12, { floors: 3 }).tower(18, 12, { floors: 3 });
    for (let x = 11; x <= 17; x++) b.put('wall', x, 12);
    b.fill('marble', 22, 10, 23, 12, { floors: 4 });
    b.path(30, 8, 30, 16).put('arch', 30, 12).stack('marble', 29, 12, { floors: 2 }).stack('marble', 31, 12, { floors: 2 });
    for (let x = 8; x <= 20; x++) b.put('marble', x, 25);
    for (let x = 34; x <= 38; x++) b.put('wall', x, 18);
  },
  cameras: [
    { name: 'castle', yaw: 30, pitch: 30, zoom: 3.6, target: [17, 1.5, 13] },
    { name: 'banners', yaw: 20, pitch: 18, zoom: 9, target: [14, 1.4, 12.5] },
    { name: 'gate', yaw: 20, pitch: 22, zoom: 7, target: [30, 1.2, 12.5] },
    { name: 'quay', yaw: 20, pitch: 34, zoom: 4.4, target: [14, 1, 25] },
    { name: 'dusk', yaw: 20, pitch: 22, zoom: 7, target: [30, 1.2, 12.5], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'D21.castle-dressing');
    const banners = mine.filter((p) => p.type === 'wall-banner');
    check.ok(banners.length >= 4, `banners on the curtain wall and the keep (${banners.length})`);
    check.equal(mine.filter((p) => p.type === 'torch').length, 4, 'two torches each way through the gate');
    check.ok(mine.filter((p) => p.type === 'cannon').length <= 1, 'at most one cannon on a quay');
    check.ok(!dressing.sockets.some((s) => s.rule === 'D21.castle-dressing' && (s.cell & 63) >= 34 && (s.cell & 63) <= 38 && ((s.cell >> 6) & 63) === 18), 'a low wall gets nothing');
  },
});
