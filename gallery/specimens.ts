// Automatic gallery entries. Owner: Interface.
//
// The gallery shows every registered generator and part without anyone
// writing a file: for a kind, a few pieces of it laid out the ways a player
// would build them; for a part, a plain house or a patch of ground with a
// scenario-local rule that emits exactly that feature, prop or actor (the
// pattern of scenarios/examples/pipeline-demo.scenario.ts).
//
// These are stand-ins. A hand-made entry replaces one by existing: a
// scenario under scenarios/gallery/** named `gen.<kind>` or
// `part.<category>.<type>` (see gallery/README.md).
//
// Every step is tried on its own, so a specimen still shows what it can if
// the placement rules refuse one of its pieces.

import { key, S, type CellKey } from '@/core/grid';
import type { FloorKind, Kind, PlacedKind } from '@/core/kinds';
import type { ActorType, FeatureType, PropType } from '@/core/vocab';
import { defineRule, type Rule } from '@/resolve/engine/api';
import { scenario, type Scenario, type TerrainBuilder, type TownBuilder } from '@/scenario';

export type SpecimenKind = PlacedKind | FloorKind;

/** Flat ground with a bay of open water on its south side, for docks. */
function ground(t: TerrainBuilder): void {
  t.flat(1);
  t.water(18, 28, 31, 43);
}

/** Runs each step by itself: an illegal one is skipped, the rest still build. */
function steps(b: TownBuilder, ...fns: ((b: TownBuilder) => void)[]): void {
  for (const fn of fns) {
    try {
      fn(b);
    } catch {
      // The rules said no to this piece here; the specimen goes on without it.
    }
  }
}

const masses = (kind: PlacedKind) => (b: TownBuilder) =>
  steps(
    b,
    (b) => b.put(kind, 18, 22),
    (b) => b.stack(kind, 20, 22, { floors: 2 }),
    (b) => b.stack(kind, 22, 21, { floors: 2, w: 3, d: 2 }),
    (b) => b.stack(kind, 26, 21, { floors: 1, w: 2, d: 2 }),
    (b) => b.stack(kind, 26, 21, { floors: 2 }),
    (b) => b.stack(kind, 29, 22, { floors: 4 }),
  );

const columns = (kind: PlacedKind) => (b: TownBuilder) =>
  steps(
    b,
    (b) => b.put(kind, 19, 22),
    (b) => b.stack(kind, 21, 22, { floors: 2 }),
    (b) => b.stack(kind, 23, 22, { floors: 3 }),
    (b) => b.stack(kind, 25, 22, { floors: 5 }),
    (b) => b.stack(kind, 28, 22, { floors: 3 }),
    (b) => b.stack(kind, 29, 22, { floors: 3 }),
  );

const floors = (kind: FloorKind) => (b: TownBuilder) =>
  steps(
    b,
    (b) => b.floor(kind, 18, 20, 18, 25),
    (b) => b.floor(kind, 19, 25, 22, 25),
    (b) => b.floor(kind, 21, 20, 24, 22),
    (b) => b.floor(kind, 26, 21),
    (b) => b.floor(kind, 27, 23, 29, 25),
    (b) => b.floor(kind, 28, 20, 29, 21),
  );

const edges = (kind: 'fence' | 'wall') => (b: TownBuilder) =>
  steps(
    b,
    // A run of cell pieces with a corner, a single post, and a yard closed by edge pieces.
    (b) => b.put(kind, 18, 21),
    (b) => b.put(kind, 19, 21),
    (b) => b.put(kind, 20, 21),
    (b) => b.put(kind, 21, 21),
    (b) => b.put(kind, 21, 22),
    (b) => b.put(kind, 21, 23),
    (b) => b.put(kind, 18, 25),
    (b) => b.garden(24, 21, 26, 23),
    (b) => b.fenceAround(24, 21, 26, 23, kind),
    (b) => b.fenceEdge(28, 21, 'E', kind),
    (b) => b.fenceEdge(28, 22, 'E', kind),
    (b) => b.fenceEdge(28, 23, 'E', kind),
  );

const BUILDS: Partial<Record<SpecimenKind, (b: TownBuilder) => void>> = {
  auto: (b) =>
    steps(
      b,
      // What Auto becomes by itself: a house, a tower (three in a free run), a bridge between two masses, a dock on water.
      (b) => b.auto(18, 22),
      (b) => b.auto(20, 22, { floors: 3 }),
      (b) => b.stack('marble', 23, 22, { floors: 2 }),
      (b) => b.stack('marble', 27, 22, { floors: 2 }),
      (b) => [24, 25, 26].forEach((x) => b.block('auto', x, 2, 22)),
      (b) => b.block('auto', 22, 0, 28),
      (b) => b.block('auto', 23, 0, 28),
      (b) => b.auto(29, 23, { floors: 5 }),
    ),
  house: masses('house'),
  marble: masses('marble'),
  tower: columns('tower'),
  lighthouse: columns('lighthouse'),
  pillar: columns('pillar'),
  windmill: columns('windmill'),
  arch: (b) =>
    steps(
      b,
      // A gateway on the ground, an arcade, and a bridge between two masses.
      (b) => b.put('arch', 18, 22),
      (b) => [20, 21, 22].forEach((x) => b.put('arch', x, 25)),
      (b) => b.stack('marble', 21, 21, { floors: 2 }),
      (b) => b.stack('marble', 25, 21, { floors: 2 }),
      (b) => [22, 23, 24].forEach((x) => b.block('arch', x, 2, 21)),
      (b) => b.stack('house', 27, 23, { floors: 3 }),
      (b) => b.stack('house', 30, 23, { floors: 3 }),
      (b) => [28, 29].forEach((x) => b.block('arch', x, 3, 23)),
    ),
  dock: (b) =>
    steps(
      b,
      (b) => [19, 20, 21].forEach((x) => [28, 29].forEach((z) => b.block('dock', x, 0, z))),
      (b) => [28, 29, 30, 31].forEach((z) => b.block('dock', 25, 0, z)),
      (b) => b.block('dock', 28, 0, 28),
      (b) => b.house(20, 26),
    ),
  stairs: (b) =>
    steps(
      b,
      (b) => b.stack('marble', 21, 21, { floors: 1, w: 2, d: 2 }),
      (b) => b.block('stairs', 20, 1, 22, { rot: 1 }),
      (b) => b.block('stairs', 21, 1, 23, { rot: 0 }),
      (b) => b.block('stairs', 22, 1, 23, { rot: 0 }),
      (b) => b.block('stairs', 26, 1, 22, { rot: 2 }),
      (b) => b.house(27, 20, { floors: 1, w: 2 }),
    ),
  tree: (b) => steps(b, ...[[18, 21], [20, 23], [21, 21], [23, 22], [24, 24], [26, 21], [27, 23], [29, 22]].map(([x, z]) => (b: TownBuilder) => b.put('tree', x!, z!))),
  fountain: (b) =>
    steps(
      b,
      (b) => b.put('fountain', 19, 22),
      (b) => b.plaza(23, 21, 25, 23),
      (b) => b.put('fountain', 24, 22),
      (b) => b.garden(28, 21, 29, 23),
      (b) => b.put('fountain', 28, 22),
    ),
  stall: (b) =>
    steps(
      b,
      (b) => b.put('stall', 19, 22),
      (b) => b.plaza(22, 21, 27, 23),
      (b) => [22, 24, 26].forEach((x) => b.put('stall', x, 21)),
      (b) => b.put('stall', 23, 23),
    ),
  fence: edges('fence'),
  wall: edges('wall'),
  path: floors('path'),
  plaza: floors('plaza'),
  garden: floors('garden'),
  field: floors('field'),
};

/** A few pieces of one kind, laid out the ways a player would build them. */
export function generatorSpecimen(kind: SpecimenKind): Scenario {
  const build = BUILDS[kind] ?? masses(kind as Kind);
  return scenario({
    name: `gen.${kind}.auto`,
    seed: 20,
    about: `Automatic specimen: ${kind} pieces as a player would place them.`,
    terrain: ground,
    build,
  });
}

/** An empty generated island, for layers (terrain, sea, supports). */
export function layerSpecimen(layer: string, seed = 3): Scenario {
  return scenario({
    name: `layer.${layer}.auto`,
    seed,
    about: `Automatic specimen: the '${layer}' layer on a generated island.`,
    terrain: 'generated',
    terrainGen: 1, // pinned: this island must not move when generator 2 is tuned
    startingTrees: true,
    build() {},
    cameras: [{ name: 'island', yaw: 45, pitch: 35, zoom: 1.5, target: [24, 1, 24] }],
  });
}

const HOUSES: readonly (readonly [number, number])[] = [
  [20, 22],
  [23, 22],
  [26, 22],
];

/** The rule a part specimen runs: it emits exactly the item under review, whatever the real rules decide. */
function specimenRule(category: 'feature' | 'prop' | 'actor', type: string): Rule {
  if (category === 'feature') {
    return defineRule({
      id: 'X-G01.gallery-feature',
      part: 'joinery',
      tier: 1,
      priority: -2000,
      about: `gallery: a '${type}' feature on each specimen house`,
      find: ({ facts }) =>
        HOUSES.map(([x, z], i) => ({ anchor: key(x, 1, z), structure: facts.structureAt.get(key(x, 1, z)), key: i })).filter((c) => c.structure !== undefined),
      apply(c, out) {
        const top: CellKey = c.anchor + (1 << 12);
        const structure = c.structure!;
        const feature = type as FeatureType;
        // On a wall of the ground floor, on a wall upstairs, and on the roof cell with no side.
        if (c.key === 0) out.feature({ type: feature, structure, cell: c.anchor, dir: S });
        else if (c.key === 1) out.feature({ type: feature, structure, cell: top, dir: S });
        else out.feature({ type: feature, structure, cell: top });
      },
    });
  }
  const spots: CellKey[] = [key(21, 1, 24), key(24, 1, 24), key(27, 1, 24)];
  if (category === 'prop') {
    return defineRule({
      id: 'X-G02.gallery-prop',
      part: 'decoration',
      tier: 1,
      priority: -2000,
      about: `gallery: a '${type}' prop on open ground`,
      find: () => spots.map((anchor, i) => ({ anchor, key: i })),
      apply(c, out) {
        out.prop({ type: type as PropType, at: { cell: c.anchor, pos: c.key === 1 ? 'c' : c.key === 0 ? 'w' : 'n', face: S } });
      },
    });
  }
  return defineRule({
    id: 'X-G03.gallery-actor',
    part: 'life',
    tier: 1,
    priority: -2000,
    about: `gallery: a '${type}' actor on open ground`,
    find: () => spots.map((anchor, i) => ({ anchor, key: i })),
    apply(c, out) {
      out.actor({ type: type as ActorType, at: { cell: c.anchor, pos: 'c' } });
    },
  });
}

/** Three plain two-storey houses and open ground, with one rule that emits the part. */
export function partSpecimen(category: 'feature' | 'prop' | 'actor', type: string): Scenario {
  return scenario({
    name: `part.${category}.${type}.auto`,
    seed: 21,
    about: `Automatic specimen: the '${type}' ${category} emitted by a gallery rule (walls, an upper storey, a roof cell; or three spots of open ground).`,
    rules: [specimenRule(category, type)],
    build: (b) =>
      steps(
        b,
        ...HOUSES.map(([x, z], i) => (b: TownBuilder) => b.house(x, z, { floors: 2, color: i })),
        (b) => b.path(19, 25, 28, 25),
      ),
    cameras: [
      { name: 'front', yaw: 20, pitch: 28, zoom: 4.2, target: [23.5, 1.5, 23] },
      { name: 'side', yaw: 70, pitch: 35, zoom: 4.2, target: [23.5, 1.5, 23] },
    ],
  });
}
