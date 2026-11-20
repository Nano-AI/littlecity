// Vocabulary added by Seasons (design section 13a): the midwinter festival's props. They are in the
// dressing all year round, placed by D35 like any decoration; the festival system (src/life/seasons/)
// shows them only while the festival is on, house by house, and lights them from dusk.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface SocketVocab {
    // D35: where a festival string hangs from: on a wall face half-way up a cell (with a dir, +Z out), or
    // the middle of a cell's top (without one, world axes).
    'festival-anchor': true;
  }
  interface PropVocab {
    // A string of small coloured bulbs.
    //   'eave'    under the eaves of a house's top storey, from a festival-anchor on top of that cell; `faces`
    //             is a bit mask of the cell's sides that get one (1 N, 2 E, 4 S, 8 W)
    //   'street'  across a street from wall to wall (a line between two line-anchor sockets)
    //   'square'  round a square, from lamp head to lamp head (a line)
    'festival-lights': true;
    'festival-lights/eave': true;
    'festival-lights/street': true;
    'festival-lights/square': true;
    'festival-lights.faces': number;
    'festival-lights.drop': number;
    'festival-lights.look': number;
    // A wreath on a front door (at the door's socket, +Z out of the wall).
    'wreath': true;
    'wreath.look': number;
    'wreath.steps': number; //   the door's stoop (door.steps): the wreath hangs on the door, up its steps
    // The big decorated tree with a star, on the town's main square (from a festival-anchor on a paving
    // cell, standing at its north-west corner between four cells: nobody's way is changed by it).
    'festival-tree': true;
    // A snowman on the main square, there only while deep snow lies (from a festival-anchor; stands at
    // the middle of that cell).
    'snowman': true;
    'snowman.look': number;
    'festival-tree.look': number;
  }
}
