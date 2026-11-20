// D11 doormats in the dense towns. A mat lying in the plane of a path (its top was at the path's height),
// sunk under a plaza or a garden, or under the swing of an outward-opening leaf, flickers and scribbles
// as the camera moves or is simply wrong. Every doormat must:
//   - lie wholly on one surface (the same face under all its corners and its middle), facing up;
//   - stand at least 0.003 over it;
//   - have nothing else (no other prop, no structure) through it;
//   - be clear of the door leaf's swept area when it lies on the doorstep's own level.

import { describe, expect, test } from 'vitest';
import { transformPoint, type Vec3 } from '@/core/mat4';
import { MeshBuilder } from '@/gen/mesh';
import { hingesOf } from '@/parts/openings/door-leaf';
import { buildTown, column, doorsteps } from '@/render/testing/doorsteps';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';

const TOWNS = ['everything', 'grown-town-1', 'grown-town-2', 'grown-town-3', 'grown-town-4', 'grown-town-5', 'grown-town-6', 'grown-town-7', 'dressing-town', 'people-town', 'monuments-vertical', 'village-green-and-harbour'];
const LEAF = ['plain', 'shop', 'double'] as const;

describe('D11 doormats lie on one surface, a hair over it, clear of the leaf and of everything else', () => {
  for (const name of TOWNS) {
    test(name, { timeout: 240_000 }, () => {
      const scn = findScenario(name)!;
      const built = buildScenario(scn);
      const opts = scenarioResolveOptions(scn);
      const shape = resolveShape(built.world, built.terrain, opts);
      const town = buildTown(shape, resolveDressing(shape, opts));
      const problems: string[] = [];
      let mats = 0;
      for (const d of doorsteps(town)) {
        if (!d.params.mat) continue;
        mats++;
        const ink = new MeshBuilder({ ink: d.id }).inkOf('mat');
        const mesh = town.meshes.find((m) => m.who === `prop doorstep#${d.id}`)!.mesh;
        // The mat's corners, from its own triangles.
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, bottom = Infinity, top = -Infinity;
        for (let v = 0; v < mesh.inkId.length; v++) {
          if (mesh.inkId[v] !== ink) continue;
          const x = mesh.position[v * 3]!, y = mesh.position[v * 3 + 1]!, z = mesh.position[v * 3 + 2]!;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
          bottom = Math.min(bottom, y); top = Math.max(top, y);
        }
        const where = `${d.id} at ${d.at.map((v) => v.toFixed(2)).join(', ')}`;
        if (!Number.isFinite(top)) {
          problems.push(`${where}: no mat drawn`);
          continue;
        }
        const e = 0.004;
        const samples: [number, number][] = [[x0 + e, z0 + e], [x1 - e, z0 + e], [x0 + e, z1 - e], [x1 - e, z1 - e], [(x0 + x1) / 2, (z0 + z1) / 2]];
        const under = new Set<string>();
        for (const [x, z] of samples) {
          const hits = column(town, x, z).filter((h) => !(h.who === `prop doorstep#${d.id}` && h.ink === ink));
          // Anything through the mat (or lying on it): another prop, a structure. People (actors) may stand on it.
          const through = hits.filter((h) => h.y > bottom - 0.003 && h.y < top + 0.03 && !h.who.startsWith('actor '));
          if (through.length) problems.push(`${where}: ${through[0]!.who} through the mat at y ${through[0]!.y.toFixed(3)}`);
          const surface = hits.find((h) => h.y <= bottom - 0.003 && h.n[1] > 0.9);
          if (!surface) {
            problems.push(`${where}: nothing under the mat at (${x.toFixed(2)}, ${z.toFixed(2)})`);
            continue;
          }
          under.add(`${surface.who}|${surface.y.toFixed(3)}`);
        }
        if (under.size > 1) problems.push(`${where}: lies on more than one surface: ${[...under].join('; ')}`);
        // Clear of the leaf's sweep: on the doorstep's own level (no stoop steps down), every corner farther
        // from each hinge than the leaf is wide. The hinges are in the door's wall frame.
        if (!d.params.steps) {
          const leaf = LEAF[Math.min(2, d.params.door ?? 0)]!;
          const wallToSocket = 0.37; // the socket stands 0.2 beyond the stoop (0.17)
          const xOff = leaf === 'shop' ? -0.26 : 0;
          for (const h of hingesOf(leaf)) {
            const hingeWorld: Vec3 = transformPoint(d.frame, [h.hinge - xOff, 0, h.z - wallToSocket]);
            for (const [x, z] of samples) {
              if (Math.hypot(x - hingeWorld[0], z - hingeWorld[2]) < h.width) problems.push(`${where}: under the swing of the leaf`);
            }
          }
        }
      }
      expect(mats, `${name} has doormats`).toBeGreaterThan(0);
      expect(problems).toEqual([]);
    });
  }
});
