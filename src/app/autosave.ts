// Autosave (design section 15): the one saved town, written 500 ms after the
// last edit. Owner: Interface. The saving itself is the world module's
// saveTown(), which never throws; when it cannot save (private browsing, a
// full disk) the game plays on and says so once (plan Review Focus 5).

import type { World } from '@/core/world';
import { saveTown, type TownStorage } from '@/world/save';

export const AUTOSAVE_MS = 500;

export interface Autosave {
  /** Something changed: save soon. */
  schedule(): void;
  /** Save now if a save is waiting (the page is being hidden or closed). */
  flush(): void;
  /** While off, nothing is saved (a scenario, or a shared town being looked at). */
  enabled: boolean;
}

export interface AutosaveOptions {
  storage: TownStorage | null;
  world(): World;
  /** Called the first time saving fails, and never again. */
  onFail(): void;
  delay?: number;
  /** Timers, so a test can own the clock. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export function createAutosave(opts: AutosaveOptions): Autosave {
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let failed = false;

  const save = (): void => {
    timer = null;
    if (!api.enabled) return;
    if (saveTown(opts.storage, opts.world()) || failed) return;
    failed = true;
    opts.onFail();
  };

  const api: Autosave = {
    enabled: true,
    schedule() {
      if (!api.enabled) return;
      if (timer !== null) clearTimer(timer);
      timer = setTimer(save, opts.delay ?? AUTOSAVE_MS);
    },
    flush() {
      if (timer === null) return;
      clearTimer(timer);
      save();
    },
  };
  return api;
}
