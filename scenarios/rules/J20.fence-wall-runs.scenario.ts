// J20: fence and wall runs. Cell pieces and edge pieces join into runs with
// posts at corners and ends and none where a run meets a structure; where a
// path crosses, a fence has a gate and a wall an arched opening.
//
//   north    a picket run of cell pieces between two houses with a gate on
//            a path; a second run laid ALONG a path (no gate)
//   middle   a fenced yard of edge pieces whose ends run into a house wall,
//            with a gate between two path cells
//   south    a low wall of cell pieces with an arched opening and a tee; a
//            walled yard of edge pieces with an arched opening

import { edgeKey } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'J20.fence-wall-runs',
  seed: 23,
  about: 'Runs of fence and wall: posts at corners and ends, clean endings against houses, gates and arched openings where a path crosses.',
  build(b) {
    // Between two houses, with a gate.
    b.house(9, 12, { color: 0 }).house(17, 12, { color: 5 });
    for (let x = 10; x <= 16; x++) b.put('fence', x, 12);
    b.path(13, 10, 13, 14);
    // Along a path: pickets, no gates.
    b.path(20, 12, 24, 12);
    for (let x = 20; x <= 24; x++) b.put('fence', x, 12);

    // A yard against a house: the two arms of the fence run into its south wall.
    b.house(10, 17, { w: 4, color: 2 });
    for (let z = 18; z <= 20; z++) b.fenceEdge(11, z, 'W').fenceEdge(12, z, 'E');
    for (let x = 11; x <= 12; x++) b.fenceEdge(x, 20, 'S');
    b.path(12, 19, 12, 23); // out through the south side
    // A corner, a tee and a crossing of edge pieces on open ground.
    for (let x = 18; x <= 21; x++) b.fenceEdge(x, 19, 'S');
    for (let z = 18; z <= 21; z++) b.fenceEdge(19, z, 'E');
    b.fenceEdge(21, 20, 'E');

    // A low wall with an arched opening and a tee, ending against a house.
    b.house(9, 27, { color: 6 });
    for (let x = 10; x <= 15; x++) b.put('wall', x, 27);
    b.put('wall', 14, 28).put('wall', 14, 29);
    b.path(12, 25, 12, 29);
    // A walled yard of edge pieces with an opening on its east side.
    b.plaza(20, 26, 22, 28);
    b.path(22, 27, 25, 27);
    b.fenceAround(20, 26, 22, 28, 'wall');
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 36, zoom: 2.8, target: [17, 1, 20] },
    { name: 'back', yaw: 225, pitch: 36, zoom: 2.8, target: [17, 1, 20] },
    { name: 'gate', yaw: 45, pitch: 30, zoom: 7, target: [13, 1, 12.5] },
    { name: 'yard', yaw: 135, pitch: 34, zoom: 5.5, target: [12, 1, 19.5] },
    { name: 'arch', yaw: 45, pitch: 30, zoom: 6, target: [12.5, 1, 27.5] },
  ],
  expect(plan, _dressing, check) {
    // One run from house to house, and a gate where the path crosses it.
    check.sameStructure([10, 1, 12], [16, 1, 12]);
    const gate = check.hasFeature({ type: 'gate', variant: 'picket', at: [13, 1, 12] })[0]!;
    check.ok(gate.dir === 0 || gate.dir === 2, 'people walk north–south through the gate');
    // A fence along a path is not a row of gates.
    for (let x = 20; x <= 24; x++) check.noFeature({ type: 'gate', at: [x, 1, 12] });
    // The yard: its two arms end against the house, so both of those ends have no post.
    const yard = plan.edgeAt.get(edgeKey(11, 1, 20, 'S'))!;
    const butts = plan.features.filter((f) => f.type === 'run-end' && f.structure === yard);
    check.equal(butts.length, 2, 'ends of the yard fence that run into the house');
    check.ok(butts.every((f) => f.variant === 'butt' && (f.params as { end?: number }).end === 0), 'they are the north ends');
    const yardGates = plan.features.filter((f) => f.type === 'gate' && f.structure === yard);
    check.equal(yardGates.length, 1, 'gates in the yard fence');
    check.equal(yardGates[0]!.edge, edgeKey(12, 1, 20, 'S'), 'the gate is the edge piece between the two path cells');
    // Free ends on open ground keep their posts.
    const open = plan.edgeAt.get(edgeKey(18, 1, 19, 'S'))!;
    check.equal(plan.features.filter((f) => f.type === 'run-end' && f.structure === open).length, 0, 'no butt ends on open ground');
    // Walls: arched openings.
    check.hasFeature({ type: 'gate', variant: 'arched', at: [12, 1, 27] });
    const walled = plan.edgeAt.get(edgeKey(22, 1, 27, 'E'))!;
    check.equal(plan.features.filter((f) => f.type === 'gate' && f.structure === walled && f.variant === 'arched').length, 1, 'the opening in the walled yard');
    check.equal(check.features({ type: 'gate' }).length, 4, 'gates and openings in all');
  },
});
