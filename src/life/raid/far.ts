// The raid, seen from afar: raiders (ashore and at sea) are drawn bigger the further off the camera is, as
// thrown bodies are (mischief/thrower.ts `farScale`, up to 2.9 from the whole island), at a little under
// half that growth: from the town view the band reads as figures with horns and shields, not a dark smudge.

import { farScale } from '../mischief/thrower';

export function raiderScale(): number {
  return 1 + (farScale() - 1) * 0.42;
}
