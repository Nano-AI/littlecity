// Vocabulary added by discovery round 1, structures half (roles and how
// buildings are drawn): docs/swarm/discovery/round-1.md, FX-01 … RC-21.
// Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface RoleVocab {
    // houses (R-H16 …)
    'barn': 'house'; //          R-H18: a long low building by the fields
    // marble (R-M08 …)
    'podium': 'marble'; //       R-M08: carries a temple, a stair or a forum: no battlements
    'theatre': 'marble'; //      R-M09: tiers of seats facing a stage
  }
  interface FeatureVocab {
    // J30 trade fronts, on house walls (cell + dir; the generator puts them on the wall plane).
    'barn-doors': true; //       R-H18: big boarded doors swung open either side of the main door
    'hayloft': true; //          R-H18: a hayloft door and hoist beam, centred in a gable end
  }
  interface TagVocab {
    'barn': true; //             R-H18: weatherboarded timber walls, no chimney, barn doors (J30)
    'farmstead': true; //        R-H18: a farmhouse within 4: a yard with hay and a cart
    'watch:pyramid': true; //    R-T07 (FX-10): a crowded watchtower: square, under a tiled pyramid
    'watch:crenel': true; //     R-T07 (FX-10): a crowded watchtower: a square tower house, crenellated
  }
  interface PropVocab {
    // The loose things that belong to the new buildings (R-H98.structure-props), at a floor slot,
    // +Z as the rule faced them.
    'structure-prop': true;
    'structure-prop/backdrop': true; //  theatre: a painted backdrop with two masks; +Z toward the seats
    'structure-prop/brazier': true; //   theatre: a fire in an iron bowl (glows at dusk and night)
    'structure-prop/hay': true; //       barn: a stack of hay bales by the big doors
  }
}
