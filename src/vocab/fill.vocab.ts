// Vocabulary added by the fill builder in discovery round 1: urban fill and
// decoration (U13 onward, D35 onward). Types only: merged into the
// registries by module augmentation (see the header of src/core/vocab.ts).

import '@/core/vocab';

declare module '@/core/vocab' {
  interface SocketVocab {
    // A person stands here and does something; `name` says what ('dance', 'fetch-water', 'vend',
    // 'browse', 'hang-washing', 'pick', 'basket', 'ford'). +Z faces the work. Emitted by the fill
    // rules for the life builder (docs/swarm/requests/disc1-fill.md).
    'activity': true;
  }
  interface PropVocab {
    // U13 country lanes. A hedgerow is the hedge prop's 'wild' variant: taller, shaggy, with a few
    // flowers in it (same frame: an edge slot, +Z into the cell, the hedge on the cell line).
    'hedge/wild': true;
    'hedge.face': number; //          the anchor's face, so the wild hedge's flat tones turn with it
    // A stone milestone at the lane's edge. Frame: a floor slot, +Z toward `face` (the lane).
    'milestone': true;
    'milestone.look': number;
    // A five-bar field gate between two posts, on the cell line, shut or standing open. Frame: an
    // edge slot, +Z into the field cell (as the hedge).
    'field-gate': true;
    'field-gate.open': 0 | 1;
    'field-gate.look': number;
    // D36 wayside shrine at a country crossroads: a calvary or a roofed niche on a post, with flowers.
    // Frame: a floor slot, +Z toward `face` (the crossing).
    'wayside-shrine': true;
    'wayside-shrine/calvary': true;
    'wayside-shrine/niche': true;
    'wayside-shrine.look': number;
    // U22 ford: three stepping stones across one cell of river water, at the water cell's centre slot
    // (the river bed); +X along the crossing (face turned so).
    'stepping-stones': true;
    'stepping-stones.look': number;

    // U14 burgage plots (and U23 orchard). A small fruit tree at a floor slot, square to the world;
    // `fruit` 0 apples, 1 pears. A compost bin at an edge slot against a fence, +Z away from it.
    'fruit-tree': true;
    'fruit-tree.fruit': 0 | 1;
    'fruit-tree.look': number;
    'compost': true;
    'compost.look': number;
    // U17 drying green. A drying line: at a floor slot, posts `span` cells apart along +X; anchors
    // 'hang-washing', 'line-0', 'line-1'. A basket (washing or apples): a floor slot; anchor 'basket'.
    // A bleaching sheet: at a cell's north-west corner slot facing south (the part re-centres).
    'drying-line': true;
    'drying-line.span': number;
    'drying-line.look': number;
    'basket': true;
    'basket/washing': true;
    'basket/apples': true;
    'basket.look': number;
    'bleaching-sheet': true;
    'bleaching-sheet.look': number;

    // U15 village green. Sward: one cell of mown lawn at the centre slot, square to the world; `mask`
    // bit d set where the green runs on past side d; `stripe` 0 or 1 (the mown band). Maypole: at a
    // floor slot; anchor 'dance' at its foot. Ring bench: at a tree cell's centre slot, round the
    // trunk; sockets 'seat-0'…'seat-3'. Village sign: an edge slot, +Z toward the street.
    'sward': true;
    'sward.mask': number;
    'sward.stripe': 0 | 1;
    'sward.level': number; //          the terrain level it lies on (its grass colour and surface)
    'maypole': true;
    'maypole.look': number;
    'ring-bench': true;
    'ring-bench.look': number;
    'village-sign': true;
    'village-sign.look': number;
    // U23 belvedere garden: a potted citrus tree, a pergola with a table (sockets 'seat-0', 'seat-1');
    // floor slots, square to the world.
    'citrus-pot': true;
    'citrus-pot.look': number;
    'pergola': true;
    'pergola.look': number;

    // U16 shops in the wall. At an edge slot of the ground cell outside a blank wall, +Z away from it;
    // `inset` is how far the wall face stands behind the cell line (0 marble, 0.07 a house). The booth
    // owns anchors 'vend' and 'browse'; the niche bench 'seat-0', 'seat-1'.
    'wall-booth': true;
    'wall-booth/wine': true;
    'wall-booth/bread': true;
    'wall-booth/pots': true;
    'wall-booth/cobbler': true;
    'wall-booth/fruit': true;
    'wall-booth.inset': number;
    'wall-booth.look': number;
    'store-door': true;
    'store-door.inset': number;
    'store-door.look': number;
    'niche-bench': true;
    'niche-bench.inset': number;
    'niche-bench.look': number;
    'creeper.inset': number; //        how far the wall stands behind the cell line (default 0.07, a house)
    // A derived apron, forecourt or quay (U16, U19, U20): one cell at its NORTH-WEST corner slot, facing
    // south (the part re-centres); `mask` bit d where it runs on past side d.
    'paving': true;
    'paving/slabs': true;
    'paving/cobbles': true;
    'paving/earth': true;
    'paving.mask': number;

    // D35 guardians at the head of a grand stair: a stone lion or an urn on a plinth, at a floor slot,
    // +Z the way it looks (down the stair); `mirror` 1 for the second of a pair.
    'guardian': true;
    'guardian/lion': true;
    'guardian/urn': true;
    'guardian.mirror': 0 | 1;
    'guardian.look': number;
    // D37 market cross: at a plinth's 'statue-base' socket; anchor 'vend' on the ground in front.
    'market-cross': true;
    'market-cross.look': number;
    // D38: a rope swing from a willow's bough out over a river (the swing prop's 'rope' variant).
    'swing/rope': true;
    'swing.drop': number; //           rope: how far below the tree's foot the water is (world units)

    // U21 castle bailey. A lean-to stable (edge slot against the curtain wall, +Z out); a practice
    // dummy and an archery butt (floor slots, +Z the face); hay bales (edge slot against a wall).
    'stable': true;
    'stable.look': number;
    'practice-dummy': true;
    'practice-dummy.look': number;
    'archery-butt': true;
    'hay': true;
    'hay.look': number;
  }
}
