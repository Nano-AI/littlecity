// Rebuilding a few structures a frame (mischief): a fire or a mend changes a
// couple of hundred buildings at once, and drawing them all in the edit's
// frame stalls it. The view builds what fits in a budget and keeps the old
// drawing of the rest until a later frame gets to them.

/** Milliseconds of deferred rebuilding a frame may spend. */
export const REBUILD_BUDGET_MS = 6;

/** Builds `ids` in order until `budgetMs` is spent (the first always goes); returns the ones left, in order. */
export function buildWithin<T>(ids: readonly T[], build: (id: T) => void, budgetMs: number, clock: () => number = () => performance.now()): T[] {
  const start = clock();
  for (let i = 0; i < ids.length; i++) {
    build(ids[i]!);
    if (clock() - start >= budgetMs) return ids.slice(i + 1);
  }
  return [];
}
