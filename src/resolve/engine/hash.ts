// Content hashes for the plans (Stage 0, real). See CONTRACTS.md, "What a
// generator may read": the structure hash covers exactly that, so equal hash
// means identical geometry and the renderer can skip the rebuild.

import { above, below, columnIndex, DIR4, inColumnBounds, keyX, keyZ, neighbor, NO_CELL, type CellKey } from '@/core/grid';
import { ALL_KINDS } from '@/core/kinds';
import { hashCombine, hashString } from '@/core/rand';
import type { Actor, Anchor, DressingPlan, Prop, ShapePlan, Structure } from '../plan';

const KIND_CODE = new Map<string, number>(
  [...ALL_KINDS, 'path', 'plaza', 'garden'].map((k, i) => [k, i + 1] as const),
);

function hashParams(params: object | undefined): number {
  if (!params) return 0;
  const record = params as Record<string, number | string | undefined>;
  let h = 17;
  for (const k of Object.keys(record).sort()) {
    const v = record[k];
    if (v === undefined) continue;
    h = hashCombine(h, hashString(k), typeof v === 'number' ? hashString(`n${v}`) : hashString(`s${v}`));
  }
  return h;
}

function hashAnchor(at: Anchor | null): number {
  if (!at) return 1;
  if ('socket' in at) return hashCombine(2, hashString(at.socket));
  if ('from' in at) return hashCombine(3, hashString(at.from), hashString(at.to));
  return hashCombine(4, at.cell, hashString(at.pos), at.face ?? -1);
}

/** Content hash of a prop or actor: everything except its id and the rule that made it. */
export function hashItem(item: Prop | Actor): number {
  return hashCombine(
    hashString(item.type),
    hashAnchor(item.at),
    hashString(item.variant ?? ''),
    hashParams(item.params),
    'home' in item && item.home !== undefined ? item.home : -1,
  );
}

/**
 * Content hash of one structure: its own data, its role, tags, features and
 * sockets, plus the local context a generator may read: for every member
 * cell, the block's rot, the six face neighbours (kind, colour, whether it is
 * the same structure), the floor in the cell, the terrain height of its own
 * and its four side columns, and any generated support carrying it.
 */
export function hashStructure(s: Structure, plan: ShapePlan): number {
  const { world, terrain, kinds, structureAt, floorAt } = plan;
  let h = hashCombine(hashString(s.kind), s.id, s.color, s.seed, s.cells.length, s.edges.length);
  const neighbourCode = (n: CellKey): number => {
    if (n === NO_CELL) return 0;
    const kind = kinds.get(n);
    if (kind === undefined) return 0;
    const same = structureAt.get(n) === s.id ? 1 : 0;
    return (KIND_CODE.get(kind)! << 5) | ((world.blocks.get(n)?.color ?? 0) << 1) | same;
  };
  const height = (x: number, z: number): number => (inColumnBounds(x, z) ? terrain.height[columnIndex(x, z)]! : 0);
  for (const c of s.cells) {
    const x = keyX(c);
    const z = keyZ(c);
    const block = world.blocks.get(c);
    const floor = world.floors.get(c);
    h = hashCombine(
      h,
      c,
      block ? block.rot : 9,
      kinds.has(c) ? KIND_CODE.get(kinds.get(c)!)! : 0,
      floor ? KIND_CODE.get(floor)! : 0,
      floorAt.get(c) ?? -1,
      neighbourCode(above(c)),
      neighbourCode(below(c)),
      height(x, z),
    );
    for (let d = 0; d < 4; d++) {
      h = hashCombine(h, neighbourCode(neighbor(c, d as 0)), height(x + DIR4[d]![0], z + DIR4[d]![1]));
    }
  }
  for (const e of s.edges) h = hashCombine(h, e, hashString(world.edges.get(e) ?? ''));

  const role = plan.roles.get(s.id);
  h = hashCombine(h, role ? hashString(role.role) : 0);
  const tags = plan.tags.get(s.id);
  if (tags) for (const t of [...tags].sort()) h = hashCombine(h, hashString(t));
  for (const f of plan.featuresByStructure.get(s.id) ?? []) {
    h = hashCombine(
      h,
      hashString(f.id),
      hashString(f.type),
      f.cell ?? -1,
      f.dir ?? -1,
      f.edge ?? -1,
      f.region ?? -1,
      hashString(f.variant ?? ''),
      hashParams(f.params),
    );
    for (const sock of plan.socketsByOwner.get(f.id) ?? []) h = hashCombine(h, hashString(sock.id), hashString(sock.type));
  }
  for (const sock of plan.sockets) {
    if (sock.structure === s.id && sock.owner === undefined) {
      h = hashCombine(h, hashString(sock.id), hashString(sock.type), sock.cell, sock.dir ?? -1);
    }
  }
  if (plan.supports.length) {
    const mine = new Set(s.cells);
    for (const sup of plan.supports) {
      if (!mine.has(sup.carries)) continue;
      h = hashCombine(h, hashString(sup.type), sup.carries, sup.bottomY, sup.against ?? -1);
      for (const d of sup.arcadeTo ?? []) h = hashCombine(h, d);
    }
  }
  return h;
}

/** Hash of the whole shape plan: every structure hash (by id) and every support. */
export function hashShape(plan: ShapePlan): number {
  let h = 23;
  const ids = [...plan.structures.keys()].sort((a, b) => a - b);
  for (const id of ids) h = hashCombine(h, id, plan.structures.get(id)!.hash);
  for (const sup of plan.supports) {
    h = hashCombine(h, hashString(sup.type), sup.carries, sup.bottomY, sup.against ?? -1);
    for (const d of sup.arcadeTo ?? []) h = hashCombine(h, d);
  }
  return h;
}

/** Hash of the dressing plan: every prop, actor, socket and the size of the walking graph. */
export function hashDressing(plan: DressingPlan): number {
  let h = 29;
  for (const p of plan.props) h = hashCombine(h, hashString(p.id), p.hash);
  for (const a of plan.actors) h = hashCombine(h, hashString(a.id), a.hash);
  for (const s of plan.sockets) h = hashCombine(h, hashString(s.id), hashString(s.type), s.cell, s.dir ?? -1);
  h = hashCombine(h, plan.nav.nodes.length, plan.nav.links.length);
  for (const n of plan.nav.nodes) h = hashCombine(h, n.cell, hashString(n.surface));
  for (const l of plan.nav.links) h = hashCombine(h, l.a, l.b, hashString(l.via));
  return h;
}
