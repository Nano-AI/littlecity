// Everything that lives in a town while it is nuked and mends itself (the
// owner: "when houses are destroyed, the birds that are associated with
// houses glitch out like crazy. They'll do these weird loops ... make sure mob
// behaviour is consistent even when nukes happen").
//
// A grown town, a nuke in the middle, then the shockwave's batches of damage
// (every 0.2 s), the fires, and the mend (a change every few seconds), with
// the app's own wiring and no renderer (tests/helpers/turmoil.ts). Every kind
// of thing that moves is held to: no teleports, nothing that does not add up,
// nothing pulsing in size, nothing left sitting in a wreck, no creature that
// blinks out instead of going, none moved house by a change elsewhere, and
// the soldiers not rebuilt at the start of their round by every change.
//
// What it caught: swifts and gulls jumped 1 to 6 units in a frame every 0.4 s
// while a fire burned (each re-reported fright stacked another step of height
// onto them); sparrows sat in the air where a roof had been; every cat moved
// to another house at the bang; the troop was rebuilt 355 times; a resident
// turned out of a fallen house flew across the map from its corner.

import { describe, expect, test } from 'vitest';
import { CELL_H, columnIndex } from '@/core/grid';
import { ruinedStructures } from '@/resolve/ruins';
import { ruinMending } from '@/world/damage';
import { buildScenario } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { createTurmoil, type KindStats } from '../../tests/helpers/turmoil';
import { crowdOf } from './doors/table';
import { raidsOf } from './raid/raids';
import { FULL, sized } from '../../tests/helpers/tier';

/** Seconds after the drop: the bang (about 3.5 s), the batches, the fires, and as much of the mend as the tier allows. */
const SECONDS = sized(30, 160);

/** People seen thrown (blown about by the ring) during the run: their flights are held to the same no-teleport rule as walking. */
let thrownSeen = 0;

function underFire(): Map<string, KindStats> {
  const built = buildScenario(findScenario('grown-town-1')!);
  const t = createTurmoil({ world: built.world, terrain: built.terrain });
  t.run(4);
  t.mark();
  const h = built.terrain.height[columnIndex(24, 24)]!;
  const seen = new Set<string>();
  t.onFrame = () => {
    for (const p of crowdOf(t.stage)?.people ?? []) if (p.mode === 'thrown') seen.add(p.id);
  };
  t.mischief.dropNuke([24.5, h * CELL_H, 24.5]);
  t.run(SECONDS);
  thrownSeen = seen.size;
  expect([...t.game.world.blocks.values()].some((b) => b.ruin), 'the nuke wrecked the town').toBe(true);
  return new Map(t.report().map((r) => [r.kind, r]));
}

const BIRDS = ['gull', 'pigeon', 'swift', 'small-bird/sparrow', 'small-bird/stork', 'small-bird/dove', 'small-bird/owl', 'small-bird/crow', 'small-bird/duck'];

describe('a grown town nuked and mending', () => {
  test(`${SECONDS} s: birds, cats, dogs, people and soldiers carry on sensibly`, () => {
    const stats = underFire();
    const of = (kind: string): KindStats | undefined => stats.get(kind);
    const problems: string[] = [];
    const none = (kind: string, what: keyof KindStats, most = 0): void => {
      const s = of(kind);
      if (s && (s[what] as number) > most) problems.push(`${kind}: ${what} ${s[what]} (at most ${most})`);
    };
    // Something to watch: the birds that glitched were there and flying.
    expect(of('swift')?.seen ?? 0).toBeGreaterThan(10);
    expect(of('gull')?.seen ?? 0).toBeGreaterThan(10);

    for (const kind of BIRDS) {
      none(kind, 'jumps'); // no bird moves further in a frame than a frame's flight
      none(kind, 'inRuin'); // none sits in the air where a roof was, or in the rubble
      none(kind, 'vanished'); // a bird whose home goes flies off
      none(kind, 'regrow');
    }
    for (const wing of ['gull>bird-wing/gull', 'pigeon>bird-wing/pigeon', 'swift>bird-wing/swift']) none(wing, 'jumps');
    none('small-bird/sparrow', 'moved', 2); // only the ones on the street the crater cut
    none('cat', 'vanished');
    none('cat', 'moved');
    none('cat', 'jumps');
    // The ring throws the town about (blown about, design 13b): a flight is a fast move, never a teleport, so
    // 'person' jumps stay at none with dozens of people in the air.
    expect(thrownSeen).toBeGreaterThan(20);
    none('person', 'jumps');
    none('person', 'regrow'); // the shrink-and-grow of yesterday
    none('dog', 'jumps');
    // The castle's troop and rider are kept through every change whose beat is the same.
    none('garrison>mesh', 'created');
    for (const s of stats.values()) if (s.nonFinite > 0) problems.push(`${s.kind}: ${s.nonFinite} frames not finite`);
    expect(problems).toEqual([]);
  }, FULL ? 300_000 : 60_000);

  test('a raid from the first sight of the sail to the last of it, then the mend: no teleports, nothing vanishing, nothing left', () => {
    const built = buildScenario(findScenario('grown-town-1')!);
    const t = createTurmoil({ world: built.world, terrain: built.terrain });
    t.run(4);
    t.mark();
    const raids = raidsOf(t.stage);
    expect(raids.summon({ at: null, kind: 'landing' })).toBeNull();
    const raid = raids.current!;
    let ashore = 0;
    t.onFrame = () => {
      if (raids.current) ashore = Math.max(ashore, raid.raiders.filter((r) => r.person).length);
    };
    for (let s = 0; s < 400 && raids.current; s++) t.run(1);
    t.onFrame = null;
    expect(raids.current, 'the raid ran to its end').toBeNull();
    expect(ashore).toBeGreaterThanOrEqual(8);
    expect([...t.game.world.blocks.values()].some((b) => b.ruin), 'it set the town alight').toBe(true);
    t.run(sized(20, 120));
    const stats = new Map(t.report().map((r) => [r.kind, r]));
    const problems: string[] = [];
    for (const [kind, s] of stats) {
      if (s.nonFinite > 0) problems.push(`${kind}: ${s.nonFinite} frames not finite`);
      if (kind.startsWith('raid') && s.vanished > 0) problems.push(`${kind}: ${s.vanished} vanished`);
    }
    for (const what of ['jumps', 'regrow'] as const) if ((stats.get('person')?.[what] ?? 0) > 0) problems.push(`person: ${what} ${stats.get('person')![what]}`);
    expect(problems).toEqual([]);
    expect(crowdOf(t.stage)!.people.some((p) => p.raider && p.mode !== 'gone')).toBe(false);
  }, FULL ? 400_000 : 200_000);

  test('a fire reaching a house being mended: it stays lifeless (no lights, cat or signs coming back) while it burns', () => {
    const built = buildScenario(findScenario('grown-town-1')!);
    const t = createTurmoil({ world: built.world, terrain: built.terrain });
    t.run(2);
    // A house, cracked: it goes into scaffolding on its own a few seconds later.
    const shape = t.game.shape;
    const house = [...shape.structures.values()].find((s) => s.kind === 'house' && s.cells.length >= 2)!;
    const cell = house.cells[0]!;
    t.mischief.knock(cell);
    for (let i = 0; i < 60 && !ruinMending(t.game.world.blocks.get(cell)?.ruin); i++) t.run(1);
    expect(ruinMending(t.game.world.blocks.get(cell)?.ruin)).toBe(true);
    expect(ruinedStructures(t.game.shape).has(house.id)).toBe(true);
    // Fire reaches it.
    expect(t.mischief.ignite(cell)).toBe(true);
    let lived = 0;
    for (let i = 0; i < 40; i++) {
      t.run(0.5);
      if (!ruinedStructures(t.game.shape).has(house.id)) lived++;
    }
    expect(lived).toBe(0);
  }, FULL ? 300_000 : 60_000);
});
