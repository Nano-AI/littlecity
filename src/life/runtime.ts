// The life runtime (Animation, Stage 3). Runs every discovered system and
// behaviour; the contract is ./api.ts (LifeRuntime, defineBehaviour,
// defineSystem) and docs/swarm/CONTRACTS.md section 11.
//
// WHAT KEEPS STATE ALIVE. A behaviour's state belongs to the place its item
// is attached to, not to the item record:
//
//   item anchored to a socket   state key = category : type @ socket id
//   anything else               state key = category : item id
//
// So when the town is resolved again, anything whose socket id survives
// keeps its state (a windmill's sails keep turning from where they were, a
// lamp stays lit) even if the rule renumbered its items; and items that are
// not on a socket keep theirs for as long as their own id survives.
// `changed` is called when the content hash differs; `dispose` when the
// place is gone. Between an edit and its dressing nothing is torn down.
//
// WHAT KEEPS IT CHEAP. Nothing here allocates per frame: one loop over the
// systems, one over the running behaviours. A few hundred behaviours cost a
// few hundred plain function calls. Behaviours pose "on twos" (motion/twos.ts)
// and skip the frames between drawings themselves.
//
// WHAT KEEPS IT STANDING. A behaviour or system that throws is reported once
// and switched off (that item stops moving); the frame loop carries on.

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
  /** Where a failing behaviour or system is reported. Default: console.error. */
  onError?(what: string, error: unknown): void;
}

/** The runtime, with a few numbers for the benchmark and for tests. */
export interface Life extends LifeRuntime {
  /** How many behaviours and systems are running now. */
  readonly counts: { behaviours: number; systems: number };
}

interface Running {
  behaviour: Behaviour;
  state: unknown;
  ctx: LifeContext;
  hash: number;
  itemId: string;
}

const NO_INSTANCE: InstanceHandle = {
  base: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  setMatrix() {},
  setVisible() {},
  setParams() {},
  release() {},
};

/** The key a behaviour's state lives under: its socket if it has one, else the item's own id. */
export function stateKey(category: 'prop' | 'actor', item: Prop | Actor): string {
  const at = item.at;
  if (at && 'socket' in at) return `${category}:${item.type}@${at.socket}`;
  return `${category}:${item.id}`;
}

export function createLife(stage: LifeStage, signals: Signals, opts: LifeOptions = {}): Life {
  const behaviours = new Map<string, Behaviour>();
  for (const b of opts.behaviours ?? allBehaviours()) behaviours.set(`${b.category}:${b.type}`, b);
  let systems = [...(opts.systems ?? allSystems())];
  const systemState = new Map<System, unknown>();
  const running = new Map<string, Running>();
  /** The live ones as a flat list, rebuilt on sync: the per-frame loop touches no Map. */
  let active: Running[] = [];
  let town: Town | null = null;
  let systemCtx: SystemContext | null = null;

  const reported = new Set<string>();
  const report = (what: string, error: unknown): void => {
    if (reported.has(what)) return;
    reported.add(what);
    if (opts.onError) opts.onError(what, error);
    else console.error(`life: ${what} failed and was switched off`, error);
  };

  const dispose = (r: Running): void => {
    try {
      r.behaviour.hooks.dispose?.(r.state, r.ctx);
    } catch (error) {
      report(`${r.behaviour.category} '${r.behaviour.type}' (dispose)`, error);
    }
  };

  const syncItems = (next: Town): void => {
    const dressing = next.dressing;
    if (!dressing) return; // keep everything alive until the new dressing arrives
    const seen = new Set<string>();
    const visit = (category: 'prop' | 'actor', item: Prop | Actor): void => {
      const behaviour = behaviours.get(`${category}:${item.type}`);
      if (!behaviour) return;
      let k = stateKey(category, item);
      // Two items of one type on one socket: the second keeps its own state under its own id.
      if (seen.has(k)) k = `${category}:${item.id}`;
      seen.add(k);
      const instance = stage.instance(item.id) ?? NO_INSTANCE;
      const old = running.get(k);
      if (old && old.behaviour === behaviour) {
        old.ctx.item = item;
        old.ctx.shape = next.shape;
        old.ctx.dressing = dressing;
        old.ctx.instance = instance;
        old.itemId = item.id;
        if (old.hash !== item.hash) {
          old.hash = item.hash;
          try {
            behaviour.hooks.changed?.(old.state, old.ctx);
          } catch (error) {
            report(`${category} '${item.type}' (changed)`, error);
            running.delete(k);
          }
        }
        return;
      }
      if (old) dispose(old);
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
      try {
        running.set(k, { behaviour, state: behaviour.hooks.create(item, ctx), ctx, hash: item.hash, itemId: item.id });
      } catch (error) {
        running.delete(k);
        report(`${category} '${item.type}' (create)`, error);
      }
    };
    for (const p of dressing.props) visit('prop', p);
    for (const a of dressing.actors) visit('actor', a);
    for (const [k, r] of running) {
      if (seen.has(k)) continue;
      dispose(r);
      running.delete(k);
    }
    active = [...running.values()];
  };

  return {
    get counts() {
      return { behaviours: active.length, systems: systems.length };
    },
    sync(next) {
      if (!systemCtx) {
        systemCtx = { stage, signals, seed: next.shape.world.seed };
        const ok: System[] = [];
        for (const s of systems) {
          try {
            systemState.set(s, s.create(systemCtx));
            ok.push(s);
          } catch (error) {
            report(`system '${s.id}' (create)`, error);
          }
        }
        systems = ok;
      }
      for (const s of systems) {
        try {
          s.sync?.(systemState.get(s), next, town, systemCtx);
        } catch (error) {
          report(`system '${s.id}' (sync)`, error);
        }
      }
      syncItems(next);
      town = next;
    },
    update(dt) {
      if (systemCtx) {
        for (let i = 0; i < systems.length; i++) {
          const s = systems[i]!;
          try {
            s.update(systemState.get(s), dt, signals, systemCtx);
          } catch (error) {
            report(`system '${s.id}' (update)`, error);
            systems = systems.filter((x) => x !== s);
            i--;
          }
        }
      }
      let broken = false;
      for (let i = 0; i < active.length; i++) {
        const r = active[i]!;
        try {
          r.behaviour.hooks.update(r.state, dt, signals, r.ctx);
        } catch (error) {
          report(`${r.behaviour.category} '${r.behaviour.type}' (update)`, error);
          for (const [k, v] of running) if (v === r) running.delete(k);
          broken = true;
        }
      }
      if (broken) active = [...running.values()];
    },
    dispose() {
      for (const r of running.values()) dispose(r);
      running.clear();
      active = [];
      if (systemCtx) {
        for (const s of systems) {
          try {
            s.dispose?.(systemState.get(s), systemCtx);
          } catch (error) {
            report(`system '${s.id}' (dispose)`, error);
          }
        }
      }
      systemState.clear();
      systemCtx = null;
      town = null;
    },
  };
}
