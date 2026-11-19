// Vocabulary added by Monuments (Stage 2): what tower, lighthouse, arch,
// marble and pillar rules emit beyond the tier-1 list in @/core/vocab.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface FeatureVocab {
    // More tower tops (R-T02 to R-T06).
    'cap/pyramid': true; //          clock tower, campanile
    'cap/battlements': true; //      castle turret
    'cap/dome': true; //             observatory
    'cap/dovecote': true; //         cone with a little lantern on top

    // What J15 works out for one arch cell, measured along the span axis in
    // cells from the cell's low (west or north) side. An opening runs from
    // `lo` to `hi` and may reach far outside the cell (one arch over three
    // cells); a cell over a pier holds the ends of two openings.
    'arch-opening.lo': number;
    'arch-opening.hi': number;
    'arch-opening.lo2': number;
    'arch-opening.hi2': number;
    'arch-opening.spring': 0 | 1; //  1 if the opening is over the sea at level 0: it springs from the waterline
    'arch-opening.crown': 0 | 1; //   1 if the crown of the first opening lies in this cell
    'arch-opening.at': number; //     index of this cell in its run (the hump of a bridge follows it)
    'arch-opening.len': number; //    length of the run, in cells

    // Where under its cell a pier stands: absent = the centre; else the Dir4
    // of the cell side it is centred on (a pier shared by two cells).
    'pier.side': number;
    'pier.water': 0 | 1; //           1 if it stands in the sea (it gets a cutwater footing)

    // A clock on one face of a tower storey (R-T03). cell + dir. Owns socket 'clock-hands'.
    'clock-face': true;
    // Rows of dove holes on a tower storey (R-T05). cell + dir. Owns socket 'perch'.
    'dove-holes': true;
    // Narrow slot in a wall (R-T02, R-M03). cell + dir.
    'arrow-slit': true;
    // Crenellations along one exposed top edge of a marble cell (R-M03). cell + dir.
    'battlement': true;
    // A triangular gable over the short end of a temple (R-M01). cell + dir = the end it faces.
    'pediment': true;
    'pediment.width': number; //      in cells, across the end
    'pediment.offset': number; //     in cells, from this cell's centre to the gable's centre (to the viewer's right)
    'pediment.depth': number; //      in cells: how far back from this end its half of the roof runs
    // The stepped platform a temple's pillars stand on (R-M01). `cell` = a lowest cell of the temple.
    'stylobate': true;
    'stylobate.depth': number; //     in cells, from the cell's foot down to the foot of the pillars
    // Broad steps cut into one marble cell (R-M04). cell + dir = downhill. Owns socket 'seat'.
    'broad-steps': true;
    // A narrow stair down a quay face to the water (R-M05). cell + dir = toward the water.
    'quay-stair': true;
    // A portcullis in a gateway (R-M02). `cell` = the arch cell.
    'portcullis': true;
    // A covered timber gallery on an arch deck (R-A02). `cell` = the arch cell.
    'covered-gallery': true;
    'covered-gallery.color': number; // wall ramp index of the anchoring houses
    // A pinnacle on a flying buttress (R-A03). `cell` = the arch cell nearest the anchor.
    'pinnacle': true;
    // A balustrade round an open loggia deck (R-A05). `cell` = the arch cell.
    'loggia-rail': true;
  }
  interface SocketVocab {
    'statue-base': true; //  centre of a plinth top (R-M06, for D19)
    'clock-hands': true; //  centre of a clock face; +Z out (L29)
    'telescope': true; //    in an observatory's slit (R-T04)
  }
  interface TagVocab {
    'body:round': true; //       tower body shape, pinned by the tower role rules
    'body:square': true;
    'capital:flared': true; //   pillar carrying a block (J14)
    'footing:water': true; //    pillar or tower standing in the sea (J13, J14)
    'top:flush': true; //        marble top level with the ground beside it somewhere (J16)
    'top:paved': true; //        marble with a walkable top (R-M07)
    'deck:humped': true; //      stone bridge (R-A01)
    'deck:covered': true; //     sky bridge (R-A02)
    'arch:gate': true; //        gateway (R-A04)
    'arch:buttress': true; //    flying buttress (R-A03): a slim rib, not a deck
  }
}
