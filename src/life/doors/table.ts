// What the people system and the things that live beside it share, per
// stage: the crowd's door table (L29: the door-leaf behaviour draws what it
// says; no table means every door stays shut), the crowd itself (the rider
// walks its horse through it, L37), and the bodies residents give way to
// (the garrison's column and the horse, L36 and L37).

import type { Crowd } from '../people/crowd';
import type { DoorTable } from '../people/doors';
import type { LifeStage } from '../api';

const doors = new WeakMap<LifeStage, DoorTable>();
const crowds = new WeakMap<LifeStage, Crowd>();
const bodies = new WeakMap<LifeStage, () => readonly Obstacle[]>();

/** Something residents wait for rather than walk into: a soldier, a horse. */
export interface Obstacle {
  x: number;
  y: number;
  z: number;
}

export function doorTableOf(stage: LifeStage): DoorTable | null {
  return doors.get(stage) ?? null;
}
export function setDoorTable(stage: LifeStage, table: DoorTable | null): void {
  if (table) doors.set(stage, table);
  else doors.delete(stage);
}

export function crowdOf(stage: LifeStage): Crowd | null {
  return crowds.get(stage) ?? null;
}
export function setCrowd(stage: LifeStage, crowd: Crowd | null): void {
  if (crowd) crowds.set(stage, crowd);
  else crowds.delete(stage);
}

export function obstaclesOf(stage: LifeStage): readonly Obstacle[] {
  return bodies.get(stage)?.() ?? [];
}
export function setObstacles(stage: LifeStage, list: (() => readonly Obstacle[]) | null): void {
  if (list) bodies.set(stage, list);
  else bodies.delete(stage);
}
