// Content hashes for the plans (Stage 0, real). See CONTRACTS.md, "What a
// generator may read": the structure hash covers exactly that, so equal hash
// means identical geometry and the renderer can skip the rebuild.

import { above, below, columnIndex, DIR4, inColumnBounds, keyX, keyZ, neighbor, NO_CELL, type CellKey } from '@/core/grid';
import { ALL_KINDS } from '@/core/kinds';
import { hashCombine, hashString } from '@/core/rand';
import type { Actor, Anchor, DressingPlan, Prop, ShapePlan, Socket, Structure, Support } from '../plan';

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

// A small incremental hasher (murmur3 rounds, as in @/core/rand) without
// rest-argument arrays: hashStructure runs for every structure on every edit.
function mix(h: number, k: number): number {
  k = Math.imul(k | 0, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  h ^= k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}
function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Per-plan indexes the structure hash needs, built once per plan. */
interface HashIndex {
  supportsByCell: Map<CellKey, Support[]>;
  socketsByStructure: Map<number, Socket[]>;
  stringCodes: Map<string, number>;
}
const indexes = new WeakMap<ShapePlan, HashIndex>();
function indexOf(plan: ShapePlan): HashIndex {
  let ix = indexes.get(plan);
  if (!ix) {
    const supportsByCell = new Map<CellKey, Support[]>();
    for (const sup of plan.supports) {
      const list = supportsByCell.get(sup.carries);
      if (list) list.push(sup);
      else supportsByCell.set(sup.carries, [sup]);
    }
    const socketsByStructure = new Map<number, Socket[]>();
    for (const sock of plan.sockets) {
      if (sock.structure === undefined || sock.owner !== undefined) continue;
      const list = socketsByStructure.get(sock.structure);
      if (list) list.push(sock);
      else socketsByStructure.set(sock.structure, [sock]);
    }
    ix = { supportsByCell, socketsByStructure, stringCodes: new Map() };
    indexes.set(plan, ix);
  }
  return ix;
}
function code(ix: HashIndex, s: string): number {
  let c = ix.stringCodes.get(s);
  if (c === undefined) ix.stringCodes.set(s, (c = hashString(s)));
  return c;
}

/**
 * Content hash of one structure: its own data, its role, tags, features and
 * sockets, plus the local context a generator may read: for every member
 * cell, the block's rot, the six face neighbours (kind, colour, whether it is
 * the same structure), the floor in the cell, the terrain height of its own
 * and its four side columns, and any generated support carrying it.
 *
 * Call it once the shape rules have run (the engine does): it indexes the
 * plan's supports and sockets on first use.
 */
export function hashStructure(s: Structure, plan: ShapePlan): number {
  const { world, terrain, kinds, structureAt, floorAt } = plan;
  const ix = indexOf(plan);
  let h = mix(mix(mix(mix(mix(mix(0x2f, code(ix, s.kind)), s.id), s.color), s.seed), s.cells.length), s.edges.length);
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
    h = mix(h, c);
    h = mix(h, block ? block.rot : 9);
    h = mix(h, kinds.has(c) ? KIND_CODE.get(kinds.get(c)!)! : 0);
    h = mix(h, floor ? KIND_CODE.get(floor)! : 0);
    h = mix(h, floorAt.get(c) ?? -1);
    h = mix(h, neighbourCode(above(c)));
    h = mix(h, neighbourCode(below(c)));
    h = mix(h, height(x, z));
    for (let d = 0; d < 4; d++) {
      h = mix(h, neighbourCode(neighbor(c, d as 0)));
      h = mix(h, height(x + DIR4[d]![0], z + DIR4[d]![1]));
    }
    const sups = ix.supportsByCell.get(c);
    if (sups) {
      for (const sup of sups) {
        h = mix(mix(mix(mix(h, code(ix, sup.type)), sup.carries), sup.bottomY), sup.against ?? -1);
        for (const d of sup.arcadeTo ?? []) h = mix(h, d);
      }
    }
  }
  for (const e of s.edges) h = mix(mix(h, e), code(ix, world.edges.get(e) ?? ''));

  const role = plan.roles.get(s.id);
  h = mix(h, role ? code(ix, role.role) : 0);
  const tags = plan.tags.get(s.id);
  if (tags) for (const t of [...tags].sort()) h = mix(h, code(ix, t));
  for (const f of plan.featuresByStructure.get(s.id) ?? []) {
    h = mix(h, code(ix, f.id));
    h = mix(h, code(ix, f.type));
    h = mix(h, f.cell ?? -1);
    h = mix(h, f.dir ?? -1);
    h = mix(h, f.edge ?? -1);
    h = mix(h, f.region ?? -1);
    h = mix(h, code(ix, f.variant ?? ''));
    h = mix(h, hashParams(f.params));
    for (const sock of plan.socketsByOwner.get(f.id) ?? []) h = mix(mix(h, code(ix, sock.id)), code(ix, sock.type));
  }
  for (const sock of ix.socketsByStructure.get(s.id) ?? []) {
    h = mix(mix(mix(mix(h, code(ix, sock.id)), code(ix, sock.type)), sock.cell), sock.dir ?? -1);
  }
  return fmix(h);
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
