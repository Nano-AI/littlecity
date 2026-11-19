// Fences (J20, styled by R-E01): a run of cell pieces and edge pieces drawn
// as straight stretches between posts. Posts stand at corners, tees and free
// ends; a run that meets a structure goes into it with no post; a gate
// stands where J20 found a path crossing.
//
//   picket-fence      white pickets on two rails, uneven by seed
//   rope-fence        stout posts and two sagging ropes (docks, bridges)
//   iron-railing      dark bars between two rails (roof terraces)
//   stone-balustrade  turned balusters under a stone rail (marble)
//
// One ink group for the whole run, so it is drawn as one object. Edge pieces
// J20-F found nothing to stand on (round the eaves of a pitched roof) are
// left out.
//
// Reads: the structure, its role and features, each cell piece's side
// neighbours and side-column terrain (through buildRun). Triangles: about
// 100 a cell for pickets, 150 for iron, 90 for rope, 260 for a balustrade.

import type { Mat4Like } from '@/core/mat4';
import { compose, translation } from '@/core/mat4';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { MeshBuilder } from '@/gen/mesh';
import { drawGate, drawPost, drawSpan, type FenceStyle } from '@/parts/ground/edge-draw';
import { along, buildRun, gateAxis, placeRng, runFrame, segmentFrame, trimAt } from '@/parts/ground/runs';
import { rampColor } from '@/style/palette';

const STYLES: readonly FenceStyle[] = ['picket-fence', 'rope-fence', 'iron-railing', 'stone-balustrade'];

export default defineGenerator({
  kind: 'fence',
  build(s, plan, parts) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: s.id });
    b.setInk('fence');
    const role = plan.roles.get(s.id)?.role;
    const style: FenceStyle = STYLES.includes(role as FenceStyle) ? (role as FenceStyle) : 'picket-fence';
    const stone = rampColor('marble', s.color);
    // J20-F: an edge piece with nothing flat to stand on (round a pitched roof's eaves) is not drawn.
    const bare = new Set<number>();
    for (const f of plan.featuresByStructure.get(s.id) ?? []) if (f.type === 'run-bare' && f.edge !== undefined) bare.add(f.edge);
    const run = buildRun(bare.size ? { ...s, edges: s.edges.filter((e) => !bare.has(e)) } : s, plan);

    for (const seg of run.segments) {
      const t0 = trimAt(seg.from), t1 = trimAt(seg.to);
      const length = seg.length - t0 - t1;
      if (length <= 0.01) continue;
      // Posts between the ends, one a cell, for the styles that hang from posts.
      const posts: number[] = [];
      if (style !== 'picket-fence') {
        for (let p = 1; p < seg.length - 0.3; p++) if (p - t0 > 0.25 && seg.length - t1 - p > 0.25) posts.push(p - t0);
      }
      const clear: number[] = [];
      if (seg.from.kind !== 'butt') clear.push(0);
      if (seg.to.kind !== 'butt') clear.push(length);
      const start = along(seg.from, seg.axis) + t0;
      b.at(compose(segmentFrame(seg, run.y), translation(t0, 0, 0)), () =>
        drawSpan(b, style, { length, posts, clear, phase: start, stone, r: placeRng(s, seg.from.x + (seg.axis === 'x' ? t0 : 0), seg.from.z + (seg.axis === 'z' ? t0 : 0)) }),
      );
    }
    for (const n of run.nodes) {
      const r = placeRng(s, n.x, n.z);
      if (n.kind === 'joint' || n.kind === 'post') {
        b.at(translation(n.x, run.y, n.z), () => drawPost(b, style, 0, 0, { r, stone }));
      } else if (n.kind === 'gate') {
        b.at(runFrame(gateAxis(n), n.x, run.y, n.z), () => drawGate(b, style, { r, stone }));
      }
    }
    // Gates and run ends are drawn above; anything else on the run is drawn by its part.
    placeFeatures(b, anchors, s, plan, parts, (f) => (f.type === 'gate' || f.type === 'run-end' || f.type === 'run-inset' || f.type === 'run-bare' ? null : undefined));
    return { mesh: b.build(), anchors };
  },
});
