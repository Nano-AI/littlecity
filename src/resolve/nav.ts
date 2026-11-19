// STUB (Stage 0). Owner: People (Stage 3). Final signature.
//
// The walking graph (design section 13). Called by the engine after the
// decoration and urban rules and before the life rules. The stub returns an
// empty graph.

import type { DressingDraft } from './engine/api';
import { EMPTY_NAV, type NavGraph, type ShapePlan } from './plan';

export function buildNav(_shape: ShapePlan, _draft: DressingDraft): NavGraph {
  return EMPTY_NAV;
}
