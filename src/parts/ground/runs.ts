// The shape of a fence or wall run (J20): its nodes and the straight
// segments between them. Shared by the fence and wall generators. Not a
// part file.
//
// A run is one structure: cell pieces (`cells`) and edge pieces (`edges`),
// all on one level. Its lines are
//
//   a cell piece   arms from the centre of its cell (cellArms, edges-lib):
//                  to neighbouring pieces, to an edge piece on one of its
//                  sides, into a structure, or to a post short of the cell's
//                  edge;
//   an edge piece  the cell boundary it stands on, corner to corner, and a
//                  little further where J20 says it runs into a structure.
//
// Nodes where the line simply carries on are dropped, so a segment is a
// maximal straight stretch and is drawn as ONE piece: no seams, no doubled
// faces inside a straight fence. What is left at a segment's two ends:
//
//   joint   a corner, a tee or a crossing: a post (or pier) stands here
//   post    a free end: an end post
//   butt    the run goes into a structure: no post
//   gate    a gate or arched opening (a `gate` feature from J20): the
//           segment stops FENCE.gateHalf short of the node
//
// Reads only what the structure hash covers: the structure's cells and
// edges, the six neighbours of each cell, side-column terrain heights, and
// the structure's own features.

import { CELL_H, DIR4, keyX, keyY, keyZ, type CellKey, type Dir4, type EdgeKey } from '@/core/grid';
import type { EdgeKind } from '@/core/kinds';
import { frame, type Mat4 } from '@/core/mat4';
import { hash } from '@/core/rand';
import type { Feature, ShapePlan, Structure } from '@/resolve/plan';
import { cellArms, edgeLine } from '@/rules/joinery/edges-lib';
import { FENCE } from '@/style/edges';
import { rngOf, type Rng } from './kit';

export type NodeKind = 'joint' | 'post' | 'butt' | 'gate';

export interface RunNode {
  x: number;
  z: number;
  kind: NodeKind;
  /** Gates: the way people walk through, and the feature. */
  passage?: Dir4;
  feature?: Feature;
}

export interface RunSegment {
  axis: 'x' | 'z';
  /** The end with the lower coordinate, then the other. */
  from: RunNode;
  to: RunNode;
  length: number;
}

export interface RunGraph {
  /** The level the run stands on, and its height in world units. */
  level: number;
  y: number;
  /** Every node that is not a plain continuation, in a fixed order. */
  nodes: RunNode[];
  segments: RunSegment[];
}

interface Draft {
  x: number;
  z: number;
  links: Draft[];
  butt: boolean;
  passage?: Dir4;
  feature?: Feature;
  node?: RunNode;
}

const Q = 1000;
const nodeKey = (x: number, z: number): number => Math.round(x * Q) * 100000 + Math.round(z * Q);

export function buildRun(s: Structure, plan: ShapePlan): RunGraph {
  const kind = s.kind as EdgeKind;
  const gateCells = new Map<CellKey, Feature>();
  const gateEdges = new Map<EdgeKey, Feature>();
  const butts = new Set<string>();
  const insets = new Map<EdgeKey, [number, number]>();
  for (const f of plan.featuresByStructure.get(s.id) ?? []) {
    if (f.type === 'gate') {
      if (f.cell !== undefined) gateCells.set(f.cell, f);
      else if (f.edge !== undefined) gateEdges.set(f.edge, f);
    } else if (f.type === 'run-end' && f.edge !== undefined) {
      butts.add(`${f.edge}:${(f.params as { end?: number } | undefined)?.end ?? 0}`);
    } else if (f.type === 'run-inset' && f.edge !== undefined) {
      // On a house roof the piece stands on the wall head: its line moves toward the roof.
      const toward = (f.params as { side?: number } | undefined)?.side === 1 ? 1 : -1;
      insets.set(f.edge, edgeLine(f.edge).axis === 'z' ? [toward * FENCE.roofInset, 0] : [0, toward * FENCE.roofInset]);
    }
  }
  // A corner moves by every distinct shift of the inset pieces that meet there, so two pieces in a
  // line stay in line and two round a corner still meet (on both axes).
  const cornerShifts = new Map<number, [number, number][]>();
  for (const [e, shift] of insets) {
    for (const p of edgeLine(e).ends) {
      const k = nodeKey(p[0], p[1]);
      const list = cornerShifts.get(k) ?? [];
      if (!list.some((q) => q[0] === shift[0] && q[1] === shift[1])) list.push(shift);
      cornerShifts.set(k, list);
    }
  }
  const moved = (e: EdgeKey, p: readonly [number, number]): [number, number] => {
    if (!insets.has(e)) return [p[0], p[1]];
    let x = p[0], z = p[1];
    for (const q of cornerShifts.get(nodeKey(p[0], p[1])) ?? []) {
      x += q[0];
      z += q[1];
    }
    return [x, z];
  };
  const drafts = new Map<number, Draft>();
  const at = (x: number, z: number): Draft => {
    const k = nodeKey(x, z);
    let d = drafts.get(k);
    if (!d) drafts.set(k, (d = { x, z, links: [], butt: false }));
    return d;
  };
  const link = (a: Draft, b: Draft): void => {
    if (a === b || a.links.includes(b)) return;
    a.links.push(b);
    b.links.push(a);
  };
  let level = 0;
  for (const c of s.cells) {
    level = keyY(c);
    const centre = at(keyX(c) + 0.5, keyZ(c) + 0.5);
    const gate = gateCells.get(c);
    if (gate) {
      centre.passage = (gate.dir ?? 0) as Dir4;
      centre.feature = gate;
    }
    for (const arm of cellArms(plan, c, kind, centre.passage)) {
      const [dx, dz] = DIR4[arm.dir]!;
      const reach = arm.kind === 'stub' ? 0.5 - FENCE.endInset : arm.kind === 'butt' ? 0.5 + FENCE.butt : 0.5;
      const end = at(centre.x + dx * reach, centre.z + dz * reach);
      if (arm.kind === 'butt') end.butt = true;
      link(centre, end);
    }
  }
  for (const e of s.edges) {
    const line = edgeLine(e);
    level = line.y;
    const p0 = moved(e, line.ends[0]), p1 = moved(e, line.ends[1]);
    const a = at(p0[0], p0[1]), b = at(p1[0], p1[1]);
    const mid = at((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
    const gate = gateEdges.get(e);
    if (gate) {
      mid.passage = (gate.dir ?? (line.axis === 'z' ? 1 : 2)) as Dir4;
      mid.feature = gate;
    }
    link(a, mid);
    link(mid, b);
    const ux = line.axis === 'x' ? 1 : 0, uz = line.axis === 'z' ? 1 : 0;
    if (butts.has(`${e}:0`)) {
      const beyond = at(p0[0] - ux * FENCE.butt, p0[1] - uz * FENCE.butt);
      beyond.butt = true;
      link(beyond, a);
    }
    if (butts.has(`${e}:1`)) {
      const beyond = at(p1[0] + ux * FENCE.butt, p1[1] + uz * FENCE.butt);
      beyond.butt = true;
      link(b, beyond);
    }
  }

  const through = (d: Draft): boolean => {
    if (d.passage !== undefined || d.links.length !== 2) return false;
    const [p, q] = d.links as [Draft, Draft];
    return (Math.abs(p.x - d.x) < 1e-6 && Math.abs(q.x - d.x) < 1e-6) || (Math.abs(p.z - d.z) < 1e-6 && Math.abs(q.z - d.z) < 1e-6);
  };
  const ordered = [...drafts.values()].sort((p, q) => p.z - q.z || p.x - q.x);
  const nodes: RunNode[] = [];
  for (const d of ordered) {
    if (through(d)) continue;
    const k: NodeKind = d.passage !== undefined ? 'gate' : d.links.length <= 1 ? (d.butt ? 'butt' : 'post') : 'joint';
    d.node = { x: d.x, z: d.z, kind: k, passage: d.passage, feature: d.feature };
    nodes.push(d.node);
  }
  const segments: RunSegment[] = [];
  for (const d of ordered) {
    if (!d.node) continue;
    for (const first of d.links) {
      let prev = d, cur = first;
      while (!cur.node) {
        const next: Draft = cur.links[0] === prev ? cur.links[1]! : cur.links[0]!;
        prev = cur;
        cur = next;
      }
      // Each segment is found from both ends; keep the one that starts at the lower coordinate.
      if (cur.x - d.x + (cur.z - d.z) <= 1e-6) continue;
      const axis = Math.abs(cur.x - d.x) > 1e-6 ? 'x' : 'z';
      segments.push({ axis, from: d.node, to: cur.node, length: axis === 'x' ? cur.x - d.x : cur.z - d.z });
    }
  }
  return { level, y: level * CELL_H, nodes, segments };
}

/** The frame a segment is drawn in: origin at its `from` node, +X along the run, +Y up. */
export function segmentFrame(seg: RunSegment, y: number): Mat4 {
  return runFrame(seg.axis, seg.from.x, y, seg.from.z);
}

/** A frame at a point with +X along the given axis. */
export function runFrame(axis: 'x' | 'z', x: number, y: number, z: number): Mat4 {
  return axis === 'x' ? frame([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]) : frame([x, y, z], [0, 0, 1], [0, 1, 0], [-1, 0, 0]);
}

/** The axis a gate's run follows: square to the way people walk through it. */
export function gateAxis(node: RunNode): 'x' | 'z' {
  return node.passage === 1 || node.passage === 3 ? 'z' : 'x';
}

/** The world coordinate of a node along an axis. */
export const along = (n: RunNode, axis: 'x' | 'z'): number => (axis === 'x' ? n.x : n.z);

/** Seeded chance for one place on a run: the same whichever way the run was built. */
export function placeRng(s: Structure, x: number, z: number): Rng {
  return rngOf(hash(s.seed, 'at', Math.round(x * 8), Math.round(z * 8)));
}

/** How far a segment stops short of an end node: a gate's posts stand FENCE.gateHalf from its centre. */
export function trimAt(n: RunNode): number {
  return n.kind === 'gate' ? FENCE.gateHalf : 0;
}
