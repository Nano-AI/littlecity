// Vocabulary added by the Dressing owner (Stage 3): the props that
// decoration (part D) and urban-fill (part U) rules place, beyond the tier-1
// list in @/core/vocab. Types only: merged into the registries by module
// augmentation (see the header of src/core/vocab.ts).
//
// Frames, unless an entry says otherwise: a prop at a floor slot stands on
// the cell's floor at the slot, +Z toward `face` if the anchor gives one,
// else toward the cell centre. Lengths are world units.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface PropVocab {
    // ── tier 1 additions to existing types ──────────────────────────────

    // D01, D02.
    'lamp.look': number; //            seed for the small differences between lamps
    'lamp.back': number; //            the lamp stands this far behind its slot (out to the corner of its cell)

    // D13: a flag flown from a pole fixed to a wall or parapet instead of a mast top.
    'flag/wall': true;
    'flag.look': number; //            seed for the device on the cloth
    'flag.back': number; //            a flagpole stands this far behind its slot (out to the corner of its cell)
    'flag.staff': number; //           length of a pennant's staff; default 0.46 (a pier's pennant flies from a taller one)

    // D24: how many clumps or heads the tuft holds, and a seed.
    'tuft.look': number;
    'boulder.size': number; //         0–1; default 0.5
    'boulder.look': number;
    'beach-find.look': number;
    'reeds.look': number;
    'lily-pads.look': number;

    // U03: a front-garden fence piece runs along one side of the garden cell, on the cell line.
    // The 'gate' variant has a gateway in the middle with the leaf ajar. How each end finishes
    // (`from` the −X end of its frame, `to` the +X end): 0 no post (another piece draws it),
    // 1 a post, 2 the run goes on into the house wall behind it.
    'garden-fence.from': number;
    'garden-fence.to': number;
    'garden-fence.look': number;
    // A flower bed. Its frame is square to the world (anchor `face` south) because it is drawn in
    // flat tones; `along` says which way a border bed runs: 0 along x, 1 along z.
    'flower-bed.look': number;
    'flower-bed.along': 0 | 1;
    'flower-bed/border': true; //      a long bed beside a walk
    'flower-bed/round': true;

    // U07: how each end of a retaining-wall piece finishes. The piece stands on the low cell's
    // edge slot and runs along the bank; `from` is its −X end, `to` its +X end:
    //   0 the wall runs straight on into the next piece
    //   1 an end pier: the bank turns away here and the next stretch has no wall
    //   2 the wall follows the terrace's rounded outer corner to meet the wall round the corner
    //   3 an inner corner: it meets the wall of the bank that turns toward the street
    // `r0`, `r1`: the terrace outline's corner radius at each end (from the terrain's own rule).
    'retaining-wall.from': number;
    'retaining-wall.to': number;
    'retaining-wall.r0': number;
    'retaining-wall.r1': number;
    'retaining-wall.look': number;
    'retaining-wall.drain': 0 | 1;
    'retaining-wall.face': number; //  the anchor's `face` (Dir4), so the creeper's flat tones come out right
  }
}
