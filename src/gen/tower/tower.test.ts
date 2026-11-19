import { describe, expect, test } from 'vitest';
import { CELL_H, key } from '@/core/grid';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allGenerators, allParts } from '@/gen/discover';
import { MeshBuilder, meshBounds, triangleCount } from '@/gen/mesh';
import { positionOf } from '@/core/mat4';
import { town } from '@/parts/monuments/testing';

describe('tower (J13, R-T01, R-T07)', () => {
  test('a stack is one body: one plinth, one body group, a band every two storeys', () => {
    const t = town((b) => b.tower(10, 10, { floors: 5, color: 2 }));
    const s = t.at(10, 1, 10);
    expect(s.cells.length).toBe(5);
    const mesh = t.draw(s);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    const ink = new MeshBuilder({ ink: s.id });
    const groups = inkGroups(mesh);
    for (const name of ['plinth', 'body', 'band2', 'band4']) expect(groups.has(ink.inkOf(name)), name).toBe(true);
    for (const name of ['band1', 'band3', 'band5', 'footing']) expect(groups.has(ink.inkOf(name)), name).toBe(false);
    // The wall is a single strip from the plinth to the roof, however many storeys.
    expect(groups.get(ink.inkOf('body'))).toBe(18 * 2);
    expect(triangleCount(mesh)).toBeLessThan(5 * 500);
  });

  test('it stands on its cell, rises past its top storey with a roof, and leans only slightly', () => {
    const t = town((b) => b.tower(10, 10, { floors: 4, color: 1 }));
    const { min, max } = meshBounds(t.drawAt(10, 1, 10));
    expect(min[1]).toBeGreaterThan(CELL_H - 0.03);
    expect(min[1]).toBeLessThan(CELL_H + 0.03);
    expect(max[1]).toBeGreaterThan(5 * CELL_H + 0.5);
    expect(max[1]).toBeLessThan(5 * CELL_H + 1.2);
    expect(min[0]).toBeGreaterThan(10 - 0.13); // eaves reach a little past the cell, never far
    expect(max[0]).toBeLessThan(11 + 0.13);
  });

  test('watchtower: windows spiral a quarter turn per storey, the door is not under a window, the cap owns a flag mount', () => {
    const t = town((b) => b.tower(10, 10, { floors: 5 }).path(10, 11, 10, 13));
    const s = t.at(10, 1, 10);
    expect(t.plan.roles.get(s.id)?.role).toBe('watchtower');
    const features = t.plan.featuresByStructure.get(s.id)!;
    const windows = features.filter((f) => f.type === 'window');
    expect(windows.length).toBe(5);
    for (let i = 1; i < windows.length; i++) expect(windows[i]!.dir).toBe(((windows[i - 1]!.dir ?? 0) + 1) & 3);
    const door = features.find((f) => f.type === 'door')!;
    expect(door.dir).toBe(2); // toward the path
    expect(windows[0]!.dir).not.toBe(door.dir);
    const out = allGenerators().build(s, t.plan, allParts());
    const mount = t.plan.sockets.find((k) => k.type === 'flag-mount' && k.structure === s.id)!;
    const tip = positionOf(out.anchors[mount.id]!);
    expect(tip[1]).toBeGreaterThan(6 * CELL_H + 0.6); // above the roof
    expect(Math.abs(tip[0] - 10.5)).toBeLessThan(0.1);
    // Every window and the door have a frame on the wall.
    for (const w of [...windows, door]) {
      const sock = t.plan.socketsByOwner.get(w.id)![0]!;
      const p = positionOf(out.anchors[sock.id]!);
      expect(Math.hypot(p[0] - 10.5, p[2] - 10.5)).toBeGreaterThan(0.3);
      expect(Math.hypot(p[0] - 10.5, p[2] - 10.5)).toBeLessThan(0.75);
    }
  });

  test('no window or door on a side another block touches; no cap under a block', () => {
    const t = town((b) => b.tower(10, 10, { floors: 3 }).stack('marble', 11, 10, { floors: 3 }).stack('marble', 10, 11, { floors: 3 }).block('marble', 10, 4, 10));
    const s = t.at(10, 1, 10);
    const features = t.plan.featuresByStructure.get(s.id)!;
    for (const f of features) if (f.type === 'window' || f.type === 'door') expect([0, 3]).toContain(f.dir);
    expect(features.some((f) => f.type === 'cap')).toBe(false);
    const mesh = t.draw(s);
    expect(validateMesh(mesh)).toEqual([]);
    expect(meshBounds(mesh).max[1]).toBeLessThan(4 * CELL_H + 0.05); // nothing pokes into the block above
  });

  test('steeple: square body, an open belfry with a bell on the top storey, a spire', () => {
    const t = town((b) => b.house(10, 10, { w: 2 }).tower(12, 10, { floors: 4 }));
    const s = t.at(12, 1, 10);
    expect(t.plan.roles.get(s.id)?.role).toBe('steeple');
    expect(t.plan.tags.get(s.id)?.has('body:square')).toBe(true);
    const features = t.plan.featuresByStructure.get(s.id)!;
    expect(features.find((f) => f.type === 'belfry')?.cell).toBe(key(12, 4, 10));
    expect(features.find((f) => f.type === 'cap')?.variant).toBe('spire');
    const mesh = t.draw(s);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    const ink = new MeshBuilder({ ink: s.id });
    expect(inkGroups(mesh).has(ink.inkOf('bell'))).toBe(true);
    expect(meshBounds(mesh).max[1]).toBeGreaterThan(5 * CELL_H + 1.2);
    expect(triangleCount(mesh)).toBeLessThan(4 * 500);
  });

  test('the same tower is drawn the same way twice, and differently for another seed', () => {
    const a = town((b) => b.tower(10, 10, { floors: 4 })).drawAt(10, 1, 10);
    const b2 = town((b) => b.tower(10, 10, { floors: 4 })).drawAt(10, 1, 10);
    const c = town((b) => b.tower(10, 10, { floors: 4 }), { seed: 99 }).drawAt(10, 1, 10);
    expect([...a.position]).toEqual([...b2.position]);
    expect([...a.position]).not.toEqual([...c.position]);
  });
});

describe('lighthouse (R-L01)', () => {
  test('bands per storey, a lantern stage on the top storey, inside its cells', () => {
    const t = town((b) => b.stack('lighthouse', 10, 10, { floors: 4 }));
    const s = t.at(10, 1, 10);
    expect(t.plan.roles.get(s.id)?.role).toBe('lighthouse');
    const out = allGenerators().build(s, t.plan, allParts());
    const mesh = out.mesh;
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    const ink = new MeshBuilder({ ink: s.id });
    const groups = inkGroups(mesh);
    for (const name of ['band0', 'band1', 'band2', 'plinth']) expect(groups.has(ink.inkOf(name)), name).toBe(true);
    expect(groups.has(ink.inkOf('band3'))).toBe(false); // the fourth storey is the lantern stage
    // Red and white alternate, red under the gallery.
    const colourOf = (name: string): number[] => {
      const id = ink.inkOf(name);
      for (let v = 0; v < mesh.inkId.length; v++) if (mesh.inkId[v] === id) return [mesh.color[v * 3]!, mesh.color[v * 3 + 1]!, mesh.color[v * 3 + 2]!];
      return [];
    };
    expect(colourOf('band2')).toEqual(colourOf('band0'));
    expect(colourOf('band1')).not.toEqual(colourOf('band0'));
    expect(colourOf('band2')[0]).toBeGreaterThan(colourOf('band2')[2]! + 60); // red
    const { min, max } = meshBounds(mesh);
    expect(max[1]).toBeLessThan(5 * CELL_H + 0.05);
    expect(max[1]).toBeGreaterThan(5 * CELL_H - 0.2);
    expect(min[0]).toBeGreaterThan(10 - 0.12); // the plinth and the door step, never more
    expect(max[0]).toBeLessThan(11 + 0.12);
    expect(triangleCount(mesh)).toBeLessThan(4 * 500);
    // The beam's socket is in the lantern room.
    const lantern = t.plan.sockets.find((k) => k.type === 'lantern' && k.structure === s.id)!;
    const p = positionOf(out.anchors[lantern.id]!);
    expect(p[1]).toBeGreaterThan(4 * CELL_H);
    expect(p[1]).toBeLessThan(5 * CELL_H);
  });

  test('six storeys or more get a second gallery half-way up', () => {
    const short = town((b) => b.stack('lighthouse', 10, 10, { floors: 5 }));
    const tall = town((b) => b.stack('lighthouse', 10, 10, { floors: 6 }));
    const galleries = (t: typeof tall): number => t.plan.featuresByStructure.get(t.at(10, 1, 10).id)!.filter((f) => f.type === 'gallery').length;
    expect(galleries(short)).toBe(1);
    expect(galleries(tall)).toBe(2);
    expect(tall.plan.tags.get(tall.at(10, 1, 10).id)?.has('second-gallery')).toBe(true);
    expect(triangleCount(tall.drawAt(10, 1, 10))).toBeGreaterThan(triangleCount(short.drawAt(10, 1, 10)));
    expect(validateMesh(tall.drawAt(10, 1, 10))).toEqual([]);
  });
});
