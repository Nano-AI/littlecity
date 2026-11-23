// Rebuilding a few structures a frame (mischief): a fire or a mend changes a
// couple of hundred buildings at once, and drawing them all in the edit's
// frame stalls it. The view builds what fits in a budget and keeps the old
// drawing of the rest until a later frame gets to them.

/** Milliseconds of deferred rebuilding a frame may spend. */
export const REBUILD_BUDGET_MS = 6;

/**
 * The queue a spread rebuild works through, oldest first: what was already waiting keeps its place,
 * new changes join at the back, and what no longer needs a rebuild (not in `changed`) leaves.
 */
export function oldestFirst<T>(waiting: Iterable<T>, changed: readonly T[]): T[] {
  const live = new Set(changed);
  return [...new Set([...waiting, ...changed])].filter((id) => live.has(id));
}

/** The same keys in the same order: a structure's cells or edges, so only one that stayed put may wait. */
export const sameKeys = (a: readonly number[], b: readonly number[]): boolean => a === b || (a.length === b.length && a.every((v, i) => v === b[i]));

/** The same anchor frames, number for number: a rebuild that moves one moves the props on it too. */
export function sameAnchors(a: Readonly<Record<string, ArrayLike<number>>>, b: Readonly<Record<string, ArrayLike<number>>>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const k of keys) {
    const m = a[k]!, n = b[k];
    if (!n || n.length !== m.length) return false;
    for (let i = 0; i < m.length; i++) if (m[i] !== n[i]) return false;
  }
  return true;
}

/** Builds `ids` in order until `budgetMs` is spent (the first always goes); returns the ones left, in order. */
export function buildWithin<T>(ids: readonly T[], build: (id: T) => void, budgetMs: number, clock: () => number = () => performance.now()): T[] {
  const start = clock();
  for (let i = 0; i < ids.length; i++) {
    build(ids[i]!);
    if (clock() - start >= budgetMs) return ids.slice(i + 1);
  }
  return [];
}
