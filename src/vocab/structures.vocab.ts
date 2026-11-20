// Vocabulary added by discovery round 1, structures half (roles and how
// buildings are drawn): docs/swarm/discovery/round-1.md, FX-01 … RC-21.
// Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface RoleVocab {
    // houses (R-H16 …)
    'schoolhouse': 'house'; //   R-H21: one house per town of 10+: a bell cupola and a yard to play in
    'bridge-shop': 'house'; //   R-H20: a house on a bridge or viaduct deck: a shop over the water
    'smithy': 'house'; //        R-H19: a one-storey house against a short tower: a forge
    'forge-chimney': 'tower'; // R-H19: the smithy's tower, a broad smoking chimney
    'warehouse': 'house'; //     R-H17: a big store on the waterfront: loading doors and a hoist
    'watermill': 'house'; //     R-H16: a house on a river bank, with a turning wheel and a weir
    'barn': 'house'; //          R-H18: a long low building by the fields
    // garden regions (R-G02)
    'churchyard': 'garden'; //   R-G02: a walled or fenced garden beside a chapel
    // marble (R-M08 …)
    'podium': 'marble'; //       R-M08: carries a temple, a stair or a forum: no battlements
    'folly-tower': 'lighthouse'; // R-L02: a Light far inland: a stone belvedere, no beam
    'bandstand': 'marble'; //    R-M11: a small temple on a green or square: a tented roof
    'stoa': 'marble'; //         R-M12: a long temple on the side of a square: one sloping roof
    'obelisk': 'marble'; //      R-M10: a free 1 × 1 marble column 3+ tall on a square
    'theatre': 'marble'; //      R-M09: tiers of seats facing a stage
  }
  interface FeatureVocab {
    // J30 trade fronts, on house walls (cell + dir; the generator puts them on the wall plane).
    'barn-doors': true; //       R-H18: big boarded doors swung open either side of the main door
    'hayloft': true; //          R-H18: a hayloft door and hoist beam, centred in a gable end
    'loading-doors': true; //    R-H17: a column of loading doors up the water side, a hoist beam over them
    'loading-doors.storeys': number; // how many storeys the column climbs (default 2)
    'cap/belvedere': true; //    R-L02: an open belvedere on a folly tower (no lantern, no beam)
    'bridge-brackets': true; //  R-H20: timber struts under a bridge shop's wall where it overhangs the drop
    'bell-cupola': true; //      R-H21: a little open bell turret on the ridge (cell = the roof cell)
    'forge-front': true; //      R-H19: an open forge front with a glowing hearth, on a ground-storey wall
    'mill-race': true; //        R-H16: the wheel's timber frame and bearing on the water side; owns 'wheel-hub'
  }
  interface SocketVocab {
    'loading-door': true; //     R-H17: the threshold of a warehouse's ground-storey loading door, +Z out
    'hoist': true; //            R-H17: the hook of a warehouse's hoist, under its beam
    'wheel-hub': true; //        R-H16: a water wheel's axle: +Z out of the wall along the axle
  }
  interface ActorVocab {
    // R-H16: an undershot water wheel at a 'wheel-hub' socket, turning about its +Z (life: water-wheel behaviour).
    'water-wheel': true;
  }
  interface TagVocab {
    'barn': true; //             R-H18: weatherboarded timber walls, no chimney, barn doors (J30)
    'farmstead': true; //        R-H18: a farmhouse within 4: a yard with hay and a cart
    'stoa:n': true; //           R-M12: the side of the stoa that faces the square
    'stoa:e': true;
    'stoa:s': true;
    'stoa:w': true;
    'obelisk:column': true; //   R-M10: drawn as a victory column with a gilt statue, not an obelisk
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
    'structure-prop/headstone': true; // churchyard: a small headstone (seeded tilt); +Z the way it faces (east)
    'structure-prop/cross': true; //     churchyard: a taller stone cross on a stepped base
    'structure-prop/yew': true; //       churchyard: a dark clipped yew
    'structure-prop/lychgate': true; //  churchyard: a roofed gate over the opening in its wall; +Z out of the yard
    'structure-prop.edge': number; //    lychgate: 1 when the opening is on the cell's edge (+Z side), 0 in the cell
    'structure-prop/anvil': true; //     smithy: an anvil on its block and a quench barrel, outside the forge
    'structure-prop/hitching': true; //  smithy: a hitching rail with a water trough
    'structure-prop/hopscotch': true; // schoolhouse: a hopscotch court chalked on the yard
    'structure-prop/crates': true; //    warehouse: crates and a barrel by the loading door
    'structure-prop/weir': true; //      watermill: a timber weir across the stream, from the bank (+Z) out
    'structure-prop.span': number; //    weir: how many water cells it crosses (default 2)
  }
}
