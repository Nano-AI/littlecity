// Where the door-leaf behaviour finds the crowd's door table (L36): the
// people system publishes its crowd's table for its stage. No table (no
// people system, a test stage) means every door stays shut.

import type { DoorTable } from '../people/doors';
import type { LifeStage } from '../api';

const byStage = new WeakMap<LifeStage, DoorTable>();

export function doorTableOf(stage: LifeStage): DoorTable | null {
  return byStage.get(stage) ?? null;
}

export function setDoorTable(stage: LifeStage, table: DoorTable | null): void {
  if (table) byStage.set(stage, table);
  else byStage.delete(stage);
}
