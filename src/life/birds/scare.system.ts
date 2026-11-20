// L16 scatter: turns the town's events into frights for the birds (scare.ts).
// A block landing frightens every bird within BIRDS.scareRadius cells; a
// person walking by, the pigeons at their feet.

import { BIRDS } from '@/style/birds';
import { defineSystem } from '../api';
import { scaresOf, type ScareTable } from './scare';

interface State {
  table: ScareTable;
  off: (() => void)[];
}

export default defineSystem<State>({
  id: 'birds.scare',
  order: -50,
  create(ctx) {
    const table = scaresOf(ctx.stage);
    const now = (): number => ctx.signals.time.seconds;
    return {
      table,
      off: [
        ctx.signals.on('blockLanded', (cell) => table.add(cell, BIRDS.scareRadius, false, now())),
        ctx.signals.on('personPassed', (cell) => table.add(cell, BIRDS.personRadius, true, now())),
      ],
    };
  },
  sync(state, next) {
    if (next.dressing) state.table.towns++;
  },
  update(state, _dt, signals) {
    state.table.expire(signals.time.seconds);
  },
  dispose(state) {
    for (const off of state.off) off();
    state.table.clear();
  },
});
