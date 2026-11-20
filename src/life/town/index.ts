// The living town (L51 and up): a crowd with the town's chains on it. The
// people system runs one of these; tests step one with fixed time steps.

import type { CellKey } from '@/core/grid';
import type { MeshData } from '@/gen/mesh';
import type { TimeSignal } from '@/life/api';
import type { DressingPlan, ShapePlan } from '@/resolve/plan';
import { createCrowd, type Crowd, type CrowdOptions } from '../people/crowd';
import type { Load } from '../people/errand';
import { createBoard, type Board, type Chain, type GoodsStage } from './board';
import { breadChain } from './chains/bread';
import { buildChain, type BuildChain } from './chains/build';
import { fishChain } from './chains/fish';
import { watchChain } from './chains/watch';
import { marketChain } from './chains/market-day';
import { waterChain } from './chains/water';

/** Every chain, in the order they are offered a person (the first that wants them has them). */
export function allChains(): Chain[] {
  return [buildChain(), watchChain(), marketChain(), breadChain(), fishChain(), waterChain()];
}

export interface LivingTown {
  crowd: Crowd;
  board: Board;
  sync(shape: ShapePlan, dressing: DressingPlan | null, time: TimeSignal): void;
  step(dt: number, time: TimeSignal): void;
  /** A piece of a building landed (L54: builders come). */
  landed(cell: CellKey): void;
  dispose(): void;
}

export function createLivingTown(opts: CrowdOptions & { stage?: GoodsStage; restingMesh?(kind: Load): MeshData; chains?: Chain[]; seed?: number } = {}): LivingTown {
  let board: Board | null = null;
  const crowd = createCrowd({
    ...opts,
    errands: {
      next: (p, t) => board?.host.next(p, t) ?? null,
      arrived: (p, s) => board?.host.arrived(p, s),
      failed: (p, s) => board?.host.failed(p, s),
    },
  });
  const b = createBoard({ crowd, seed: opts.seed ?? 0, chains: opts.chains ?? allChains(), stage: opts.stage ?? null, ...(opts.restingMesh ? { restingMesh: opts.restingMesh } : {}) });
  board = b;
  return {
    crowd,
    board: b,
    sync(shape, dressing, time) {
      crowd.sync(shape, dressing, time);
      b.sync(shape, dressing);
    },
    step(dt, time) {
      crowd.step(dt, time);
      b.step(dt, time);
    },
    landed(cell) {
      for (const c of b.chains) if (c.id === 'build') (c as BuildChain).landed(cell, b);
    },
    dispose() {
      b.dispose();
    },
  };
}
