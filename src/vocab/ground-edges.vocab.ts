// Vocabulary added by the Ground owner for fences, walls, railings and
// stairs (R-E01, R-E02, J18, J19, J20). Types only.

import '@/core/vocab';

declare module '@/core/vocab' {
  interface FeatureVocab {
    // How one end of an EDGE piece of a fence or wall run finishes (J20). `edge` = the edge
    // piece; `run-end.end` = which of its two ends: 0 the north or west one, 1 the south or
    // east one. Only emitted where the answer is not "a post": the generator of an edge-only
    // run cannot see what stands beyond its ends.
    'run-end': true;
    'run-end/butt': true; //        runs into a structure or a cliff: no post, the run goes into it
    'run-end.end': 0 | 1;

    // How each end of an edge railing (J19) finishes, so neighbours meet with one post and no
    // gap. `from` is the −X end of its face frame, `to` the +X end:
    //   0 nothing (the neighbour draws the post)   1 a post on the line
    //   2 outer corner, with the corner post       3 outer corner, no post
    //   4 inner corner, with the corner post       5 inner corner, no post
    //   6 a joint in a straight line: a post in the styles that hang from posts (rope, iron,
    //     balustrade), nothing in a picket fence
    // Default 1 at both ends.
    'railing.from': number;
    'railing.to': number;

    // A stairs cell that starts with a landing: a deep first tread, with newel posts on its
    // open sides (J18). `cell` = the stairs cell.
    'stair-landing': true;
  }
}
