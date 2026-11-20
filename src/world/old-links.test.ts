// Old links keep opening (design section 15, "Sharing"). old-links.json holds
// share codes written by the version 1 to 4 encoder before the short links,
// for grown towns of every character on both generators, with styles,
// reshaped land and damage, and empty islands; each with a digest of the
// world it must decode to. legacy-codec.ts is that old encoder, frozen, so
// any town can be written the old way and checked too.

import { describe, expect, test } from 'vitest';
import fixtures from './old-links.json';
import { legacyEncodeTown, worldDigest } from './legacy-codec';
import { decodeTown, readTownFile } from './save';

describe('links made before the short links', () => {
  test('every pinned old code decodes to exactly the world it was made from', () => {
    expect(fixtures.links.length).toBeGreaterThan(15);
    for (const f of fixtures.links) {
      const r = decodeTown(f.code);
      expect(r.ok, f.name).toBe(true);
      if (!r.ok) continue;
      expect(worldDigest(r.world), f.name).toBe(f.digest);
      expect(r.world.blocks.size, f.name).toBe(f.blocks);
      expect(f.code.slice(0, 4), f.name).toBe(['TEMB', 'TEMC', 'TEMD', 'TEME'][f.version - 1]);
      // The frozen old encoder writes it again byte for byte: the helper is the old encoder.
      expect(legacyEncodeTown(r.world), f.name).toBe(f.code);
      // As an old town file too.
      expect(readTownFile(JSON.stringify({ littleCity: f.version, town: f.code }))).toEqual(r);
    }
  });
});
