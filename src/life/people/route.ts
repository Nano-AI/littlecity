// Routes over the walking graph (catalogue L24). Pure.
//
// A* with the catalogue's costs: crossing a cell costs what its surface
// costs (path or plaza 1, dock or deck 1.5, grass 3; half of each end of a
// link), a link adds its own cost, and walking through a building costs its
// seconds. Going through somebody else's building (not the walker's home,
// not where they are going) costs NAV.through more, so people use a house as
// a way up only when the town gives them no other, and never as a shortcut.
//
// A router belongs to one graph. It keeps its working arrays between
// searches and remembers the routes it found, so sixty people asking for the
// same few routes cost almost nothing.

import { keyX, keyZ } from '@/core/grid';
import type { NavGraph, StructureId } from '@/resolve/plan';
import { NAV } from '@/style/people';

export interface Route {
  /** Node indices from start to goal, both included. */
  nodes: readonly number[];
  /** links[i] joins nodes[i] and nodes[i + 1]. */
  links: readonly number[];
  cost: number;
}

export interface Router {
  readonly nav: NavGraph;
  /**
   * The cheapest route, or null if there is none. `free` names buildings the
   * walker may pass through at no extra cost (home, destination).
   */
  find(from: number, to: number, free?: readonly StructureId[]): Route | null;
  /** Searches run and routes served from memory, for tests and the benchmark. */
  readonly stats: { searches: number; hits: number; expanded: number };
  /** Makes crossing a node dearer by `extra` (0: as the graph says), for something standing there a while (L56's stalls). */
  setExtra(node: number, extra: number): void;
}

const CACHE_MAX = 600;

export function createRouter(nav: NavGraph): Router {
  const n = nav.nodes.length;
  const g = new Float64Array(n);
  const via = new Int32Array(n);
  /** Search stamp per node: opened in this search / closed in this search. */
  const opened = new Uint32Array(n);
  const closed = new Uint32Array(n);
  const xs = new Int16Array(n), zs = new Int16Array(n);
  const cost = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = keyX(nav.nodes[i]!.cell);
    zs[i] = keyZ(nav.nodes[i]!.cell);
    cost[i] = nav.nodes[i]!.cost;
  }
  let stamp = 0;
  const heap: number[] = [];
  const cache = new Map<string, Route | null>();
  const stats = { searches: 0, hits: 0, expanded: 0 };

  // A binary heap of (key, node) pairs. A node may be in it more than once (it is pushed again when a
  // cheaper way to it is found); the stale entries are skipped when they surface.
  const keys: number[] = [];
  const push = (node: number, k: number): void => {
    let i = heap.length;
    heap.push(node);
    keys.push(k);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p]! <= k) break;
      heap[i] = heap[p]!;
      keys[i] = keys[p]!;
      i = p;
    }
    heap[i] = node;
    keys[i] = k;
  };
  const pop = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    const lastKey = keys.pop()!;
    const size = heap.length;
    if (size > 0) {
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= size) break;
        if (c + 1 < size && keys[c + 1]! < keys[c]!) c++;
        if (keys[c]! >= lastKey) break;
        heap[i] = heap[c]!;
        keys[i] = keys[c]!;
        i = c;
      }
      heap[i] = last;
      keys[i] = lastKey;
    }
    return top;
  };

  const search = (from: number, to: number, free: readonly StructureId[]): Route | null => {
    stats.searches++;
    if (++stamp === 0xffffffff) {
      opened.fill(0);
      closed.fill(0);
      stamp = 1;
    }
    heap.length = 0;
    keys.length = 0;
    const tx = xs[to]!, tz = zs[to]!;
    // Every step costs at least 1 a cell, so the column distance never overestimates (but for the way
    // through a building, which the `through` cost keeps rare).
    const h = (i: number): number => Math.abs(xs[i]! - tx) + Math.abs(zs[i]! - tz);
    g[from] = 0;
    via[from] = -1;
    opened[from] = stamp;
    push(from, h(from));
    while (heap.length > 0) {
      const cur = pop();
      if (closed[cur] === stamp) continue;
      closed[cur] = stamp;
      stats.expanded++;
      if (cur === to) break;
      for (let k = nav.linkStart[cur]!; k < nav.linkStart[cur + 1]!; k++) {
        const li = nav.linkOf[k]!;
        const link = nav.links[li]!;
        const next = link.a === cur ? link.b : link.a;
        if (closed[next] === stamp) continue;
        let step = link.cost + (cost[cur]! + cost[next]!) * 0.5;
        if (link.via === 'interior' && !free.includes(link.structure!)) step += NAV.through;
        const score = g[cur]! + step;
        if (opened[next] === stamp && score >= g[next]!) continue;
        opened[next] = stamp;
        g[next] = score;
        via[next] = li;
        push(next, score + h(next));
      }
    }
    if (closed[to] !== stamp) return null;
    const nodes: number[] = [to];
    const links: number[] = [];
    for (let cur = to; via[cur] !== -1; ) {
      const li = via[cur]!;
      const link = nav.links[li]!;
      cur = link.a === cur ? link.b : link.a;
      links.push(li);
      nodes.push(cur);
    }
    nodes.reverse();
    links.reverse();
    return { nodes, links, cost: g[to]! };
  };

  return {
    nav,
    stats,
    setExtra(node, extra) {
      if (node < 0 || node >= n) return;
      const want = nav.nodes[node]!.cost + extra;
      if (cost[node] === want) return;
      cost[node] = want;
      cache.clear();
    },
    find(from, to, free = []) {
      if (from < 0 || to < 0 || from >= n || to >= n) return null;
      if (from === to) return { nodes: [from], links: [], cost: 0 };
      if (nav.part[from] !== nav.part[to]) return null;
      const id = `${from}>${to}>${free.length === 0 ? '' : [...free].sort((a, b) => a - b).join(',')}`;
      const hit = cache.get(id);
      if (hit !== undefined) {
        stats.hits++;
        return hit;
      }
      const route = search(from, to, free);
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(id, route);
      return route;
    },
  };
}
