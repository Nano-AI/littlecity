// DEMO FIXTURE. A system: counts structures that appeared or changed on each sync.
import { defineSystem } from '@/life/api';

export default defineSystem({
  id: 'demo.census',
  create() {
    return { syncs: 0, changed: 0, updates: 0 };
  },
  sync(state, next, prev) {
    state.syncs++;
    for (const s of next.shape.structures.values()) {
      if (prev?.shape.structures.get(s.id)?.hash !== s.hash) state.changed++;
    }
  },
  update(state) {
    state.updates++;
  },
});
