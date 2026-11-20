// R-M11 (RC-14) and R-M12 (RC-13): small and long temples by their place.
// A 2 × 2 slab on four pillars on a big plaza is a bandstand (an octagonal
// pavilion); a 2 × 7 slab on pillars along the side of a square is a stoa
// (one roof sloping away from the square, goods in its back bays); a 2 × 2 on
// a podium and a 3 × 3 temple stay temples; four cells on four pillars on
// bare grass are a pavilion too.
//
// South of the square, every footprint the rule accepts, side by side: the
// 2 × 2 on pillars 3 and 4 tall, a 1 × 4 each way, an L, a T and an S, with
// a two-storey house and a tree for scale.

import { scenario, type TownBuilder } from '@/scenario';

/** Pillars `h` tall under each cell, and marble on them. */
function bandstand(b: TownBuilder, cells: readonly (readonly [number, number])[], h: number, color: number): void {
  for (const [x, z] of cells) b.stack('pillar', x, z, { floors: h }).block('marble', x, 1 + h, z, { color });
}

export default scenario({
  name: 'R-M11.bandstand',
  seed: 4211,
  about: 'A bandstand on a plaza and one on bare grass; a stoa on the side of the same square; a small temple on a podium; a 3 × 3 temple on grass; every bandstand footprint and height.',
  build(b) {
    b.plaza(8, 8, 18, 16);
    bandstand(b, [[12, 11], [13, 11], [12, 12], [13, 12]], 2, 2);
    // The stoa along the east side of the square, a cell off it.
    for (let z = 8; z <= 14; z++) b.stack('pillar', 20, z, { floors: 2 }).block('marble', 20, 3, z, { color: 1 }).block('marble', 21, 3, z, { color: 1 });
    // On a podium: a temple.
    b.fill('marble', 26, 8, 29, 11, { floors: 2 });
    for (const x of [27, 28]) for (const z of [9, 10]) b.stack('pillar', x, z, { floors: 2 });
    for (const x of [27, 28]) for (const z of [9, 10]) b.block('marble', x, 5, z, { color: 2 });
    // A 3 × 3 on grass: a temple.
    for (const x of [26, 28]) for (const z of [16, 18]) b.stack('pillar', x, z, { floors: 2 });
    for (let x = 26; x <= 28; x++) for (let z = 16; z <= 18; z++) b.block('marble', x, 3, z, { color: 3 });
    // Four cells on four pillars on bare grass: a pavilion too (R-M11 needs no square or park).
    bandstand(b, [[31, 16], [32, 16], [31, 17], [32, 17]], 2, 1);

    // ── every footprint and height, on one long plaza with a path along its south side ──
    b.plaza(6, 22, 37, 31);
    b.path([6, 32], [37, 32]);
    bandstand(b, [[8, 24], [9, 24], [8, 25], [9, 25]], 3, 4);
    bandstand(b, [[12, 24], [13, 24], [12, 25], [13, 25]], 4, 0);
    bandstand(b, [[16, 24], [17, 24], [18, 24], [19, 24]], 2, 1);
    bandstand(b, [[22, 23], [22, 24], [22, 25], [22, 26]], 2, 5);
    bandstand(b, [[25, 24], [25, 25], [25, 26], [26, 26]], 2, 2);
    bandstand(b, [[29, 24], [30, 24], [31, 24], [30, 25]], 2, 3);
    bandstand(b, [[34, 24], [35, 24], [33, 25], [34, 25]], 2, 6);
    // For scale: a two-storey house and a tree beside a 2 × 2 on pillars 2 tall.
    bandstand(b, [[9, 28], [10, 28], [9, 29], [10, 29]], 2, 2);
    b.house(13, 28, { floors: 2 });
    b.put('tree', 15, 29);
  },
  cameras: [
    { name: 'square', yaw: 35, pitch: 30, zoom: 3.2, target: [15, 1.5, 11.5] },
    { name: 'dusk', yaw: 215, pitch: 30, zoom: 3.2, target: [15, 1.5, 11.5], time: 'dusk' },
    { name: 'all', yaw: 40, pitch: 36, zoom: 2.2, target: [19, 1.5, 13] },
    { name: 'close', yaw: 35, pitch: 28, zoom: 8, target: [13, 2.4, 12] },
    { name: 'close-ne', yaw: 125, pitch: 28, zoom: 8, target: [13, 2.4, 12] },
    { name: 'close-nw', yaw: 215, pitch: 28, zoom: 8, target: [13, 2.4, 12] },
    { name: 'close-sw', yaw: 305, pitch: 34, zoom: 8, target: [13, 2.4, 12] },
    { name: 'detail', yaw: 30, pitch: 20, zoom: 16, target: [12.6, 2.2, 12.4] },
    { name: 'footprints', yaw: 25, pitch: 32, zoom: 2.6, target: [21, 2, 26] },
    { name: 'footprints-back', yaw: 205, pitch: 32, zoom: 2.6, target: [21, 2, 26] },
    { name: 'scale', yaw: 30, pitch: 22, zoom: 5.5, target: [12, 2, 28.5] },
    { name: 'shelters', yaw: 25, pitch: 24, zoom: 6, target: [22, 1.8, 24.5] },
    { name: 'far', yaw: 35, pitch: 35, zoom: 0.9, target: [20, 1.5, 20] },
  ],
  expect(_plan, _dressing, check) {
    check.role(12, 3, 11, 'bandstand');
    check.hasTag(12, 3, 11, 'bandstand:s');
    check.noFeature({ type: 'pediment', on: [12, 3, 11] });
    check.noFeature({ type: 'stylobate', on: [12, 3, 11] });
    // Each pillar draws the columns in its own cell.
    check.hasFeature({ type: 'pavilion-bay', on: [12, 2, 11] }, 1);
    check.hasFeature({ type: 'pavilion-bay', on: [13, 2, 12] }, 1);
    for (const [x, y, z] of [[8, 4, 24], [12, 5, 24], [16, 3, 24], [22, 3, 23], [25, 3, 24], [29, 3, 24], [34, 3, 24], [9, 3, 28]] as const) check.role(x, y, z, 'bandstand');
    check.role(20, 3, 8, 'stoa');
    check.hasTag(20, 3, 8, 'stoa:w');
    check.noFeature({ type: 'pediment', on: [20, 3, 8] });
    check.hasProp({ type: 'structure-prop', variant: 'crates', rule: 'R-H98.structure-props' });
    check.role(27, 5, 9, 'temple');
    check.role(26, 3, 16, 'temple');
    check.role(31, 3, 16, 'bandstand');
  },
});
