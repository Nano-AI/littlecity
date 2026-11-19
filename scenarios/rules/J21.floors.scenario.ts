// J21 · Floors. What a path does where it meets something: a flush kerb at
// a plaza, a doorstep at a door, the edge of a garden, the foot and the head
// of a stair, boards along a dock and cobbles over a bridge. The rule tells
// each floor region what lies beside it with `floor-link` features; the
// floor generators draw the rest (rounded ends, fillets, the worn edge).
//
// No door rule exists in the Ground owner's tree, so this fixture brings a
// one-line stand-in for J06: a door on the south side of every house.

import { keyX, keyY, keyZ, S } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';

const doors = defineRule({
  id: 'J-X21.fixture-door',
  part: 'joinery',
  tier: 1,
  priority: 940,
  about: 'Fixture only: a door on the south side of every ground-floor house block, standing in for J06.',
  find: ({ facts }) => [...facts.kinds].filter(([cell, kind]) => kind === 'house' && !facts.kinds.has(cell - (1 << 12))).map(([cell]) => ({ anchor: cell, structure: facts.structureAt.get(cell)! })),
  apply: (c, out) => void out.feature({ type: 'door', structure: c.structure!, cell: c.anchor, dir: S, variant: 'plain', params: { main: 1 } }),
});

export default scenario({
  name: 'J21.floors',
  seed: 14,
  about: 'A path meeting a plaza (kerb), a door (doorstep), a garden, a stair foot and head, a dock (boards) and a bridge deck (cobbles).',
  rules: [doors],
  terrain(t) {
    t.flat(1);
    t.water(4, 26, 43, 43);
  },
  build(b) {
    b.path(12, 18, 30, 18); // the street
    // Three houses whose doors open onto it; the middle one stands back and gets nothing.
    b.house(14, 17, { color: 1 }).house(17, 16, { color: 2 }).house(20, 17, { color: 5 });
    b.plaza(24, 14, 26, 16).path(25, 17); // a square, and the lane into it
    b.garden(12, 20, 14, 21).path(13, 19); // a garden the street has a lane into
    b.path(18, 19, 18, 25); // down to the water
    for (let z = 26; z <= 29; z++) b.block('dock', 18, 0, z);
    b.path(18, 26, 18, 28); // and out along the jetty
    // Up a stair, over a bridge of two arches, down the other side.
    b.path(27, 19, 27, 21);
    b.block('stairs', 27, 1, 22, { rot: 2 });
    b.put('arch', 27, 23).put('arch', 27, 24);
    b.path(27, 23, 27, 24);
    b.block('stairs', 27, 1, 25, { rot: 0 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 36, zoom: 3, target: [21, 1, 20.5] },
    { name: 'back', yaw: 225, pitch: 36, zoom: 3, target: [21, 1, 20.5] },
    { name: 'doors', yaw: 45, pitch: 38, zoom: 6, target: [17.5, 1, 18] },
    { name: 'kerb', yaw: 135, pitch: 34, zoom: 6, target: [25, 1, 17] },
  ],
  expect(_plan, _dressing, check) {
    // Doors: on the path cell in front of each house that stands on the street, toward the door.
    check.hasFeature({ type: 'floor-link', variant: 'door', at: [14, 1, 18], dir: 0 });
    check.hasFeature({ type: 'floor-link', variant: 'door', at: [20, 1, 18], dir: 0 });
    check.noFeature({ type: 'floor-link', variant: 'door', at: [17, 1, 18] });
    // The plaza: the lane ends in a kerb, and the plaza knows a path arrives.
    check.hasFeature({ type: 'floor-link', variant: 'plaza', at: [25, 1, 17], dir: 0 });
    check.hasFeature({ type: 'floor-link', variant: 'path', at: [25, 1, 16], dir: 2 });
    // The garden.
    check.hasFeature({ type: 'floor-link', variant: 'garden', at: [13, 1, 19], dir: 2 });
    check.hasFeature({ type: 'floor-link', variant: 'path', at: [13, 1, 20], dir: 0 });
    // The stair: its foot from the lane, its head from the bridge, both ways.
    check.hasFeature({ type: 'floor-link', variant: 'stairs', at: [27, 1, 21], dir: 2 });
    check.hasFeature({ type: 'floor-link', variant: 'stairs', at: [27, 2, 23], dir: 0 });
    check.hasFeature({ type: 'floor-link', variant: 'stairs', at: [27, 2, 24], dir: 2 });
    // One path region runs from the street onto the jetty (beach and deck are level).
    check.equal(check.floorStructure(18, 1, 26).id, check.floorStructure(18, 1, 25).id, 'the path onto the jetty is the path down to it');
    check.hasFeature({ type: 'ramp' });
    // Every link belongs to the floor region that draws it.
    for (const f of check.features({ type: 'floor-link' })) {
      check.equal(f.structure, check.floorStructure(keyX(f.cell!), keyY(f.cell!), keyZ(f.cell!)).id, 'a link is a feature of its own floor');
    }
  },
});
