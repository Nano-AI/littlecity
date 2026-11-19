// The parts attached to houses, and the windmill: sound meshes, the sockets
// they own, few ink groups (a window is outlined once), inside a budget.

import { describe, expect, test } from 'vitest';
import { CELL_H, key } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allGenerators, allParts } from '@/gen/discover';
import { meshBounds, PATTERN, transformMesh, triangleCount } from '@/gen/mesh';
import { resolveTown } from '@/resolve/index';
import type { Actor, Feature, Prop, ShapePlan } from '@/resolve/plan';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';

const SEED = 91;
const town = (build: (b: TownBuilder) => void): ShapePlan => {
  const terrain = flatTerrain(SEED);
  const b = new TownBuilder(emptyWorld(SEED), terrain);
  build(b);
  return resolveTown(b.world, terrain).shape;
};
const plan = town((b) => b.house(10, 10, { floors: 2, color: 2 }).stack('windmill', 14, 10, { floors: 2 }));
const house = plan.structures.get(plan.structureAt.get(key(10, 1, 10))!)!;
const feature = (type: Feature['type'], variant?: string, params?: object): Feature =>
  ({ id: `${type}@test:${variant ?? ''}`, type, structure: house.id, cell: key(10, 2, 10), dir: 2, variant, params, rule: 'test' }) as Feature;
const drawFeature = (f: Feature) => allParts().feature(f, { plan, structure: house });

describe('openings', () => {
  test('every part the house owner promises exists', () => {
    for (const type of ['window', 'door', 'chimney', 'balcony', 'finial', 'trail']) expect(allParts().has('feature', type), type).toBe(true);
    for (const type of ['awning', 'hanging-sign', 'flower-box']) expect(allParts().has('prop', type), type).toBe(true);
    expect(allParts().has('actor', 'windmill-sails')).toBe(true);
  });

  test.each(['square', 'tall', 'arched', 'shuttered', 'pointed', 'rose', 'round', 'shopfront', 'bay', 'slit'])('window/%s', (variant) => {
    const out = drawFeature(feature('window', variant));
    expect(validateMesh(out.mesh)).toEqual([]);
    expect(findDuplicateFaces(out.mesh)).toBe(0);
    expect(out.anchors?.window).toBeDefined();
    // Outlined once (a shuttered, bay or shop window has one or two more objects), and it lights up.
    expect(inkGroups(out.mesh).size).toBeLessThanOrEqual(3);
    expect(variant === 'slit' || new Set(out.mesh.pattern).has(PATTERN.glass)).toBe(true);
    expect(triangleCount(out.mesh)).toBeLessThan(160);
    // On the wall plane: nothing behind it, nothing reaching into the next cell.
    const { min, max } = meshBounds(out.mesh);
    expect(min[2]).toBeGreaterThanOrEqual(-1e-6);
    expect(max[2]).toBeLessThan(0.2);
    expect(min[0]).toBeGreaterThan(-0.45);
    expect(max[0]).toBeLessThan(0.45);
    expect(max[1]).toBeLessThan(CELL_H + 0.05);
    // The pane glass shares the frame's ink group: bars and frame read by colour.
    const glassInks = new Set<number>(), frameInks = new Set<number>();
    for (let v = 0; v < out.mesh.pattern.length; v++) (out.mesh.pattern[v] === PATTERN.glass ? glassInks : frameInks).add(out.mesh.inkId[v]!);
    for (const id of glassInks) expect(frameInks.has(id)).toBe(true);
  });

  test.each(['plain', 'double', 'shop', 'deck', 'hatch'])('door/%s', (variant) => {
    const out = drawFeature(feature('door', variant, { main: 1 }));
    expect(validateMesh(out.mesh)).toEqual([]);
    expect(findDuplicateFaces(out.mesh)).toBe(0);
    expect(out.anchors?.door).toBeDefined();
    expect(triangleCount(out.mesh)).toBeLessThan(260);
    if (variant === 'shop') {
      expect(out.anchors?.['awning-mount']).toBeDefined();
      expect(out.anchors?.['sign-bracket']).toBeDefined();
    }
  });

  test('a stoop takes the threshold down to the ground outside', () => {
    const flat = drawFeature(feature('door', 'plain'));
    const stoop = drawFeature(feature('door', 'plain', { steps: 5 }));
    expect(positionOf(flat.anchors!.door!)[1]).toBeCloseTo(0);
    expect(positionOf(stoop.anchors!.door!)[1]).toBeCloseTo(-CELL_H);
    expect(meshBounds(stoop.mesh).min[1]).toBeLessThan(-CELL_H + 0.06);
    expect(positionOf(stoop.anchors!.door!)[2]).toBeGreaterThan(positionOf(flat.anchors!.door!)[2]);
  });

  test.each(['plain', 'tall-flue', 'pipe'])('chimney/%s', (variant) => {
    const out = drawFeature(feature('chimney', variant));
    expect(validateMesh(out.mesh)).toEqual([]);
    const top = positionOf(out.anchors!['chimney-top']!)[1];
    expect(top).toBeGreaterThan(0.25);
    expect(Math.abs(top - meshBounds(out.mesh).max[1])).toBeLessThan(0.1);
    expect(meshBounds(out.mesh).min[1]).toBeLessThan(-0.2); // runs down into the roof
    expect(triangleCount(out.mesh)).toBeLessThan(120);
  });

  test('balcony, finial and trail', () => {
    const balcony = drawFeature(feature('balcony', 'iron'));
    expect(validateMesh(balcony.mesh)).toEqual([]);
    expect(balcony.anchors?.perch).toBeDefined();
    expect(inkGroups(balcony.mesh).size).toBe(2); // slab and railing: the bars are not outlined one by one
    for (const variant of ['cross', 'ball']) expect(validateMesh(drawFeature(feature('finial', variant)).mesh)).toEqual([]);
    const trail = drawFeature({ ...feature('trail'), cell: key(10, 1, 11) });
    expect(validateMesh(trail.mesh)).toEqual([]);
    expect(new Set(trail.mesh.pattern)).toEqual(new Set([PATTERN.dirt]));
    // Two trail cells of one house share an ink group, so the trail is outlined once.
    const next = drawFeature({ ...feature('trail'), id: 'trail@other', cell: key(10, 1, 12) });
    expect([...inkGroups(next.mesh).keys()]).toEqual([...inkGroups(trail.mesh).keys()]);
  });

  test('props: awning, hanging sign, flower box', () => {
    const prop = (type: Prop['type'], params?: object, variant?: string): Prop => ({ id: `${type}@test`, type, at: { socket: 'x' }, params, variant, rule: 'test', hash: 0 }) as Prop;
    const awning = allParts().prop(prop('awning', { color: 1 }, 'striped'), { plan });
    expect(validateMesh(awning.mesh)).toEqual([]);
    expect(new Set(awning.mesh.pattern)).toEqual(new Set([PATTERN.stripes]));
    expect(Math.max(...awning.mesh.sway)).toBeGreaterThan(0.3); // the free edge moves with the wind
    expect(Math.min(...awning.mesh.sway)).toBe(0); // the wall edge does not
    for (const shop of ['bakery', 'cafe', 'books', 'flowers', 'fish', 'tailor', 'cheese', 'toys']) {
      const sign = allParts().prop(prop('hanging-sign', { shop }), { plan });
      expect(validateMesh(sign.mesh), shop).toEqual([]);
      expect(inkGroups(sign.mesh).size).toBe(2);
    }
    const box = allParts().prop(prop('flower-box', { flowers: 2 }), { plan });
    expect(validateMesh(box.mesh)).toEqual([]);
    expect(inkGroups(box.mesh).size).toBe(3);
    expect(triangleCount(box.mesh)).toBeLessThan(200);
  });
});

describe('windmill', () => {
  const mill = plan.structures.get(plan.structureAt.get(key(14, 1, 10))!)!;
  // The cap is an actor that turns to the wind (L03); with no part for it the generator draws it.
  const parts = allParts();
  const still = { ...parts, has: (c: Parameters<typeof parts.has>[0], type: string) => !(c === 'actor' && type === 'mill-cap') && parts.has(c, type) };
  const out = allGenerators().build(mill, plan, still);

  test('a two-cell mill is one tapered body with a cap, inside its budget', () => {
    expect(mill.cells.length).toBe(2);
    expect(validateMesh(out.mesh)).toEqual([]);
    expect(findDuplicateFaces(out.mesh)).toBe(0);
    expect(triangleCount(out.mesh)).toBeLessThan(1200);
    const { min, max } = meshBounds(out.mesh);
    expect(min[1]).toBeCloseTo(CELL_H, 5);
    expect(max[1]).toBeGreaterThan(3 * CELL_H + 0.25);
    expect(max[1]).toBeLessThan(3 * CELL_H + 0.6);
    expect(min[0]).toBeGreaterThan(13.9);
    expect(max[0]).toBeLessThan(15.1);
  });

  test('the cap owns the hub socket, above the body, pointing out of the cap', () => {
    const hub = plan.sockets.find((s) => s.type === 'mill-hub' && s.structure === mill.id)!;
    const frame = out.anchors[hub.id]!;
    expect(frame).toBeDefined();
    const [x, y, z] = positionOf(frame);
    expect(y).toBeGreaterThan(3 * CELL_H);
    expect(Math.hypot(x - 14.5, z - 10.5)).toBeGreaterThan(0.3);
    // +Z of the frame points away from the mill's axis.
    const zx = frame[8]!, zz = frame[10]!;
    expect(zx * (x - 14.5) + zz * (z - 10.5)).toBeGreaterThan(0);
    // The door is a feature drawn by the door part, and it owns its threshold.
    expect(Object.keys(out.anchors).some((id) => id.endsWith('/door'))).toBe(true);
  });

  test('with the cap part, the cap is an actor drawn about the hub, where the baked cap was', () => {
    expect(parts.has('actor', 'mill-cap')).toBe(true);
    const bare = allGenerators().build(mill, plan, parts);
    expect(meshBounds(bare.mesh).max[1]).toBeLessThan(3 * CELL_H + 0.1); // only the curb ring above the body
    const hub = plan.sockets.find((s) => s.type === 'mill-hub' && s.structure === mill.id)!;
    const cap = parts.actor({ id: 'cap', type: 'mill-cap', at: { socket: hub.id }, home: mill.id, rule: 'test', hash: 0 } as Actor, { plan });
    expect(validateMesh(cap.mesh)).toEqual([]);
    // Carried to the hub's frame, the actor covers what the baked cap covered.
    const placed = transformMesh(cap.mesh, bare.anchors[hub.id]!);
    const a = meshBounds(placed), b = meshBounds(out.mesh);
    expect(a.max[1]).toBeCloseTo(b.max[1], 4);
  });

  test('the sails are their own part: four sails and a hub, turning about Z', () => {
    const sails = allParts().actor({ id: 'sails', type: 'windmill-sails', at: null, params: { size: 1 }, rule: 'test', hash: 0 } as Actor, { plan });
    expect(sails.animated).toBe(true);
    expect(validateMesh(sails.mesh)).toEqual([]);
    expect(inkGroups(sails.mesh).size).toBe(5);
    const { min, max } = meshBounds(sails.mesh);
    let reach = 0;
    for (let v = 0; v < sails.mesh.position.length; v += 3) reach = Math.max(reach, Math.hypot(sails.mesh.position[v]!, sails.mesh.position[v + 1]!));
    expect(reach).toBeGreaterThan(1); // the sail length, from the hub
    expect(reach).toBeLessThan(1.06);
    expect(max[2] - min[2]).toBeLessThan(0.12); // a flat wheel
    expect(triangleCount(sails.mesh)).toBeLessThan(400);
  });
});
