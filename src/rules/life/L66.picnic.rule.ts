// L66 · tier 2 · A picnic. Open grass or garden near the houses → up to
// PICNIC.blankets posts `picnic|spot|<i>` close together (a picnic ground:
// the best spot and the best others two or three cells round it, two apart),
// where families spread their blankets. Open: a walking-graph cell on bare grass or a
// garden floor (not a playing field, not sand, not cluttered, not a doorstep)
// with all four neighbours walkable too, within PICNIC.reach steps of a
// front door. Under or beside trees first (a tree within two cells), then
// nearest the houses. src/life/town/chains/picnic.ts holds the picnics.

import { DIR4, key, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { PICNIC } from '@/style/scenes';
import { frontDoor, homes, navOf, steps } from './people.lib';

type Data = { i: number };

export default defineRule<Data>({
  id: 'L66.picnic',
  part: 'life',
  tier: 2,
  priority: 405,
  townWide: true,
  about: 'Reads: grass and gardens, trees, the walking graph, front doors. Emits: errand sockets picnic|spot on open grass near the houses.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const doorCells = homes(ctx)
      .map((h) => frontDoor(nav, h.id))
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map((d) => nav.nodes[d.node]!.cell);
    if (doorCells.length < 3) return [];
    const doorsteps = new Set(nav.doors.filter((d) => d.node >= 0).map((d) => nav.nodes[d.node]!.cell));
    const trees: CellKey[] = [];
    for (const [c, k] of ctx.facts.kinds) if (k === 'tree') trees.push(c);
    const open = (c: CellKey): boolean => {
      const n = nav.nodeAt.get(c);
      if (n === undefined || doorsteps.has(c)) return false;
      const node = nav.nodes[n]!;
      if (node.clutter || node.rot !== undefined || node.passage !== undefined) return false;
      const floor = ctx.facts.world.floors.get(key(keyX(c), keyY(c) - 1, keyZ(c))) ?? ctx.facts.world.floors.get(c);
      return (node.surface === 'grass' && floor === undefined) || (node.surface === 'garden' && floor === 'garden');
    };
    const walkable = (c: CellKey): boolean => nav.nodeAt.has(c);
    const out: { cell: CellKey; score: number }[] = [];
    for (const n of nav.nodes) {
      const c = n.cell;
      if (!open(c)) continue;
      if (!DIR4.every(([dx, dz]) => walkable(key(keyX(c) + dx, keyY(c), keyZ(c) + dz)))) continue;
      const near = Math.min(...doorCells.map((d) => steps(d, c)));
      if (near > PICNIC.reach || near < 2) continue;
      const shade = trees.some((t) => Math.max(Math.abs(keyX(t) - keyX(c)), Math.abs(keyZ(t) - keyZ(c))) <= 2 && Math.abs(keyY(t) - keyY(c)) <= 1);
      out.push({ cell: c, score: (shade ? 0 : 20) + near });
    }
    out.sort((a, b) => a.score - b.score || a.cell - b.cell);
    // A picnic ground, not scattered squares: the best spot, then the best others close round it (two to
    // three cells off, two apart), so the blankets lie together under the same trees.
    const chosen: CellKey[] = [];
    const seed = out[0];
    if (seed) {
      chosen.push(seed.cell);
      for (const o of out) {
        if (chosen.length >= Math.round(PICNIC.blankets)) break;
        const fromSeed = Math.max(Math.abs(keyX(seed.cell) - keyX(o.cell)), Math.abs(keyZ(seed.cell) - keyZ(o.cell)));
        if (fromSeed > 3 || Math.abs(keyY(seed.cell) - keyY(o.cell)) > 0) continue;
        if (chosen.some((c) => Math.max(Math.abs(keyX(c) - keyX(o.cell)), Math.abs(keyZ(c) - keyZ(o.cell))) < 2)) continue;
        chosen.push(o.cell);
      }
    }
    return chosen.map((cell, i) => ({ anchor: cell, key: `spot${i}`, data: { i } })) satisfies Candidate<Data>[];
  },
  apply(c, out) {
    out.socket({ id: `L66.picnic@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, name: `picnic|spot|${c.data.i}` });
  },
});
