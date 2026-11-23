// A full garbage collection on demand, for tests that prove something is let go of (a WeakRef to it
// reads undefined afterwards). Node only; no command-line flag needed.
//
//   const old = new WeakRef(plan);     // in a function of its own, so no local still holds `plan`
//   await collect();
//   expect(old.deref()).toBeUndefined();

import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

let gc: (() => void) | null = null;

/** Runs full collections. Awaited, because a WeakRef's target is held until the current job ends. */
export async function collect(): Promise<void> {
  if (!gc) {
    setFlagsFromString('--expose-gc');
    gc = runInNewContext('gc') as () => void;
  }
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    gc();
  }
}
