#!/usr/bin/env node
// node tools/heap-paths.mjs [--seconds 8] [--props structureAt+world,props+actors] [--chains 6] [--tail 14] [--query "..."]
//
// What holds on to old plans. Opens the game as a first visit (a town grows by itself: an edit a
// tick), waits, takes a heap snapshot, and for every object with a property of the given names (a
// ShapePlan has `structureAt`) prints how many are alive and the shortest chain of references from
// the page's roots to the oldest few. One live plan is the town on screen; the rest are being kept.

import { chromium } from 'playwright';
import { parseArgs, startServer } from './lib/vite.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const seconds = Number(flags.seconds ?? 8);
const wanted = String(flags.props ?? 'structureAt').split(',');
const server = await startServer();
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal', '--enable-unsafe-swiftshader'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${server.url}/index.html${flags.query ? `?${flags.query}` : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lc !== undefined, null, { timeout: 120_000 });
  await page.waitForTimeout(seconds * 1000);
  const blocks = await page.evaluate(() => window.__lc.world().blocks.size);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
  const chunks = [];
  cdp.on('HeapProfiler.addHeapSnapshotChunk', (e) => chunks.push(e.chunk));
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  const snap = JSON.parse(chunks.join(''));
  chunks.length = 0;
  const { node_fields: NF, edge_fields: EF, node_types: NT, edge_types: ET } = snap.snapshot.meta;
  const N = NF.length, E = EF.length;
  const nType = NF.indexOf('type'), nName = NF.indexOf('name'), nId = NF.indexOf('id'), nSelf = NF.indexOf('self_size'), nEdges = NF.indexOf('edge_count');
  const eType = EF.indexOf('type'), eName = EF.indexOf('name_or_index'), eTo = EF.indexOf('to_node');
  const { nodes, edges, strings } = snap;
  const count = nodes.length / N;
  const firstEdge = new Uint32Array(count + 1);
  for (let i = 0, e = 0; i < count; i++) {
    firstEdge[i] = e;
    e += nodes[i * N + nEdges];
    firstEdge[i + 1] = e;
  }
  const edgeTypes = ET[0], nodeTypes = NT[0];
  const total = (() => {
    let s = 0;
    for (let i = 0; i < count; i++) s += nodes[i * N + nSelf];
    return s;
  })();
  console.log(`\nfirst visit, ${seconds} s: ${blocks} blocks, ${(total / 1048576).toFixed(1)} MB held in ${count} objects`);

  // The shortest chain from the roots to each object (weak references do not hold anything).
  const parent = new Int32Array(count).fill(-1);
  const via = new Int32Array(count).fill(-1);
  const queue = new Uint32Array(count);
  let head = 0, tail = 0;
  queue[tail++] = 0;
  parent[0] = 0;
  while (head < tail) {
    const i = queue[head++];
    for (let e = firstEdge[i]; e < firstEdge[i + 1]; e++) {
      const type = edgeTypes[edges[e * E + eType]];
      if (type === 'weak' || type === 'shortcut') continue;
      const to = edges[e * E + eTo] / N;
      if (parent[to] !== -1) continue;
      parent[to] = i;
      via[to] = e;
      queue[tail++] = to;
    }
  }
  const nameOf = (i) => `${nodeTypes[nodes[i * N + nType]]} ${String(strings[nodes[i * N + nName]]).slice(0, 60)}`;
  const edgeName = (e) => {
    const type = edgeTypes[edges[e * E + eType]];
    const v = edges[e * E + eName];
    return type === 'element' || type === 'hidden' ? `[${v}]` : `.${strings[v]}`;
  };
  for (const prop of wanted) {
    const owners = [];
    for (let i = 0; i < count; i++) {
      if (nodeTypes[nodes[i * N + nType]] !== 'object') continue;
      const need = new Set(prop.split('+'));
      for (let e = firstEdge[i]; e < firstEdge[i + 1] && need.size; e++) {
        if (edgeTypes[edges[e * E + eType]] === 'property') need.delete(strings[edges[e * E + eName]]);
      }
      if (need.size === 0) owners.push(i);
    }
    owners.sort((a, b) => nodes[a * N + nId] - nodes[b * N + nId]);
    console.log(`\n${owners.length} live objects with the properties '${prop}'`);
    // The distinct chains, with how many objects hang from each.
    const chains = new Map();
    for (const o of owners) {
      const steps = [];
      for (let i = o; i !== 0 && parent[i] !== -1; i = parent[i]) steps.push(`${nameOf(parent[i])} ${edgeName(via[i])}`);
      // Without the numbers that differ from one object to the next, and without the way in from the roots.
      const clean = steps.reverse().map((s) => s.replace(/\[\d+\]/g, '[n]').replace(/@\d+/g, '').replace(/ \.\d+ \/ part of key.*/, ' (a WeakMap value)').replace(/^array {2}\.\d+$/, 'array [n]'));
      const from = clean.findIndex((s) => s.includes('JSGlobalObject'));
      const key = clean.slice(from + 1).slice(-Number(flags.tail ?? 14)).join('\n      -> ');
      chains.set(key, (chains.get(key) ?? 0) + 1);
    }
    for (const [chain, n] of [...chains].sort((a, b) => b[1] - a[1]).slice(0, Number(flags.chains ?? 6))) console.log(`  ${n} held by:\n      -> ${chain}`);
  }
} finally {
  await browser.close();
  await server.close();
}
