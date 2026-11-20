// Everything a mischief system draws, owned (design section 13b). Owner: Mischief.
//
// A system takes handles from pools, hands them back, keeps some for a
// minute (a scorch, embers, window glows) and lets others go when a fire
// moves. When the town is replaced (a new island, a town opened, the dice)
// life is disposed, and every handle it ever drew must go with it, whether
// it was in use, waiting in a pool or forgotten in some list. Spawning
// through an owned stage means dispose can take back all of them at once,
// so nothing of the old town's mischief is left in the picture.

import type { InstanceHandle, LifeStage } from '../api';

export interface Owned {
  /** The stage to draw with: the same as the real one, but it remembers every handle until released. */
  readonly stage: LifeStage;
  /** Handles drawn and not yet released. */
  readonly live: number;
  /** Releases every handle still out. */
  releaseAll(): void;
}

/** Per real stage, every owned set still holding handles (for the debug handle and tests: what mischief has drawn). */
const byStage = new WeakMap<LifeStage, Set<Set<InstanceHandle>>>();

/** How many handles the mischief systems on this stage have drawn and not given back. */
export function mischiefDrawn(stage: LifeStage): number {
  let n = 0;
  for (const s of byStage.get(stage) ?? []) n += s.size;
  return n;
}

export function ownStage(real: LifeStage): Owned {
  const live = new Set<InstanceHandle>();
  let sets = byStage.get(real);
  if (!sets) byStage.set(real, (sets = new Set()));
  sets.add(live);
  const track = (h: InstanceHandle): InstanceHandle => {
    const w: InstanceHandle = {
      get base() {
        return h.base;
      },
      setMatrix: (m) => h.setMatrix(m),
      setVisible: (v) => h.setVisible(v),
      setParams: (a, b, c, d) => h.setParams(a, b, c, d),
      release: () => {
        if (!live.delete(w)) return;
        h.release();
      },
    };
    live.add(w);
    return w;
  };
  const stage: LifeStage = {
    instance: (id) => real.instance(id),
    spawn: (part, at) => track(real.spawn(part, at)),
    spawnMesh: (mesh, at) => track(real.spawnMesh(mesh, at)),
    liftStructure: (id) => {
      const h = real.liftStructure(id);
      return h ? track(h) : null;
    },
    socket: (id) => real.socket(id),
  };
  return {
    stage,
    get live() {
      return live.size;
    },
    releaseAll() {
      for (const h of [...live]) h.release();
      sets.delete(live);
    },
  };
}
