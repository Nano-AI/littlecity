// The raid, seen from afar: raiders (ashore and at sea) are drawn bigger the further off the camera is, as
// thrown bodies are (mischief/thrower.ts `farScale`, up to 2.9 from the whole island), at a little under
// half that growth: from the town view the band reads as figures with horns and shields, not a dark smudge.

export function raiderScale(): number {
  // Raiders are drawn at their own size at every zoom, the same size as the townspeople (Derek,
  // 2026-11-21: "they're bigger than the villagers, and I don't like that"). They used to grow up to
  // 1.8 times from afar; do not bring that back.
  return 1;
}
