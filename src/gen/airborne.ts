// Two pattern marks for things in the air (Stage 4, life depth). Kept out of
// the frozen PATTERN list in mesh.ts: they are flags the renderer reads, not
// surface patterns.
//
//   AIRBORNE  a bit OR-ed onto any pattern: drawn exactly as that pattern,
//             but left out of the grounding picture (the height map the
//             contact and cast shade come from). Birds in flight, insects,
//             falling leaves. A thing in the air throws no smear of shade,
//             and moving it never makes the renderer redraw the grounding.
//   MIST      a soft wash: drawn translucent over the finished page by the
//             overlay pass (like PATTERN.beam), never inked, never grounded.
//             Smoke and cloud. The instance's param a is its opacity.
//
// A mesh whose every vertex is AIRBORNE, MIST or a beam is "air" to the
// renderer: its moves are free (src/render/slots.ts).

import { PATTERN, type PatternId } from './mesh';

export const AIRBORNE = 128;
export const MIST = 28 as PatternId;

/** The pattern with the AIRBORNE bit set. */
export const airborne = (pattern: PatternId): PatternId => (pattern | AIRBORNE) as PatternId;

/** True if the renderer leaves vertices with this pattern out of the grounding picture. */
export const isAirPattern = (pattern: number): boolean => pattern >= AIRBORNE || pattern === MIST || pattern === PATTERN.beam;

/** True if every vertex of the mesh is in the air (and the mesh is not empty). */
export function isAirMesh(mesh: { pattern: Uint8Array }): boolean {
  const p = mesh.pattern;
  if (p.length === 0) return false;
  for (let i = 0; i < p.length; i++) if (!isAirPattern(p[i]!)) return false;
  return true;
}
