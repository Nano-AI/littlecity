// TEST SUPPORT (Dressing): where every doorstep (D11) stands, in the world, with everything around it
// built: the meshes of structures, layers, props and anchored actors (as coplanar-scan.ts builds them),
// so a test can ask what lies under a doormat and what it touches. Used by doors.main.ts (close views
// of doors) and by src/rules/decoration/D11.doorstep.test.ts.

import { allChunks } from '@/core/grid';
import { transformPoint, type Mat4, type Mat4Like, type Vec3 } from '@/core/mat4';
import { createLayout } from '@/gen/layout';
import { transformMesh, type MeshData } from '@/gen/mesh';
import { registriesFor } from '@/render/registries';
import type { DressingPlan, Prop, ShapePlan } from '@/resolve/index';

export interface Built {
  /** Who drew it ('house#12', 'layer terrain', 'prop doorstep#…') and its world mesh. */
  meshes: { who: string; mesh: MeshData }[];
  /** World frame of every prop. */
  frames: Map<string, Mat4>;
  props: readonly Prop[];
  /** Triangles by the 1 × 1 ground square they reach over: [mesh index, first float of the triangle]. */
  index?: Map<number, [number, number][]>;
}

const square = (x: number, z: number): number => Math.floor(x) * 1024 + Math.floor(z);

function indexOf(built: Built): Map<number, [number, number][]> {
  if (built.index) return built.index;
  const index = new Map<number, [number, number][]>();
  built.meshes.forEach(({ mesh }, m) => {
    const P = mesh.position;
    for (let i = 0; i < P.length; i += 9) {
      const x0 = Math.floor(Math.min(P[i]!, P[i + 3]!, P[i + 6]!)), x1 = Math.floor(Math.max(P[i]!, P[i + 3]!, P[i + 6]!));
      const z0 = Math.floor(Math.min(P[i + 2]!, P[i + 5]!, P[i + 8]!)), z1 = Math.floor(Math.max(P[i + 2]!, P[i + 5]!, P[i + 8]!));
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 64) continue; // the sea's or a sky's great sheets: not under a doorstep
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const k = x * 1024 + z;
          const list = index.get(k);
          if (list) list.push([m, i]);
          else index.set(k, [[m, i]]);
        }
      }
    }
  });
  return (built.index = index);
}

/** Builds every structure, layer, prop and anchored actor of a town in world space. */
export function buildTown(shape: ShapePlan, dressing: DressingPlan): Built {
  const { generators, parts } = registriesFor(shape);
  const meshes: Built['meshes'] = [];
  const anchors = new Map<string, Mat4Like>();
  const keep = (who: string, out: { mesh: MeshData; anchors: Record<string, Mat4Like> }): void => {
    for (const id in out.anchors) anchors.set(id, out.anchors[id]!);
    meshes.push({ who, mesh: out.mesh });
  };
  for (const s of shape.structures.values()) keep(`${s.kind}#${s.id}`, generators.build(s, shape, parts));
  for (const layer of generators.layers()) for (const c of allChunks()) keep(`layer ${layer.layer}`, layer.build(c, shape, parts));
  const layout = createLayout({ shape, dressing, anchors, propOutput: (p, span) => parts.prop(p, { plan: shape, span }) });
  const frames = new Map<string, Mat4>();
  for (const p of dressing.props) {
    const at = layout.item(p.id);
    if (!at) continue;
    frames.set(p.id, at.frame);
    meshes.push({ who: `prop ${p.type}#${p.id}`, mesh: transformMesh(parts.prop(p, { plan: shape, span: at.span }).mesh, at.frame) });
  }
  for (const a of dressing.actors) {
    const at = a.at === null ? null : layout.item(a.id);
    if (at) meshes.push({ who: `actor ${a.type}#${a.id}`, mesh: transformMesh(parts.actor(a, { plan: shape, span: at.span }).mesh, at.frame) });
  }
  return { meshes, frames, props: dressing.props };
}

/** A doorstep's place: the 'door' socket's world frame, its origin and the way out of the door. */
export function doorsteps(built: Built): { id: string; frame: Mat4; at: Vec3; out: Vec3; params: Record<string, number> }[] {
  return built.props
    .filter((p) => p.type === 'doorstep' && built.frames.has(p.id))
    .map((p) => {
      const frame = built.frames.get(p.id)!;
      const at = transformPoint(frame, [0, 0, 0]);
      const fwd = transformPoint(frame, [0, 0, 1]);
      return { id: p.id, frame, at, out: [fwd[0] - at[0], fwd[1] - at[1], fwd[2] - at[2]] as Vec3, params: (p.params ?? {}) as Record<string, number> };
    });
}

export interface Hit {
  who: string;
  ink: number;
  y: number;
  /** Unit normal of the face hit. */
  n: Vec3;
}

/** Every face a vertical line at (x, z) passes through, top first (both facings). */
export function column(built: Built, x: number, z: number): Hit[] {
  const hits: Hit[] = [];
  for (const [m, i] of indexOf(built).get(square(x, z)) ?? []) {
    const { who, mesh } = built.meshes[m]!;
    const P = mesh.position;
    {
      const ax = P[i]!, az = P[i + 2]!, bx = P[i + 3]!, bz = P[i + 5]!, cx = P[i + 6]!, cz = P[i + 8]!;
      if (x < Math.min(ax, bx, cx) - 1e-9 || x > Math.max(ax, bx, cx) + 1e-9 || z < Math.min(az, bz, cz) - 1e-9 || z > Math.max(az, bz, cz) + 1e-9) continue;
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
      const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
      const y = l1 * P[i + 1]! + l2 * P[i + 4]! + l3 * P[i + 7]!;
      const ux = bx - ax, uy = P[i + 4]! - P[i + 1]!, uz = bz - az, vx = cx - ax, vy = P[i + 7]! - P[i + 1]!, vz = cz - az;
      const n: Vec3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      hits.push({ who, ink: mesh.inkId[i / 3]!, y, n: [n[0] / len, n[1] / len, n[2] / len] });
    }
  }
  return hits.sort((a, b) => b.y - a.y);
}
