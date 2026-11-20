// The playing field (design section 7, "Field"): its court types, the
// court feature that pins where the court lies in the region, and its
// furniture. Owner: the field builder.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface RoleVocab {
    // field regions (R-G03): what a patch of field becomes, by its shape (see src/rules/roles/field.lib.ts)
    'basketball-court': 'field';
    'tennis-court': 'field';
    'football-pitch': 'field';
    'bowling-green': 'field';
    'croquet-lawn': 'field';
    'boules-court': 'field';
    'running-track': 'field';
    'kickabout-green': 'field'; // default: odd shapes and small patches
  }
  interface TagVocab {
    /** R-G03: a court beside a schoolhouse: the school's playground (children play there by day). */
    'school-playground': true;
  }
  interface FeatureVocab {
    /**
     * R-G03: where the court lies in its region: the playing rectangle in cells (x0, z0 its lowest corner,
     * w along x, d along z) and which way it runs (`along` 0 = x, 1 = z). Never drawn by a part: the field
     * generator draws the court from it, and life plays on it.
     */
    'field-court': true;
    'field-court/hard': true;
    'field-court/clay': true;
    'field-court/grass': true;
    'field-court/ice': true;
    'field-court.x0': number;
    'field-court.z0': number;
    'field-court.w': number;
    'field-court.d': number;
    'field-court.along': number;
  }
  interface PropVocab {
    // D40 (court furniture). Each stands at the centre slot of a court cell, moved off it by (dx, dz) world
    // units (the court's geometry rarely falls on a cell's middle); `face` is the way it faces.
    /** A basketball hoop on a post, the board facing the court. */
    'court-hoop': true;
    'court-hoop.dx': number;
    'court-hoop.dz': number;
    /** A tennis net across the court, `span` long, on two posts. */
    'court-net': true;
    'court-net.dx': number;
    'court-net.dz': number;
    'court-net.span': number;
    /** A football goal (posts, bar and a net behind), `span` wide. */
    'court-goal': true;
    'court-goal/small': true;
    'court-goal.dx': number;
    'court-goal.dz': number;
    'court-goal.span': number;
    /** A tennis umpire's high chair. */
    'umpire-chair': true;
    'umpire-chair.dx': number;
    'umpire-chair.dz': number;
  }
}
