// The stand-ins are all gone. While the Stage 3 rules did not exist, this
// file held scenario-local copies of three of them so the house scenarios
// showed finished houses: D07 (awnings and signs), D09 (flower boxes) and
// L03 (windmill sails). All three are real rules now, discovered like every
// other rule, so every scenario gets them:
//
//   src/rules/decoration/D07.shop-dressing.rule.ts
//   src/rules/decoration/D09.flower-boxes.rule.ts
//   src/rules/life/L03.sails.rule.ts
//
// `houseDressing` is kept, empty, so the scenarios that still list it in
// their `rules` keep compiling; it can be deleted together with those
// references.

import type { Rule } from '@/resolve/engine/api';

export const houseDressing: readonly Rule[] = [];
