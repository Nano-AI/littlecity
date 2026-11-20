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
  interface SocketVocab {
    // D06: where a bracket is fixed to a wall: half-way up a cell face, +Z out. Declared by the rule that hangs something there.
    'wall-mount': true;
  }
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

    // ── urban fill (part U) ─────────────────────────────────────────────

    // U01, U02, D03, D31. At a floor slot, +Z the way the sitters face. Owns two 'seat' sockets
    // named 'seat-0' and 'seat-1'.
    'bench': true;
    'bench/wood': true;
    'bench/stone': true;
    'bench.look': number;

    // U01: a low clipped hedge along one side of a cell, on the cell line (frame as garden-fence).
    // Ends: 0 runs on into the next piece, 1 a rounded end. The 'gap' variant has a way through.
    'hedge': true;
    'hedge/run': true;
    'hedge/gap': true;
    'hedge.from': number;
    'hedge.to': number;
    'hedge.look': number;

    // U01, U02. A shrub at a floor slot (square to the world).
    'shrub': true;
    'shrub/round': true;
    'shrub/flowering': true;
    'shrub.look': number;
    'shrub.flowers': number;

    // U02 park: one cell of a path worn into the grass. `mask` has bit d set if it runs on to side d.
    'worn-track': true;
    'worn-track.mask': number;
    'worn-track.look': number;

    // U02 walled garden: a fruit tree trained flat against a wall. Edge slot, +Z away from the wall.
    'espalier': true;
    'espalier.look': number;
    'espalier.face': number;

    // U02 paddock.
    'trough': true;
    'grazer': true; //                 a grazing animal, standing still (an animal that walks is Animation's)
    'grazer/sheep': true;
    'grazer/cow': true;
    'grazer.turn': number; //          eighths of a turn
    'grazer.look': number;

    // U08 nooks, D15.
    'goods-stack': true;
    'goods-stack/crates': true;
    'goods-stack/barrels': true;
    'goods-stack/cat': true; //        a crate with a cat asleep on it
    'goods-stack.look': number;
    'wall-fountain': true; //          edge slot against a wall, +Z out
    'cart': true;
    'cart.look': number;
    'kiosk': true;
    'kiosk.color': number;

    // U04 back yards, U06.
    'shed': true; //                   edge slot, its back to the boundary, +Z into the yard
    'shed.look': number;
    'veg-patch': true;
    'veg-patch.look': number;
    'washing-pole': true;
    'washing-pole.look': number;
    'woodpile': true; //               edge slot against a wall, +Z out
    'woodpile.look': number;

    // U05.
    'street-tree': true;
    'street-tree.look': number;

    // U06.
    'signpost': true;
    'signpost.look': number;
    'signpost.arms': number;
    'dirt-trail': true; //             one cell of a trail fraying out of a street's end; square to the world
    'dirt-trail.dir': number; //       Dir4 it runs toward
    'dirt-trail.step': number; //      which cell of the trail this is (0 = at the street), of `steps`: it narrows as it goes
    'dirt-trail.steps': number;
    'dirt-trail.look': number;

    // ── more decoration (part D) ────────────────────────────────────────

    // D04. On a line between two sockets (wall anchors or lamp heads). Flutters.
    'bunting': true;
    'bunting.look': number;
    'bunting.drop': number; //         hung this far below the line between its two ends (from lamp heads)

    // D06: a lantern on a wall bracket (at a 'wall-mount' socket on a cell face).
    'hanging-lantern/bracket': true;

    // D08. At a floor slot. Owns 'seat' sockets 'seat-0' and 'seat-1'.
    'cafe-table': true;
    'cafe-table.color': number;
    'cafe-table.look': number;

    // D10. At an edge slot of the ground cell outside the wall, +Z away from the wall.
    'creeper': true;
    'creeper.storeys': number; //      1 or 2
    'creeper.look': number;
    'creeper.face': number;

    // D11. At a 'door' socket. One prop holds everything on the doorstep.
    'doorstep': true;
    'doorstep.steps': number; //       the door's stoop steps (the wall is that much farther back)
    'doorstep.pots': 0 | 1;
    'doorstep.barrel': 0 | 1;
    'doorstep.bicycle': 0 | 1;
    'doorstep.lantern': 0 | 1; //      owns socket 'lamp-head' when 1
    'doorstep.mat': 0 | 1; //          a doormat (none where there is no flat place for it)
    'doorstep.ground': number; //      what the mat lies on: 0 ground, 1 path, 2 plaza, 3 deck or terrace, 4 marble, 5 cobbles
    'doorstep.door': number; //        0 a house door, 1 a shop door, 2 a double door (the mat's size)
    'doorstep.flowers': number;
    'doorstep.look': number;

    // D15.
    'rope-coil': true;
    'lobster-pot': true;
    'lobster-pot.look': number;
    'net-rack': true;
    'net-rack.look': number;
  }
}
