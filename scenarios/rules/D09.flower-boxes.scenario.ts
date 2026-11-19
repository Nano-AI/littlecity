// Fixture for D09 (flower boxes) and D07 (shop dressing). A street of shops
// and houses: every shopfront has its awning and every shop its sign; about
// half the windows on the sunny sides (south and east) carry a flower box
// and about a fifth of the others; none above the third storey, none on a
// tower, none under a shopfront.

import { facades } from '@/resolve/facts/facades.fact';
import { scenario } from '@/scenario';

export default scenario({
  name: 'D09.flower-boxes',
  seed: 9909,
  about: 'Flower boxes under about half the sunny windows and a fifth of the shaded ones, none above storey 3; an awning and a sign on every shop.',
  build(b) {
    b.plaza(8, 13, 20, 14);
    b.path(21, 13, 34, 13);
    b.house(8, 12, { w: 2, floors: 2, color: 0 });
    b.house(11, 12, { w: 2, floors: 3, color: 2 });
    b.house(14, 12, { w: 3, floors: 2, color: 4 });
    b.house(18, 12, { w: 2, floors: 2, color: 6 });
    b.house(22, 12, { floors: 5, color: 1 });
    b.house(25, 11, { w: 3, d: 2, floors: 2, color: 3 });
    b.house(30, 12, { w: 2, floors: 2, color: 5 });
    b.tower(34, 11, { floors: 4, color: 0 });
  },
  cameras: [
    { name: 'street', yaw: 30, pitch: 28, zoom: 3.6, target: [20, 2, 13] },
    { name: 'street-back', yaw: 210, pitch: 30, zoom: 3.6, target: [20, 2, 12] },
    { name: 'shops', yaw: 25, pitch: 24, zoom: 8, target: [12.5, 1.6, 13] },
    { name: 'east', yaw: 300, pitch: 28, zoom: 6, target: [27, 1.6, 12] },
    { name: 'dusk', yaw: 25, pitch: 24, zoom: 8, target: [12.5, 1.6, 13], time: 'dusk' },
  ],
  expect(plan, dressing, check) {
    const all = facades(plan.facts);
    const boxes = dressing.props.filter((p) => p.type === 'flower-box' && p.rule === 'D09.flower-boxes');
    check.ok(boxes.length >= 8, `flower boxes (${boxes.length})`);
    let sunnyBoxes = 0, shadeBoxes = 0, sunnyWindows = 0, shadeWindows = 0;
    const boxed = new Set(boxes.map((p) => ('socket' in p.at ? p.at.socket : '')));
    for (const s of check.sockets({ type: 'window' })) {
      if (s.dir === undefined) continue;
      const fc = all.at(s.cell, s.dir);
      if (!fc) continue;
      const has = boxed.has(s.id);
      if (has) {
        check.equal(fc.kind, 'house', 'boxes hang on houses only');
        check.ok(fc.storey <= 3, 'no box above the third storey');
        const variant = plan.features.find((f) => f.id === s.owner)?.variant ?? '';
        check.ok(['square', 'tall', 'arched', 'shuttered'].includes(variant), `no box under a ${variant} window`);
      }
      if (fc.kind !== 'house' || fc.storey > 3) continue;
      if (fc.sunny) {
        sunnyWindows++;
        if (has) sunnyBoxes++;
      } else {
        shadeWindows++;
        if (has) shadeBoxes++;
      }
    }
    check.ok(sunnyBoxes / Math.max(1, sunnyWindows) > shadeBoxes / Math.max(1, shadeWindows), `more boxes on sunny sides (${sunnyBoxes}/${sunnyWindows} against ${shadeBoxes}/${shadeWindows})`);
    // D07: every awning mount and sign bracket is dressed, once.
    const awnings = check.sockets({ type: 'awning-mount' }), signs = check.sockets({ type: 'sign-bracket' });
    check.ok(awnings.length >= 2 && signs.length >= 2, 'the street has shops');
    for (const s of awnings) check.equal(dressing.props.filter((p) => p.type === 'awning' && 'socket' in p.at && p.at.socket === s.id).length, 1, 'one awning per mount');
    for (const s of signs) check.equal(dressing.props.filter((p) => p.type === 'hanging-sign' && 'socket' in p.at && p.at.socket === s.id).length, 1, 'one sign per bracket');
    // One awning colour per shop.
    const byShop = new Map<number, Set<number>>();
    for (const p of dressing.props.filter((q) => q.type === 'awning')) {
      const s = awnings.find((k) => 'socket' in p.at && k.id === p.at.socket);
      if (!s || s.structure === undefined) continue;
      if (!byShop.has(s.structure)) byShop.set(s.structure, new Set());
      byShop.get(s.structure)!.add((p.params as { color: number }).color);
    }
    for (const colors of byShop.values()) check.equal(colors.size, 1, 'a shop has one awning colour');
  },
});
