// The "crazy vertical" town: everything Monuments draws, piled up the way a
// player who cannot stop stacking would pile it. Stacked viaducts across a
// strait, a tower on arches on pillars, houses cantilevered off a marble
// mass over the water, a lighthouse on a sea stack, and generated supports
// under everything that would otherwise float.

import { scenario } from '@/scenario';

export default scenario({
  name: 'monuments-vertical',
  seed: 77,
  about: 'Stacked viaducts, a tower on arches on pillars, houses hung off a marble mass over water, supports everywhere.',
  terrain(t) {
    t.flat(0);
    t.rect(8, 8, 25, 19, 1); // the town's shelf
    t.rect(8, 8, 13, 13, 2); // a rise at its back corner
    t.rect(29, 9, 33, 13, 1); // a sea stack across the strait
    t.rect(30, 10, 32, 12, 3);
  },
  build(b) {
    // ── the marble mass at the water's edge, stepped, with houses hung off it over the sea ──
    b.fill('marble', 15, 17, 18, 19, { floors: 2 });
    b.fill('marble', 15, 18, 16, 19, { floors: 2 });
    b.block('marble', 15, 5, 19).block('marble', 15, 6, 19);
    b.block('house', 17, 3, 19, { color: 2 }).block('house', 18, 3, 19, { color: 2 }); // on the lower terrace
    for (let x = 15; x <= 18; x++) b.block('house', x, 2, 20, { color: (x * 3) % 8 }); // jettied over the sea on brackets
    b.block('house', 16, 3, 20, { color: 4 }).block('house', 16, 4, 20, { color: 4 });
    b.block('house', 15, 5, 20, { color: 6 }); // high on brackets off the marble spur
    b.block('house', 17, 2, 21, { color: 1 }).block('house', 18, 2, 21, { color: 1 }).block('house', 19, 2, 21, { color: 1 }); // further out: pillars and an arcade
    b.block('house', 19, 2, 20, { color: 5 });
    b.block('tower', 14, 5, 19, { color: 2 }).block('tower', 14, 6, 19, { color: 2 }).block('tower', 14, 7, 19, { color: 2 }); // a turret hung off the spur

    // ── stacked viaducts across the strait to the sea stack ──
    for (let x = 19; x <= 29; x++) b.block('arch', x, 2, 11); // lower tier: spans on piers in the sea
    for (let x = 21; x <= 29; x++) b.block('arch', x, 3, 11); // upper tier: standing arches
    b.fill('marble', 17, 10, 18, 12, { floors: 2 }); // its abutment on the town side
    b.block('house', 24, 4, 11, { color: 3 }).block('house', 25, 4, 11, { color: 3 }); // a house on the viaduct
    b.stack('lighthouse', 31, 11, { floors: 5 });

    // ── a tower on arches on pillars ──
    b.stack('pillar', 9, 16, { floors: 2 }).stack('pillar', 12, 16, { floors: 2 });
    for (let x = 9; x <= 12; x++) b.block('arch', x, 3, 16);
    for (let y = 4; y <= 8; y++) b.block('tower', 10, y, 16, { color: 6 });
    b.block('house', 11, 6, 16, { color: 0 }); // a room bracketed off the tower
    b.block('house', 12, 4, 16, { color: 7 }); // and a hut on the arch beside it

    // ── a chapel on a marble podium on pillars, steeple and all ──
    for (const [x, z] of [[20, 15], [22, 15], [20, 17], [22, 17]] as const) b.stack('pillar', x, z, { floors: 1 });
    for (let x = 20; x <= 22; x++) for (let z = 15; z <= 17; z++) b.block('marble', x, 2, z);
    b.block('house', 21, 3, 16, { color: 5 }).block('house', 22, 3, 16, { color: 5 });
    for (let y = 3; y <= 6; y++) b.block('tower', 20, y, 16, { color: 1 });

    // ── on the rise: a watchtower, a gateway on the path up, a bridge to the tower's arches ──
    b.tower(10, 10, { floors: 4, color: 3 });
    b.path(11, 14, 16, 14).path(11, 11, 11, 13).put('arch', 14, 14);
    b.stack('pillar', 24, 18, { floors: 3 });
  },
  cameras: [
    { name: 'hero', yaw: 45, pitch: 30, zoom: 2.35, target: [19.5, 3, 14.5] },
    { name: 'back', yaw: 225, pitch: 32, zoom: 2.35, target: [19.5, 3, 14.5] },
    { name: 'east', yaw: 135, pitch: 30, zoom: 2.35, target: [19.5, 3, 14.5] },
    { name: 'west', yaw: 315, pitch: 30, zoom: 2.35, target: [19.5, 3, 14.5] },
    { name: 'sea-side', yaw: 20, pitch: 22, zoom: 4.6, target: [16.5, 3, 19.5] },
    { name: 'viaduct', yaw: 30, pitch: 24, zoom: 3.6, target: [24.5, 2.5, 11.5] },
    { name: 'tower-on-arches', yaw: 60, pitch: 24, zoom: 4.6, target: [10.5, 4.5, 16] },
  ],
  expect(plan, _dressing, check) {
    // Nothing floats: every block is carried, an arch, a dock at sea level, or has a generated support.
    const supported = new Set(plan.supports.map((s) => s.carries));
    check.ok(supported.size >= 12, `supports everywhere (${supported.size})`);
    check.ok(plan.supports.some((s) => s.type === 'bracket'), 'brackets');
    check.ok(plan.supports.some((s) => s.type === 'pillar' && (s.arcadeTo?.length ?? 0) > 0), 'an arcade');
    check.role(31, 3, 11, 'lighthouse');
    check.role(24, 2, 11, 'viaduct');
    check.role(20, 3, 16, 'steeple');
    check.role(14, 1, 14, 'gateway');
    check.hasFeature({ type: 'pier', on: [24, 2, 11] }, 2);
  },
});
