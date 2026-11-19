// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// Shared by every registry's discovery: pull the branded exports out of an
// `import.meta.glob(..., { eager: true })` result, in a stable order.

/** Every export of every module that passes `is`, with the file it came from. Sorted by file, then export name. */
export function collectExports<T>(
  modules: Record<string, unknown>,
  is: (x: unknown) => x is T,
): { item: T; file: string }[] {
  const out: { item: T; file: string }[] = [];
  for (const file of Object.keys(modules).sort()) {
    const mod = modules[file];
    if (!mod || typeof mod !== 'object') continue;
    for (const name of Object.keys(mod).sort()) {
      const value = (mod as Record<string, unknown>)[name];
      if (is(value)) out.push({ item: value, file });
    }
  }
  return out;
}
