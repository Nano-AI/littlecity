// Foliage codes (Seasons, design section 13a). A tree marks what each part of it is in the `edge`
// attribute, which the patterns foliage uses (none, leaves, bark) never read; the surface shader's
// season code (src/render/shaders/season.ts) turns, drops and snows on them by these codes. Summer
// draws them exactly as before.
//
//   b.with({ color, pattern: PATTERN.leaves, ink: 'crown', edge: FOLIAGE.crown }, () => ...)

export const FOLIAGE = {
  /** A broadleaf's crown: turns in autumn, falls (dissolves) into bare branches for winter. */
  crown: 201,
  /** Pines, cypresses, palms, clipped bays: green all year, carry snow. */
  evergreen: 202,
  /** Fruit or blossom dotted on a crown: blossom in spring, fruit in summer, gone with the leaves. */
  fruit: 203,
  /** A willow's hanging strands: yellow in autumn, golden whips in winter. */
  strand: 204,
  /** Bushes and shrubs: a touch of autumn, dull in winter, never bare. */
  shrub: 205,
  /** The branches drawn inside a crown, hidden by it until the leaves fall. */
  branch: 206,
} as const;
