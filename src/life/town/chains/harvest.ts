// L59 · The harvest (posts from L59.harvest.rule.ts). From late summer
// through autumn, by day, two farmhands work each wheat field: scythe on the
// shoulder, they go to a standing cell, swing the scythe a few seconds, and
// a stook of sheaves stands where they cut, so the cut part of the field
// grows through the day. Between cuts they carry a sheaf on the shoulder to
// the mill and lay it on the heap by its door, where the miller (L51) takes
// it in before each sack comes out. At dawn the field stands again (its
// stooks stay until carried).

import { CHAINS } from '@/style/town-life';
import type { Person } from '../../people/crowd';
import { heapSpots, type Board, type Chain, type Plan, type PlanStep, type Post, type Store } from '../board';
import { keepHand, reaches, standAt } from '../hands';
import { opposite } from '@/core/grid';
import type { InstanceHandle } from '@/life/api';
import { stubbleMesh } from '@/parts/people/loads';
import { place } from '../../motion/pose';

interface Field {
  id: string;
  cells: Post[];
  mill: Post | undefined;
  /** A stook on each cut cell (one spot each), and which cells are cut today. */
  stooks: Map<number, Store>;
  cut: Set<number>;
  /** The stubble drawn over each cut cell. */
  stubble: Map<number, InstanceHandle>;
  /** Cells somebody is on the way to cut. */
  going: Set<number>;
  hands: (Person | null)[];
}

/** The heap of sheaves by a mill's door (the miller reads it: chains/bread.ts). */
export function millHeap(board: Board, mill: Post): Store {
  return board.store(`mill-heap:${mill.structure}`, heapSpots(mill.cell, opposite(mill.dir ?? 0), board.centre(mill.cell).y, 1, 0.17));
}

/** Late summer and autumn. */
export function harvestTime(board: Board): boolean {
  const s = board.season;
  return (s.season === 'summer' && s.progress > 0.35) || s.season === 'autumn';
}

export function harvestChain(): Chain {
  let fields: Field[] = [];
  let lastPart = '';

  const chain: Chain = {
    id: 'harvest',
    keeps: (load) => load === 'scythe',
    sync(board) {
      const posts = board.posts('harvest');
      const before = new Map(fields.map((f) => [f.id, f]));
      fields = [...new Set(posts.map((p) => p.ref))].map((id) => {
        const had = before.get(id);
        before.delete(id);
        const cells = posts.filter((p) => p.ref === id && p.role === 'field');
        const f: Field = had ?? { id, cells, mill: undefined, stooks: new Map(), cut: new Set(), stubble: new Map(), going: new Set(), hands: [null, null] };
        f.cells = cells;
        f.mill = posts.find((p) => p.ref === id && p.role === 'mill');
        if (f.mill) millHeap(board, f.mill);
        // The stooks keep their places on cells that are still there.
        const keep = new Map<number, Store>();
        for (const c of cells) {
          const c0 = board.centre(c.cell);
          // On the cut stubble, over the height of the standing wheat.
          keep.set(c.cell, board.store(`stook:${c.cell}`, [{ x: c0.x + 0.12, y: c0.y + 0.33, z: c0.z - 0.1, yaw: 0.3 }]));
        }
        f.stooks = keep;
        f.hands = f.hands.map((h) => keepHand(board, chain, h, cells[0]!.cell, (p) => p.work?.job === 'gardener' || p.work === null));
        return f;
      });
      for (const gone of before.values()) {
        for (const h of gone.hands) if (h && board.claimedBy(h) === chain) board.unclaim(h);
        for (const h of gone.stubble.values()) h.release();
      }
      // Stubble only where the field still is.
      for (const f of fields)
        for (const [cell, h] of f.stubble)
          if (!f.cells.some((c) => c.cell === cell)) {
            h.release();
            f.stubble.delete(cell);
          }
    },
    step(_dt, time) {
      // A new day: the field stands again (it grows back overnight, out of season too).
      if (time.isDawn && lastPart !== '' && lastPart !== 'dawn')
        for (const f of fields) {
          f.cut.clear();
          for (const h of f.stubble.values()) h.release();
          f.stubble.clear();
        }
      lastPart = time.part;
    },
    dispose() {
      for (const f of fields) for (const h of f.stubble.values()) h.release();
    },
    offer(p, time, board) {
      const f = fields.find((x) => x.hands.includes(p));
      if (!f || !time.isDay || !harvestTime(board) || board.weather.rain > 0.4) return null;
      const steps: PlanStep[] = [];
      // A sheaf to the mill first, if one stands and the heap has room.
      const heap = f.mill ? millHeap(board, f.mill) : null;
      const stooked = f.cells.find((c) => board.count(f.stooks.get(c.cell)!) > 0);
      if (heap && f.mill && stooked && heap.items.some((x) => x === null) && reaches(board, p, f.mill.cell)) {
        const from = f.stooks.get(stooked.cell)!;
        const mill = f.mill;
        const hadScythe = p.load === 'scythe';
        steps.push(
          // The scythe laid down where the stook stood, the sheaf up on the shoulder.
          board.stepAt(stooked.cell, {
            ...standAt(board, stooked, 0),
            pose: 'tend',
            linger: 0.9,
            load: hadScythe ? 'scythe' : null,
            tag: 'harvest:lift',
            done: (q) => {
              if (!board.take(from)) return false;
              if (q.load === 'scythe') board.put(from, 'scythe');
              q.load = 'sheaf';
            },
          }),
          board.stepAt(mill.cell, { ...standAt(board, mill, 0.05, 0.25), pose: 'tend', linger: 1, load: 'sheaf', tag: 'harvest:mill', done: (q) => (board.put(heap, 'sheaf') ? void (q.load = null) : false) }),
        );
        if (hadScythe) {
          // And back for the scythe.
          steps.push(board.stepAt(stooked.cell, { ...standAt(board, stooked, 0), pose: 'tend', linger: 0.7, tag: 'harvest:scythe', done: (q) => void (q.load = board.take(from, 'scythe') ?? q.load) }));
        }
      }
      // Then a cell to cut.
      const standing = f.cells.filter((c) => !f.cut.has(c.cell) && !f.going.has(c.cell) && board.count(f.stooks.get(c.cell)!) === 0);
      const here = steps.length > 0 ? f.mill!.cell : p.cell;
      const cell = standing.sort((a, b) => board.dist(a.cell, here) - board.dist(b.cell, here) || a.cell - b.cell)[0];
      if (cell) {
        f.going.add(cell.cell);
        const c0 = board.centre(cell.cell);
        steps.push(
          board.stepAt(cell.cell, {
            spot: { x: c0.x - 0.15, z: c0.z + 0.1 },
            face: Math.PI / 2,
            pose: 'mow',
            linger: CHAINS.mow,
            load: 'scythe', // (fetched from the farmhand's house the first time: they come out with it)
            tag: 'harvest:cut',
            done: (q) => {
              f.going.delete(cell.cell);
              f.cut.add(cell.cell);
              if (board.stage && !f.stubble.has(cell.cell)) f.stubble.set(cell.cell, board.stage.spawnMesh(stubbleMesh(), place(c0.x, c0.y, c0.z)));
              board.put(f.stooks.get(cell.cell)!, 'sheaf');
              q.load = 'scythe';
            },
          }),
        );
      }
      if (steps.length === 0) return null;
      const plan: Plan = {
        chain,
        at: 0,
        steps,
        fail: () => {
          if (cell) f.going.delete(cell.cell);
        },
      };
      return plan;
    },
  };
  return chain;
}
