// The festival's lights never show out of season (the owner's bug: "new houses you place down get
// Christmas lights even if it's not Christmas"). The pop-in after an edit (feedback F05) showed every
// new prop, festival lights included; now neither it nor anything else can.

import { describe, expect, test } from 'vitest';
import { resolveTown } from '@/resolve/index';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import feedback from '../feedback/feedback.system';
import fxSystem from '../fx/fx.system';
import { createLife } from '../runtime';
import { holdYear, seasonAt, type Season } from '../season';
import { createSignals } from '../signals';
import { recordingStage, step } from '../testing/stage';
import festival, { FESTIVAL_TYPES } from './festival.system';

const terrain = flatTerrain(7);
type Build = (b: TownBuilder) => void;
const town = (build: Build) => {
  const b = new TownBuilder(emptyWorld(7), terrain);
  build(b);
  return resolveTown(b.world, terrain);
};
/** A street with houses on both sides, and `extra` single houses placed one click at a time beyond it. */
const row = (n: number, extra = 0): Build => (b) => {
  b.path(8, 10, 8 + n * 2, 10);
  for (let i = 0; i < n; i++) b.house(8 + i * 2, 9, { w: 2, floors: 2 }).house(8 + i * 2, 11, { w: 2, floors: 2 });
  for (let i = 0; i < extra; i++) b.house(8 + i * 2, 14);
};

function setup(season: Season | 'festival', first: Build) {
  const t = town(first);
  const rec = recordingStage(t);
  const signals = createSignals(7);
  signals.holdSeason(season);
  const life = createLife(rec.stage, signals, { behaviours: [], systems: [fxSystem, feedback, festival] });
  life.sync(t);
  /** An edit as the app makes it: the shape at once, the dressing a frame later. */
  const edit = (build: Build) => {
    const next = town(build);
    rec.setTown(next.shape, null);
    life.sync({ shape: next.shape, dressing: null });
    step(life, signals, 1 / 60);
    rec.setTown(next.shape, next.dressing);
    life.sync(next);
    return next;
  };
  return { rec, signals, life, edit, first: t };
}

const festive = (t: ReturnType<typeof town>) => t.dressing.props.filter((p) => FESTIVAL_TYPES.has(p.type));

describe('festival lights stay down out of season', () => {
  test.each(['spring', 'summer', 'autumn', 'winter'] as const)('%s: placing, undoing, redoing and reloading houses never shows one', (season) => {
    expect(seasonAt(holdYear(season)).festival).toBe(0);
    const { rec, signals, life, edit } = setup(season, row(2));
    const shown = (t: ReturnType<typeof town>): string[] => {
      const out: string[] = [];
      for (const p of festive(t)) {
        const r = rec.of(p.id);
        if (r.visible) out.push(p.id);
      }
      return out;
    };
    // Place houses one click at a time (new eaves, new wreaths); watch every frame of their pop-ins.
    let grown = town(row(2));
    for (let k = 1; k <= 3; k++) {
      grown = edit(row(2, k));
      for (let f = 0; f < 120; f++) {
        step(life, signals, 1 / 60);
        expect(shown(grown), `house ${k}, frame ${f}`).toEqual([]);
      }
    }
    expect(festive(grown).length).toBeGreaterThan(festive(town(row(2))).length);
    // Undo, redo.
    const back = edit(row(2, 2));
    step(life, signals, 3);
    expect(shown(back)).toEqual([]);
    const again = edit(row(2, 3));
    step(life, signals, 3);
    expect(shown(again)).toEqual([]);
    // A loaded save: a fresh life on the whole town.
    const loaded = setup(season, row(6));
    step(loaded.life, loaded.signals, 3);
    expect(festive(loaded.first).filter((p) => loaded.rec.of(p.id).visible)).toEqual([]);
  });

  test('in the festival, new houses get their lights (after their turn), and they come down when it ends', () => {
    const { rec, signals, life, edit } = setup('festival', row(2));
    step(life, signals, 2);
    const grown = edit(row(2, 1));
    step(life, signals, 3);
    expect(festive(grown).every((p) => rec.of(p.id).visible)).toBe(true);
    // Spring: down, all of them.
    signals.holdSeason('spring');
    step(life, signals, 3);
    expect(festive(grown).filter((p) => rec.of(p.id).visible)).toEqual([]);
  });
});
