// MINIMAL (Stage 0). Owner: Animation (Stage 3). Final signature: createLife.
//
// Runs every discovered system and behaviour. An item's behaviour state is
// kept for as long as its id survives re-resolves. The Animation owner may
// rewrite the insides (pop-in order, pooling) but keeps the LifeRuntime
// interface and the lifecycle documented on defineBehaviour/defineSystem.

import { hash, rand } from '@/core/rand';
import type { Actor, Prop } from '@/resolve/plan';
import type {
  Behaviour,
  InstanceHandle,
  LifeContext,
  LifeRuntime,
  LifeStage,
  Signals,
  System,
  SystemContext,
  Town,
} from './api';
import { allBehaviours, allSystems } from './discover';

export interface LifeOptions {
  /** Defaults to every discovered behaviour and system (tests pass their own). */
  behaviours?: readonly Behaviour[];
  systems?: readonly System[];
}

interface Running {
  behaviour: Behaviour;
  state: unknown;
  ctx: LifeContext;
  hash: number;
}

const NO_INSTANCE: InstanceHandle = {
  base: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  setMatrix() {},
  setVisible() {},
  setParams() {},
  release() {},
};

export function createLife(stage: LifeStage, signals: Signals, opts: LifeOptions = {}): LifeRuntime {
  const behaviours = new Map<string, Behaviour>();
  for (const b of opts.behaviours ?? allBehaviours()) behaviours.set(`${b.category}:${b.type}`, b);
  const systems = [...(opts.systems ?? allSystems())];
  const systemState = new Map<System, unknown>();
  const running = new Map<string, Running>();
  let town: Town | null = null;
  let systemCtx: SystemContext | null = null;

  const syncItems = (next: Town): void => {
    const dressing = next.dressing;
    if (!dressing) return; // keep everything alive until the new dressing arrives
    const seen = new Set<string>();
    const visit = (category: 'prop' | 'actor', item: Prop | Actor): void => {
      const behaviour = behaviours.get(`${category}:${item.type}`);
      if (!behaviour) return;
      seen.add(item.id);
      const instance = stage.instance(item.id) ?? NO_INSTANCE;
      const old = running.get(item.id);
      if (old && old.behaviour === behaviour) {
        old.ctx.item = item;
        old.ctx.shape = next.shape;
        old.ctx.dressing = dressing;
        old.ctx.instance = instance;
        if (old.hash !== item.hash) {
          old.hash = item.hash;
          behaviour.hooks.changed?.(old.state, old.ctx);
        }
        return;
      }
      if (old) old.behaviour.hooks.dispose?.(old.state, old.ctx);
      const seed = hash(next.shape.world.seed, item.id);
      const ctx: LifeContext = {
        item,
        seed,
        rand: (...p) => rand(seed, ...p),
        shape: next.shape,
        dressing,
        instance,
        stage,
      };
      running.set(item.id, { behaviour, state: behaviour.hooks.create(item, ctx), ctx, hash: item.hash });
    };
    for (const p of dressing.props) visit('prop', p);
    for (const a of dressing.actors) visit('actor', a);
    for (const [id, r] of running) {
      if (seen.has(id)) continue;
      r.behaviour.hooks.dispose?.(r.state, r.ctx);
      running.delete(id);
    }
  };

  return {
    sync(next) {
      if (!systemCtx) {
        systemCtx = { stage, signals, seed: next.shape.world.seed };
        for (const s of systems) systemState.set(s, s.create(systemCtx));
      }
      for (const s of systems) s.sync?.(systemState.get(s), next, town, systemCtx);
      syncItems(next);
      town = next;
    },
    update(dt) {
      if (systemCtx) for (const s of systems) s.update(systemState.get(s), dt, signals, systemCtx);
      for (const r of running.values()) r.behaviour.hooks.update(r.state, dt, signals, r.ctx);
    },
    dispose() {
      for (const r of running.values()) r.behaviour.hooks.dispose?.(r.state, r.ctx);
      running.clear();
      if (systemCtx) for (const s of systems) s.dispose?.(systemState.get(s), systemCtx);
      systemState.clear();
      systemCtx = null;
      town = null;
    },
  };
}
