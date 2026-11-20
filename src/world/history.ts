// STUB (Stage 0). Owner: Logic (Stage 1). Final signatures.
//
// Undo and redo over whole worlds (worlds are immutable and share structure,
// so a stack of them is cheap). One push is one undo step: push once after a
// batch of edits (a Shift-drag run) to undo the batch together.

import type { World } from '@/core/world';

export interface History {
  readonly past: readonly World[];
  readonly present: World;
  readonly future: readonly World[];
}

/** At least 200 steps (design section 15). */
export const HISTORY_LIMIT = 200;

export function createHistory(w: World): History {
  return { past: [], present: w, future: [] };
}
/** Records a new present; clears redo. */
export function pushHistory(h: History, w: World): History {
  if (w === h.present) return h;
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, present: w, future: [] };
}
export function canUndo(h: History): boolean {
  return h.past.length > 0;
}
export function canRedo(h: History): boolean {
  return h.future.length > 0;
}
export function undo(h: History): History {
  if (!canUndo(h)) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1]!, future: [h.present, ...h.future] };
}
export function redo(h: History): History {
  if (!canRedo(h)) return h;
  return { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) };
}

/**
 * Replaces the present without a new undo step (mischief, design section
 * 13b: builders mending a ruin change the town without a click; undoing then
 * goes straight back past the damage, as if it had never happened).
 */
export function replacePresent(h: History, w: World): History {
  if (w === h.present) return h;
  return { past: h.past, present: w, future: [] };
}
