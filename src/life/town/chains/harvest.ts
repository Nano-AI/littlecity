// L59 · The harvest (posts from L59.harvest.rule.ts), and the wheat's year.
//
// The field is really cut. Each cell of a wheat field has a state (gardens.ts,
// WheatState): how grown it is, and how many of its rows are mown, from which
// side. While a field is anything but standing ripe and whole, this chain
// takes the baked field out of the town's picture (liftStructure, hidden)
// and draws it itself from the same generator with those states
// (plantGarden), redrawing only when a state changes: a swing of the scythe
// takes a row or two.
//
//   the year     ploughed earth in early spring, green shoots, growing
//                through early summer, ripe and golden from late summer;
//                cut through the autumn harvest; bare stubble in winter
//                (under the snow); ploughed again in spring
//   the harvest  late summer and autumn, by day and not in rain: two
//                farmhands, scythes on their shoulders, go to a standing
//                cell, stand at the edge they reach it by and mow it: the
//                swathe falls row by row away from them as they swing, the
//                standing edge retreating in front of them, stalks and chaff
//                flying low off the blade. A cell finished, its cut stalks
//                stand on the stubble as a stook of three sheaves.
//   the sheaves  between cuts a farmhand lays the scythe down by a stook,
//                takes a sheaf from it (the stook gets smaller) and carries
//                it on the shoulder to the mill, heaps it by the door (the
//                miller takes it in: L51), and comes back for the scythe
//
// The state is the town's for now, not the player's: it is not saved; on a
// reload the field stands as the season has it. Progress only moves forward
// within a harvest.

import { keyZ, opposite, type CellKey } from '@/core/grid';
import { rand } from '@/core/rand';
import { plantGarden } from '@/gen/floor/garden.gen';
import { WHEAT_ROWS, type WheatState } from '@/gen/floor/gardens';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import type { InstanceHandle } from '@/life/api';
import { CHAINS } from '@/style/town-life';
import { place } from '../../motion/pose';
import type { Person } from '../../people/crowd';
import { heapSpots, type Board, type Chain, type Plan, type PlanStep, type Post, type Store } from '../board';
import { keepHand, reaches, standAt } from '../hands';

export interface Field {
  id: string;
  /** The field's structure (the wheat-field garden). */
  structure: number;
  cells: Post[];
  mill: Post | undefined;
  /** Rows mown in each cell, and from which side. */
  cut: Map<CellKey, number>;
  from: Map<CellKey, 0 | 2>;
  /** The stook on each finished cell: up to three sheaves. */
  stooks: Map<CellKey, Store>;
  /** Cells somebody is on the way to mow, and when each mowing began (life time). */
  going: Set<CellKey>;
  mowing: Map<Person, { cell: CellKey; since: number; rows: number }>;
  hands: (Person | null)[];
  /** The field as drawn by this chain: the baked one lifted out and hidden, and ours in its place. */
  lifted: InstanceHandle | null;
  mesh: InstanceHandle | null;
  drawn: string;
}

/** The heap of sheaves by a mill's door (the miller reads it: chains/bread.ts). */
export function millHeap(board: Board, mill: Post): Store {
  return board.store(`mill-heap:${mill.structure}`, heapSpots(mill.cell, opposite(mill.dir ?? 0), board.centre(mill.cell).y, 1, 0.17));
}

/** Late summer and autumn: the harvest. */
export function harvestTime(board: Board): boolean {
  const s = board.season;
  return (s.season === 'summer' && s.progress > 0.35) || s.season === 'autumn';
}

/** How grown the wheat is by the season: 0 ploughed, green shoots, growing, 1 ripe. */
export function wheatGrowth(board: Board): number {
  const s = board.season;
  switch (s.season) {
    case 'spring':
      return s.progress < 0.25 ? 0 : 0.18 + 0.32 * ((s.progress - 0.25) / 0.75);
    case 'summer':
      return 0.5 + 0.5 * Math.min(1, s.progress / 0.35);
    default:
      return 1;
  }
}

/** Sheaves a finished cell gives. */
export const SHEAVES = 3;

/** A stalk of cut wheat with its ear, flying off the blade. */
function chaffMesh(): MeshData {
  const b = new MeshBuilder({ ink: 'chaff' });
  b.setInk('stalk').setColor('#e2bd5c').setPattern(PATTERN.none);
  b.box([-0.004, 0, -0.004], [0.004, 0.07, 0.004]);
  b.setInk('ear').setColor('#c98f32');
  b.box([-0.008, 0.06, -0.006], [0.008, 0.09, 0.006]);
  return b.build();
}
let chaff: MeshData | null = null;

export interface HarvestChain extends Chain {
  readonly fields: readonly Field[];
  /** A cell's state now (for tests and for the drawing). */
  stateOf(field: Field, cell: CellKey): WheatState;
}

export function harvestChain(): HarvestChain {
  let fields: Field[] = [];
  let lastSeason = '';
  const flying: { h: InstanceHandle; x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; t: number }[] = [];

  const stateOf = (f: Field, cell: CellKey, board?: Board): WheatState => {
    const growth = board ? wheatGrowth(board) : 1;
    // Winter: what is left of the year's wheat is stubble (under the snow the seasons lay on it).
    if (board && board.season.season === 'winter') return { growth: 1, cut: WHEAT_ROWS, from: 0 };
    return { growth, cut: f.cut.get(cell) ?? 0, from: f.from.get(cell) ?? 0 };
  };

  /** Draws the field (or gives the town back its own drawing of it when it stands ripe and whole). */
  const draw = (board: Board, f: Field): void => {
    const stage = board.stage;
    const st = board.shape?.structures.get(f.structure);
    if (!stage || !st || !board.shape) return;
    const growth = wheatGrowth(board);
    const winter = board.season.season === 'winter';
    const whole = !winter && Math.abs(growth - 1) < 1e-6 && [...f.cut.values()].every((n) => n <= 0);
    const key = whole ? 'whole' : `${winter ? 'w' : ''}${growth.toFixed(2)}|${[...f.cut].map(([c, n]) => `${c}:${n}:${f.from.get(c) ?? 0}`).join(',')}`;
    if (key === f.drawn) {
      f.lifted?.setVisible(false);
      return;
    }
    f.drawn = key;
    f.mesh?.release();
    f.mesh = null;
    if (whole) {
      f.lifted?.release();
      f.lifted = null;
      return;
    }
    f.lifted ??= stage.liftStructure(f.structure);
    f.lifted?.setVisible(false);
    const b = new MeshBuilder({ ink: f.structure });
    const cells = new Set(st.cells);
    plantGarden(b, st, board.shape, (cell) => (cells.has(cell) ? stateOf(f, cell, board) : { growth: 1, cut: 0, from: 0 }));
    f.mesh = stage.spawnMesh(b.build(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  };

  const release = (f: Field): void => {
    f.mesh?.release();
    f.mesh = null;
    f.lifted?.release();
    f.lifted = null;
    f.drawn = '';
  };

  /** Stalks and chaff off the blade, low and short. */
  const flyChaff = (board: Board, x: number, y: number, z: number, n: number): void => {
    if (!board.stage) return;
    chaff ??= chaffMesh();
    for (let i = 0; i < n; i++) {
      const r = (w: string): number => rand(board.seed, 'chaff', w, board.now, i);
      const a = r('a') * Math.PI * 2;
      flying.push({ h: board.stage.spawnMesh(chaff, place(x, y, z, a)), x, y, z, vx: Math.cos(a) * 0.35, vy: 0.5 + r('up') * 0.3, vz: Math.sin(a) * 0.35, spin: (r('s') - 0.5) * 12, t: 0 });
    }
  };

  const chain: HarvestChain = {
    id: 'harvest',
    keeps: (load) => load === 'scythe',
    get fields() {
      return fields;
    },
    stateOf: (f, cell) => stateOf(f, cell),
    sync(board) {
      const posts = board.posts('harvest');
      const before = new Map(fields.map((f) => [f.id, f]));
      fields = [...new Set(posts.map((p) => p.ref))].map((id) => {
        const had = before.get(id);
        before.delete(id);
        const cells = posts.filter((p) => p.ref === id && p.role === 'field');
        const f: Field = had ?? { id, structure: Number(id), cells, mill: undefined, cut: new Map(), from: new Map(), stooks: new Map(), going: new Set(), mowing: new Map(), hands: [null, null], lifted: null, mesh: null, drawn: '' };
        f.cells = cells;
        f.mill = posts.find((p) => p.ref === id && p.role === 'mill');
        if (f.mill) millHeap(board, f.mill);
        // A stook of three sheaves on each cell, standing on the stubble, leaning together.
        const keep = new Map<CellKey, Store>();
        for (const c of cells) {
          const c0 = board.centre(c.cell);
          const y = c0.y + 0.01;
          // Each sheaf leans in (its -X) to the stook's middle: its +X points out along its spot's angle.
          keep.set(c.cell, board.store(`stook:${c.cell}`, [0, 1, 2].map((i) => ({ x: c0.x + 0.12 + Math.cos(i * 2.1) * 0.045, y, z: c0.z + Math.sin(i * 2.1) * 0.045, yaw: -i * 2.1 }))));
        }
        f.stooks = keep;
        f.hands = f.hands.map((h) => keepHand(board, chain, h, cells[0]!.cell, (p) => p.work?.job === 'gardener' || p.work === null));
        f.drawn = ''; // the town changed: draw it again
        return f;
      });
      for (const gone of before.values()) {
        for (const h of gone.hands) if (h && board.claimedBy(h) === chain) board.unclaim(h);
        release(gone);
      }
    },
    step(dt, _time, board) {
      // A new year: in spring the field is ploughed and sown again; what was cut is forgotten.
      const season = board.season.season;
      if (season === 'spring' && lastSeason !== '' && lastSeason !== 'spring')
        for (const f of fields) {
          f.cut.clear();
          f.from.clear();
          for (const s of f.stooks.values()) while (board.take(s)) void 0;
        }
      lastSeason = season;
      for (const f of fields) {
        // Mowing: the rows fall as the scythe swings, away from where the farmhand stands.
        for (const [p, m] of f.mowing) {
          if (p.mode !== 'linger' || p.goal?.errand?.tag !== 'harvest:cut') {
            f.mowing.delete(p);
            continue;
          }
          const rows = Math.min(WHEAT_ROWS, Math.floor(((board.now - m.since) / CHAINS.mow) * (WHEAT_ROWS + 1)));
          const had = f.cut.get(m.cell) ?? 0;
          // The mower walks on behind the standing edge as it goes back, a step at a time with the swings.
          const fromN = f.from.get(m.cell) !== 2;
          const edge = keyZ(m.cell) + (fromN ? Math.max(rows, had) / WHEAT_ROWS : 1 - Math.max(rows, had) / WHEAT_ROWS);
          p.z = fromN ? Math.max(p.z, Math.min(edge - 0.13, keyZ(m.cell) + 0.8)) : Math.min(p.z, Math.max(edge + 0.13, keyZ(m.cell) + 0.2));
          if (rows > had) {
            f.cut.set(m.cell, rows);
            // Where the standing edge is now: a little stalk and chaff off it.
            const c0 = board.centre(m.cell);
            const edgeZ = keyZ(m.cell) + (f.from.get(m.cell) === 2 ? 1 - rows / WHEAT_ROWS : rows / WHEAT_ROWS);
            flyChaff(board, c0.x + (rand(board.seed, 'cx', board.now) - 0.5) * 0.5, c0.y + 0.1, edgeZ, 2);
          }
        }
        draw(board, f);
      }
      // The chaff: up a little and down, tumbling.
      for (let i = flying.length - 1; i >= 0; i--) {
        const c = flying[i]!;
        c.t += dt;
        c.x += c.vx * dt;
        c.z += c.vz * dt;
        c.vy -= 2.2 * dt;
        c.y += c.vy * dt;
        if (c.t > 0.6) {
          c.h.release();
          flying.splice(i, 1);
          continue;
        }
        c.h.setMatrix(place(c.x, c.y, c.z, c.spin * c.t, 1.3, 1.3, 1.3));
      }
    },
    dispose() {
      for (const f of fields) release(f);
      for (const c of flying) c.h.release();
      flying.length = 0;
    },
    offer(p, time, board) {
      const f = fields.find((x) => x.hands.includes(p));
      if (!f || !time.isDay || !harvestTime(board) || board.weather.rain > 0.4) return null;
      const steps: PlanStep[] = [];
      // A sheaf to the mill first, if a stook has one and the heap has room.
      const heap = f.mill ? millHeap(board, f.mill) : null;
      const stooked = f.cells.find((c) => board.count(f.stooks.get(c.cell)!, 'sheaf') > 0);
      if (heap && f.mill && stooked && heap.items.some((x) => x === null) && reaches(board, p, f.mill.cell)) {
        const from = f.stooks.get(stooked.cell)!;
        const mill = f.mill;
        const hadScythe = p.load === 'scythe';
        steps.push(
          // The scythe laid down by the stook, a sheaf from the stook up on the shoulder.
          board.stepAt(stooked.cell, {
            ...standAt(board, stooked, 0),
            pose: 'tend',
            linger: 0.9,
            load: hadScythe ? 'scythe' : null,
            tag: 'harvest:lift',
            done: (q) => {
              if (!board.take(from, 'sheaf')) return false;
              if (q.load === 'scythe') board.put(from, 'scythe');
              q.load = 'sheaf';
            },
          }),
          board.stepAt(mill.cell, { ...standAt(board, mill, 0.05, 0.25), pose: 'tend', linger: 1, load: 'sheaf', tag: 'harvest:mill', done: (q) => (board.put(heap, 'sheaf') ? void (q.load = null) : false) }),
        );
        if (hadScythe) steps.push(board.stepAt(stooked.cell, { ...standAt(board, stooked, 0), pose: 'tend', linger: 0.7, tag: 'harvest:scythe', done: (q) => void (q.load = board.take(from, 'scythe') ?? q.load) }));
      }
      // Then a cell to mow: the nearest still standing.
      const standing = f.cells.filter((c) => (f.cut.get(c.cell) ?? 0) < WHEAT_ROWS && !f.going.has(c.cell) && ![...f.mowing.values()].some((m) => m.cell === c.cell));
      const here = steps.length > 0 ? f.mill!.cell : p.cell;
      const cell = standing.sort((a, b) => board.dist(a.cell, here) - board.dist(b.cell, here) || a.cell - b.cell)[0];
      if (cell) {
        f.going.add(cell.cell);
        const c0 = board.centre(cell.cell);
        // Into it from the side they come from (north or south), unless it is already begun from the other.
        const begun = f.from.get(cell.cell);
        const fromSide: 0 | 2 = begun ?? (board.centre(here).z <= c0.z ? 0 : 2);
        const edge = fromSide === 0 ? -1 : 1;
        steps.push(
          board.stepAt(cell.cell, {
            spot: { x: c0.x, z: c0.z + edge * 0.36 },
            face: fromSide === 0 ? 0 : Math.PI,
            pose: 'mow',
            linger: CHAINS.mow + 0.6,
            load: 'scythe',
            tag: 'harvest:cut',
            done: (q) => {
              f.going.delete(cell.cell);
              f.from.set(cell.cell, fromSide);
              f.mowing.set(q, { cell: cell.cell, since: board.now, rows: f.cut.get(cell.cell) ?? 0 });
              q.load = 'scythe';
            },
          }),
          // The swathe down: its stalks gathered and stood up as a stook.
          board.stepAt(cell.cell, {
            spot: { x: c0.x, z: c0.z + edge * 0.36 },
            face: fromSide === 0 ? 0 : Math.PI,
            pose: 'tend',
            linger: 1.2,
            load: 'scythe',
            tag: 'harvest:stook',
            done: () => {
              f.mowing.forEach((m, who) => m.cell === cell.cell && f.mowing.delete(who));
              f.cut.set(cell.cell, WHEAT_ROWS);
              const stook = f.stooks.get(cell.cell)!;
              for (let i = 0; i < SHEAVES; i++) board.put(stook, 'sheaf');
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
