// Street ends with a view: the dead ends that get a bench looking out over
// water or a drop (D03). A fact because D01, which runs first, must leave
// the end of the street to the bench and stand its lamp to one side.
//
// A dead end has a view when the ground straight ahead of its last cell is
// open water or lies a level or more below, and it is not one end of a ford
// (the fords fact: the way on across the stream). DRESSING.benchView of them get
// the bench; the roll is seeded by the cell alone.

import { DIR4, keyX, keyY, keyZ, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineFact } from '@/resolve/facts/api';
import { edgeBetween } from '@/resolve/facts/lib';
import { streets } from '@/resolve/facts/streets.fact';
import { DRESSING } from '@/style/dressing';
import { fords } from '../urban/fords.fact';
import { heightAt, lucky, onGround } from './lib';

export interface StreetEnds {
  /** Dead-end cell → the way its bench looks. */
  views: ReadonlyMap<CellKey, Dir4>;
}

export const streetEnds = defineFact<StreetEnds>('streetEnds', (f) => {
  const views = new Map<CellKey, Dir4>();
  // The two ends of a ford (U22) are the way across, not a view.
  const fordEnds = fords(f).ends;
  for (const street of streets(f).list) {
    if (street.length < 2) continue;
    for (const end of street.deadEnds) {
      const links = street.links.get(end) ?? [];
      if (links.length !== 1 || !onGround(f, end) || fordEnds.has(end)) continue;
      const dir = opposite(links[0]!.dir);
      const x = keyX(end) + DIR4[dir]![0], z = keyZ(end) + DIR4[dir]![1];
      const ahead = heightAt(f, x, z);
      // Water or a drop ahead, and nothing built in the way (a dock, a bridge, a stair down).
      if (ahead >= keyY(end) || edgeBetween(f, end, dir)) continue;
      let built = false;
      for (let y = ahead; y <= keyY(end); y++) if (f.kinds.has(x | (z << 6) | (y << 12))) built = true;
      if (built || !lucky(f.seed, 'D03.benches', end, 'view', DRESSING.benchView)) continue;
      views.set(end, dir);
    }
  }
  return { views };
});
