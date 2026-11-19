// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// Style values: every tunable number and colour lives in a style module,
// src/style/<module>.ts, one file per module:
//
//   export const HOUSE = defineStyle('house', { eave: 0.12, wallBow: 0.02 },
//                                    { wallBow: [0, 0.1, 0.005] });
//
// The returned object is the live values object. Code reads `HOUSE.eave`
// directly. The gallery and dev panel list every registered style with
// allStyles() and change values with setStyle(), which bumps styleVersion()
// so renderers know cached geometry is stale. Town logic stays a pure
// function of (world, terrain, style values).

export type StyleValue = number | string | boolean | readonly number[] | readonly string[];
/** Slider range for a numeric value: [min, max, step?]. */
export type StyleRange = readonly [min: number, max: number, step?: number];

export interface StyleModule {
  name: string;
  values: Record<string, StyleValue>;
  ranges: Record<string, StyleRange | undefined>;
  defaults: Record<string, StyleValue>;
}

const registry = new Map<string, StyleModule>();
let version = 0;

export function defineStyle<T extends Record<string, StyleValue>>(
  name: string,
  values: T,
  ranges: { [K in keyof T]?: StyleRange } = {},
): T {
  const existing = registry.get(name);
  if (existing) {
    // Hot reload or a second import of the same module: keep one live object.
    return existing.values as T;
  }
  const live = { ...values };
  registry.set(name, {
    name,
    values: live,
    ranges: ranges as Record<string, StyleRange | undefined>,
    defaults: { ...values },
  });
  return live;
}

export function allStyles(): StyleModule[] {
  return [...registry.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function setStyle(name: string, key: string, value: StyleValue): void {
  const mod = registry.get(name);
  if (!mod) throw new Error(`setStyle: no style module '${name}'`);
  if (!(key in mod.values)) throw new Error(`setStyle: '${name}' has no value '${key}'`);
  mod.values[key] = value;
  version++;
}

export function resetStyles(): void {
  for (const mod of registry.values()) Object.assign(mod.values, mod.defaults);
  version++;
}

/** Increases whenever any style value changes. Fold it into geometry cache keys. */
export function styleVersion(): number {
  return version;
}
