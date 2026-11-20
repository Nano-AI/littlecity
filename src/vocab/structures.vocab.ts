// Vocabulary added by discovery round 1, structures half (roles and how
// buildings are drawn): docs/swarm/discovery/round-1.md, FX-01 … RC-21.
// Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface RoleVocab {
    // marble (R-M08 …)
    'podium': 'marble'; //       R-M08: carries a temple, a stair or a forum: no battlements
    'theatre': 'marble'; //      R-M09: tiers of seats facing a stage
  }
  interface PropVocab {
    // The loose things that belong to the new buildings (R-H98.structure-props), at a floor slot,
    // +Z as the rule faced them.
    'structure-prop': true;
    'structure-prop/backdrop': true; //  theatre: a painted backdrop with two masks; +Z toward the seats
    'structure-prop/brazier': true; //   theatre: a fire in an iron bowl (glows at dusk and night)
  }
}
