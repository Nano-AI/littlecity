import { describe, expect, test } from 'vitest';
import { CELL_H, chunkOf, E, key, N, S, edgeKey } from '@/core/grid';
import { positionOf, transformDir, transformPoint, translation } from '@/core/mat4';
import { resolveTown } from '@/resolve/index';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { demoParts, demoRules } from '../../tests/fixtures/demo';
import { createGeneratorRegistry, createPartRegistry, defineGenerator, defineLayer, definePart, placeFeatures } from './api';
import { validateMesh } from './checks';
import { allGenerators, allParts, collectGenerators } from './discover';
import { fallbackGenerator, fallbackPart } from './fallback';
import { anchorFrame, cellFrame, edgeFrame, faceFrame, featureFrame, slotFrame, socketFallbackFrame } from './frames';
import { createLayout } from './layout';
import { MeshBuilder, meshBounds, triangleCount } from './mesh';

const near = (a: ArrayLike<number>, b: ArrayLike<number>): void => {
  for (let i = 0; i < b.length; i++) expect(a[i]).toBeCloseTo(b[i]!, 6);
};
const terrain = flatTerrain(3);
function town(build: (b: TownBuilder) => void) {
  const b = new TownBuilder(emptyWorld(3), terrain);
  build(b);
  return resolveTown(b.world, terrain, { rules: demoRules });
}

describe('frames', () => {
  const cell = key(10, 2, 20);
  test('a face frame sits at the bottom centre of the face, +Z out, +X to the viewer\'s right', () => {
    const south = faceFrame(cell, S);
    near(positionOf(south), [10.5, 2 * CELL_H, 21]);
    near(transformDir(south, [0, 0, 1]), [0, 0, 1]);
    near(transformDir(south, [1, 0, 0]), [1, 0, 0]); // facing a south wall from the south, right is +x
    const north = faceFrame(cell, N);
    near(positionOf(north), [10.5, 2 * CELL_H, 20]);
    near(transformDir(north, [0, 0, 1]), [0, 0, -1]);
    near(transformDir(north, [1, 0, 0]), [-1, 0, 0]);
    near(transformDir(faceFrame(cell, E), [0, 0, 1]), [1, 0, 0]);
    near(transformDir(faceFrame(cell, E), [0, 1, 0]), [0, 1, 0]);
  });
  test('cell, edge and slot frames', () => {
    near(positionOf(cellFrame(cell)), [10.5, 2 * CELL_H, 20.5]);
    near(positionOf(edgeFrame(edgeKey(10, 2, 20, 'E'))), [11, 2 * CELL_H, 20.5]);
    near(positionOf(slotFrame(cell, 'ne')), [10.85, 2 * CELL_H, 20.15]);
    near(transformDir(slotFrame(cell, 'n'), [0, 0, 1]), [0, 0, 1]); // edge slots face the cell centre
    near(transformDir(slotFrame(cell, 'n', N), [0, 0, 1]), [0, 0, -1]);
    near(transformDir(slotFrame(cell, 'c'), [0, 0, 1]), [0, 0, 1]);
  });
  test('feature and socket fallbacks', () => {
    expect(featureFrame({ cell, dir: S })).toEqual(faceFrame(cell, S));
    expect(featureFrame({ cell })).toEqual(cellFrame(cell));
    expect(featureFrame({})).toBeNull();
    near(positionOf(socketFallbackFrame({ cell, dir: S })), [10.5, 2.5 * CELL_H, 21]);
    near(positionOf(socketFallbackFrame({ cell })), [10.5, 3 * CELL_H, 20.5]);
  });
  test('a line anchor starts at `from`, points +X at `to`, and reports its span', () => {
    const frames = new Map([['a', translation(1, 2, 3)], ['b', translation(1, 2, 7)]]);
    const placed = anchorFrame({ from: 'a', to: 'b' }, (id) => frames.get(id))!;
    expect(placed.span).toBeCloseTo(4, 6);
    near(positionOf(placed.frame), [1, 2, 3]);
    near(transformPoint(placed.frame, [4, 0, 0]), [1, 2, 7]);
    near(transformDir(placed.frame, [0, 1, 0]), [0, 1, 0]);
    expect(anchorFrame({ socket: 'missing' }, () => null)).toBeNull();
    expect(anchorFrame({ cell, pos: 'c' }, () => null)!.span).toBe(0);
  });
});

describe('parts', () => {
  test('definePart registers by category and type; duplicates are refused', () => {
    const p = definePart({ prop: 'boulder', build: (_item, ctx) => ({ mesh: ctx.mesh().box([0, 0, 0], [1, 1, 1]).build() }) });
    expect(p).toMatchObject({ category: 'prop', type: 'boulder' });
    const registry = createPartRegistry([p], fallbackPart);
    expect(registry.has('prop', 'boulder')).toBe(true);
    expect(registry.has('feature', 'boulder')).toBe(false);
    expect(() => createPartRegistry([p, p], fallbackPart)).toThrow(/two parts/);
  });

  test('a part gets a seeded context and its own ink namespace', () => {
    const { shape, dressing } = town((b) => b.house(10, 10).house(13, 10).house(16, 10).house(19, 10));
    const lamps = dressing.props.filter((p) => p.type === 'lamp');
    expect(lamps.length).toBeGreaterThan(0);
    const out = demoParts.prop(lamps[0]!, { plan: shape });
    expect(validateMesh(out.mesh)).toEqual([]);
    expect(out.anchors?.['lamp-head']).toBeDefined();
    expect(demoParts.prop(lamps[0]!, { plan: shape }).mesh.position).toEqual(out.mesh.position);
    const seeds: number[] = [];
    const spy = createPartRegistry(
      [definePart({ feature: 'door', build: (_i, ctx) => (seeds.push(ctx.seed, ctx.rand('a')), { mesh: ctx.mesh().build() }) })],
      fallbackPart,
    );
    for (const f of shape.features.filter((x) => x.type === 'door')) spy.feature(f, { plan: shape, structure: shape.structures.get(f.structure) });
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  test('a type with no part still draws: the placeholder marker', () => {
    const { shape, dressing } = town((b) => b.house(10, 10));
    const registry = createPartRegistry([], fallbackPart);
    expect(triangleCount(registry.feature(shape.features[0]!, { plan: shape }).mesh)).toBe(12);
    expect(triangleCount(registry.actor(dressing.actors[0]!, { plan: shape }).mesh)).toBeGreaterThan(0);
    expect(triangleCount(registry.prop({ id: 'x', type: 'laundry-line', at: { from: 'a', to: 'b' }, rule: 'r', hash: 0 }, { plan: shape, span: 2 }).mesh)).toBe(12);
  });
});

describe('generators', () => {
  test('a kind with no generator draws as placeholder boxes with its features placed', () => {
    const { shape } = town((b) => b.house(10, 10));
    const registry = createGeneratorRegistry([], [], fallbackGenerator);
    const s = [...shape.structures.values()][0]!;
    expect(registry.has('house')).toBe(false);
    const out = registry.build(s, shape, demoParts);
    expect(validateMesh(out.mesh)).toEqual([]);
    expect(meshBounds(out.mesh).min).toEqual([10, expect.closeTo(CELL_H, 6), 10]);
    // The chimney part reported where its socket is; the generator turned it into a world frame.
    const top = out.anchors[`chimney@${key(10, 1, 10)}/chimney-top`]!;
    near(positionOf(top), [10.7, CELL_H * 2 + 0.4, 10.6]);
    // The door has only the placeholder part, so its socket falls back to the cell face.
    expect(out.anchors[`door@${key(10, 1, 10)}:2/door`]).toBeUndefined();
  });

  test('a real generator replaces the placeholder for its kind only; one generator per kind', () => {
    const house = defineGenerator({
      kind: 'house',
      build(s, plan, parts) {
        const b = new MeshBuilder({ ink: s.id });
        const anchors = {};
        b.box([0, 0, 0], [1, 1, 1]);
        placeFeatures(b, anchors, s, plan, parts, (f) => (f.type === 'door' ? null : undefined));
        return { mesh: b.build(), anchors };
      },
    });
    const registry = createGeneratorRegistry([house], [], fallbackGenerator);
    expect(registry.has('house')).toBe(true);
    expect(registry.forKind('house')).toBe(house);
    expect(registry.forKind('tower')).not.toBe(house);
    expect(registry.forKind('tower')).toBe(registry.forKind('tower'));
    expect(() => createGeneratorRegistry([house, house], [], fallbackGenerator)).toThrow(/two generators/);
    const { shape } = town((b) => b.house(10, 10));
    const out = registry.build([...shape.structures.values()][0]!, shape, demoParts);
    expect(triangleCount(out.mesh)).toBe(12 + 12); // the box and the chimney; the door was skipped
  });

  test('layers are discovered beside generators and hash per chunk', () => {
    const layer = defineLayer({ layer: 'demo', build: () => ({ mesh: new MeshBuilder().build(), anchors: {} }), hash: (chunk) => chunk.cx });
    const registry = collectGenerators({ '/src/gen/demo/demo.gen.ts': { demoLayer: layer } });
    expect(registry.layers()).toEqual([layer]);
    expect(() => createGeneratorRegistry([], [layer, layer], fallbackGenerator)).toThrow(/two layers/);
  });

  test('the real registries load, and the terrain layer draws and hashes', () => {
    expect(allParts().list()).toBeInstanceOf(Array);
    const terrainLayer = allGenerators().layers().find((l) => l.layer === 'terrain')!;
    const a = town((b) => b.house(10, 10)).shape;
    const chunk = chunkOf(10, 10);
    const out = terrainLayer.build(chunk, a, allParts());
    expect(validateMesh(out.mesh)).toEqual([]);
    expect(triangleCount(out.mesh)).toBeGreaterThan(200);
    // Terrain does not depend on blocks, so an edit leaves the chunk's hash alone.
    expect(terrainLayer.hash(chunk, town((b) => b.house(11, 11)).shape)).toBe(terrainLayer.hash(chunk, a));
  });
});

describe('layout', () => {
  test('sockets resolve from generator anchors, then prop parts, then the fallback', () => {
    const { shape, dressing } = town((b) => b.house(10, 10).house(13, 10).house(16, 10).house(19, 10));
    const registry = createGeneratorRegistry([], [], fallbackGenerator);
    const anchors = {};
    for (const s of shape.structures.values()) Object.assign(anchors, registry.build(s, shape, demoParts).anchors);
    const layout = createLayout({ shape, dressing, anchors, propOutput: (p) => demoParts.prop(p, { plan: shape }) });
    const cell = key(10, 1, 10);
    // 1. From the generator (the chimney part's anchor).
    near(positionOf(layout.socket(`chimney@${cell}/chimney-top`)!), [10.7, CELL_H * 2 + 0.4, 10.6]);
    // 3. Fallback: half-way up the south face.
    near(positionOf(layout.socket(`door@${cell}:2/door`)!), [10.5, 1.5 * CELL_H, 11]);
    expect(layout.socket('nope')).toBeNull();
    // An actor on a socket takes the socket's frame.
    const smoke = dressing.actors.find((a) => a.at && 'socket' in a.at && a.at.socket === `chimney@${cell}/chimney-top`)!;
    near(positionOf(layout.item(smoke.id)!.frame), [10.7, CELL_H * 2 + 0.4, 10.6]);
    // 2. A socket owned by a prop: the prop's frame × the part's anchor.
    const head = dressing.sockets.find((s) => s.type === 'lamp-head')!;
    const lamp = dressing.props.find((p) => p.id === head.owner)!;
    const lampAt = positionOf(layout.item(lamp.id)!.frame);
    near(positionOf(layout.socket(head.id)!), [lampAt[0], lampAt[1] + 0.76, lampAt[2]]);
    expect(layout.item('nope')).toBeNull();
  });
});
