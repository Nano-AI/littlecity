// Arches, bridges and viaducts (J15, S1). Every arch cell is a block of
// stone the full width of its cell with one or two openings cut up into it;
// J15 pins which. A standing arch has its own small opening on two legs; a
// span shares one opening across up to three cells; piers go down to the
// ground or the seabed. The top course is shared: one cornice and one
// parapet run through neighbouring arches, and there is none between tiers.
//
// Each cell is drawn in a local frame: `u` (+X) along the span, `t` (+Z)
// across it from 0 to 1, +Y up from the cell's foot.

import { above, CELL_H, columnIndex, E, inColumnBounds, keyX, keyY, keyZ, N, neighbor, NO_CELL, S, SEA_Y, W, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS } from '@/core/kinds';
import { compose, rotationY, translation, type Mat4, type Mat4Like } from '@/core/mat4';
import { defineGenerator, placeFeature } from '@/gen/api';
import { featureFrame } from '@/gen/frames';
import { MeshBuilder, PATTERN, type BoxFace } from '@/gen/mesh';
import type { Feature, ShapePlan, Structure } from '@/resolve/plan';
import { MONUMENTS } from '@/style/monuments';
import { PALETTE, rampColor } from '@/style/palette';
import { ownSockets } from '@/parts/monuments/kit';
import { openingHeight, openingRing, profileSlab, type Opening, type SlabSpec } from '@/parts/monuments/slab';
import { archExtras } from './extras';
import { rakeAt, type Rake } from './rake';

type Vec3 = [number, number, number];
type Side = 'front' | 'back' | 'lo' | 'hi';
const SIDES: readonly Side[] = ['front', 'back', 'lo', 'hi'];
/**
 * How far an arch's top (deck, coping, cornice) and an impost's top stand over the storey line they
 * would otherwise share with the ground, a house's floor band or a marble block's cornice beside them.
 */
const TOP_LIFT = 0.004;

interface OpeningParams {
  lo?: number;
  hi?: number;
  lo2?: number;
  hi2?: number;
  spring?: number;
  crown?: number;
  at?: number;
  len?: number;
  toward?: number;
}

export interface ArchCellShape {
  cell: CellKey;
  axis: 'x' | 'z';
  /** The world direction of each local side. */
  dir: Record<Side, Dir4>;
  /** Cell-local frame: u along +X, across along +Z. */
  frame: Mat4;
  openings: Opening[];
  /** Index in the run and the run's length (for the hump). */
  at: number;
  len: number;
  crown: boolean;
  /** Nothing of this structure above: the cell carries the top course. */
  topOpen: boolean;
  /** Nothing at all above: the deck can be walked on. */
  walkable: boolean;
  /** Sides that drop away (no solid block, terrain or stairs beside the cell). */
  edge: Record<Side, boolean>;
  /** Signature of the openings, to tell whether a parallel neighbour matches. */
  sig: string;
  piers: Feature[];
  /** The cell's arch-opening feature, if J15 has run. */
  opening?: Feature;
  /** What stands along the deck's edges: the stone parapet, a covered gallery's walls, or a loggia's balustrade. */
  deck: 'parapet' | 'covered' | 'balcony';
  /** Set on the cells of a hanging run that J15 shaped as a half arch: where the cell lies along it. */
  rake?: Rake;
}

/** What the generator works out per cell before drawing (all inside the structure hash). */
export function archCells(s: Structure, plan: ShapePlan): Map<CellKey, ArchCellShape> {
  const mine = new Set(s.cells);
  const features = plan.featuresByStructure.get(s.id) ?? [];
  const openingAt = new Map<CellKey, Feature>();
  const piersAt = new Map<CellKey, Feature[]>();
  const deckAt = new Map<CellKey, 'covered' | 'balcony'>();
  for (const f of features) {
    if (f.cell === undefined) continue;
    if (f.type === 'covered-gallery') deckAt.set(f.cell, 'covered');
    if (f.type === 'loggia-rail') deckAt.set(f.cell, 'balcony');
    if (f.type === 'arch-opening') openingAt.set(f.cell, f);
    else if (f.type === 'pier') {
      const list = piersAt.get(f.cell);
      if (list) list.push(f);
      else piersAt.set(f.cell, [f]);
    }
  }
  const height = (c: CellKey): number => (inColumnBounds(keyX(c), keyZ(c)) ? plan.terrain.height[columnIndex(keyX(c), keyZ(c))]! : 0);
  const crownH = MONUMENTS.archCrown;
  const out = new Map<CellKey, ArchCellShape>();
  for (const cell of s.cells) {
    const f = openingAt.get(cell);
    const p = (f?.params ?? {}) as OpeningParams;
    const axis: 'x' | 'z' = f && (f.dir === E || f.dir === W) ? 'z' : 'x';
    const x = keyX(cell), y = keyY(cell) * CELL_H, z = keyZ(cell);
    const frame = axis === 'x' ? translation(x, y, z) : compose(translation(x + 1, y, z), rotationY(-Math.PI / 2));
    const dir: Record<Side, Dir4> = axis === 'x' ? { front: S, back: N, lo: W, hi: E } : { front: W, back: E, lo: N, hi: S };
    const base = p.spring ? Math.max(0, SEA_Y - 0.03 - y) : 0;
    const shape = (lo: number, hi: number): Opening => {
      const a = (hi - lo) / 2;
      const avail = CELL_H - crownH - base;
      const rise = Math.min(avail, a);
      return { lo, hi, spring: base + avail - rise, rise };
    };
    const openings: Opening[] = [];
    if (f === undefined) openings.push(shape(MONUMENTS.archLeg, 1 - MONUMENTS.archLeg));
    if (p.lo !== undefined && p.hi !== undefined) openings.push(shape(p.lo, p.hi));
    if (p.lo2 !== undefined && p.hi2 !== undefined) openings.push(shape(p.lo2, p.hi2));
    const up = above(cell);
    const edge = {} as Record<Side, boolean>;
    for (const side of SIDES) {
      const n = neighbor(cell, dir[side]);
      const kind = n === NO_CELL ? undefined : plan.kinds.get(n);
      const ground = n !== NO_CELL && height(n) > keyY(cell);
      edge[side] = !(ground || (kind !== undefined && (KINDS[kind].solid || kind === 'stairs')));
    }
    out.set(cell, {
      cell, axis, dir, frame, openings,
      at: p.at ?? 0,
      len: p.len ?? 1,
      crown: p.crown === 1 || f === undefined,
      topOpen: up === NO_CELL || !mine.has(up),
      walkable: up === NO_CELL || !plan.kinds.has(up),
      edge,
      sig: openings.map((o) => `${o.lo.toFixed(3)}:${o.hi.toFixed(3)}:${o.spring.toFixed(3)}`).join('|'),
      piers: piersAt.get(cell) ?? [],
      opening: f,
      deck: deckAt.get(cell) ?? 'parapet',
      rake:
        f?.variant === 'half' && p.toward !== undefined
          ? p.toward === dir.lo
            ? { from: p.at ?? 0, dir: 1, len: p.len ?? 1 }
            : { from: (p.len ?? 1) - (p.at ?? 0), dir: -1, len: p.len ?? 1 }
          : undefined,
    });
  }
  return out;
}

export default defineGenerator({
  kind: 'arch',
  build(s, plan, parts) {
    const b = new MeshBuilder({ ink: s.id });
    const anchors: Record<string, Mat4Like> = {};
    const cells = archCells(s, plan);
    const tags = plan.tags.get(s.id);
    const humped = tags?.has('deck:humped') ?? false;
    const gate = tags?.has('arch:gate') ?? false;
    // A flying buttress is a slim rib, not a deck.
    const slim = tags?.has('arch:buttress') ?? false;
    const t0 = slim ? 0.31 : 0, t1 = slim ? 0.69 : 1;
    const stone = rampColor('arch', s.color + Math.round(MONUMENTS.archTint));
    // A buttress with no pier under it anywhere is drawn as a raking half arch, never a level slab.
    const raking = slim && [...cells.values()].every((c) => c.rake !== undefined && c.piers.length === 0);
    const H = CELL_H, HT = H + TOP_LIFT;
    const { cornice: cH, corniceOut: cOut, parapet: pH, parapetThick: pT, pierHalf: ph } = MONUMENTS;
    const height = (c: CellKey): number => (inColumnBounds(keyX(c), keyZ(c)) ? plan.terrain.height[columnIndex(keyX(c), keyZ(c))]! : 0);

    for (const c of cells.values()) {
      const y = keyY(c.cell);
      const nb = (side: Side): { cell: CellKey; shape?: ArchCellShape; kind?: string; ground: boolean } => {
        const n = neighbor(c.cell, c.dir[side]);
        return { cell: n, shape: n === NO_CELL ? undefined : cells.get(n), kind: n === NO_CELL ? undefined : plan.kinds.get(n), ground: n !== NO_CELL && height(n) > y };
      };
      const near = { front: nb('front'), back: nb('back'), lo: nb('lo'), hi: nb('hi') };
      /** The neighbour continues this cell's stone seamlessly on that side. */
      const joined = (side: Side): boolean => {
        const o = near[side].shape;
        if (!o || o.axis !== c.axis) return false;
        return side === 'lo' || side === 'hi' ? true : o.sig === c.sig;
      };
      const hidden = (side: Side): boolean => (slim && (side === 'front' || side === 'back') ? false : joined(side) || near[side].kind === 'marble');
      // An end against a house (whose wall stands inside its cell) or a round tower runs on into it: an
      // abutment, so nothing shows through the join.
      const reach = (side: 'lo' | 'hi'): number => {
        if (joined(side) || near[side].ground) return 0;
        const k = near[side].kind;
        if (k === 'house' || k === 'windmill') return 0.1;
        if (k === 'tower' || k === 'lighthouse' || k === 'pillar') return slim ? 0.32 : 0.5;
        return 0;
      };
      const ext = { lo: reach('lo'), hi: reach('hi') };
      const slab: SlabSpec = { u0: 0, u1: 1, v0: 0, v1: H, z0: t0, z1: t1, openings: c.openings, segments: 16 };
      /** The hump of a stone bridge at `u` along this cell. */
      const hump = (u: number): number => (humped ? MONUMENTS.hump * Math.sin((Math.PI * Math.min(Math.max(c.at + u, 0), c.len)) / c.len) : 0);

      b.at(c.frame, () => {
        // ── a raking buttress: the whole cell is one sweep of stone ──
        if (raking && c.rake) {
          const rk = c.rake;
          const us: number[] = [];
          const lead = rk.dir > 0 ? ext.lo : ext.hi; // how far it runs on into its anchor
          if (rk.dir > 0 && lead > 0) us.push(-lead);
          for (let i = 0; i <= 6; i++) us.push(i / 6);
          if (rk.dir < 0 && lead > 0) us.push(1 + lead);
          const at = (u: number): { top: number; bottom: number } => rakeAt(rk.from + rk.dir * Math.min(Math.max(u, 0), 1), rk.len);
          b.with({ color: stone, pattern: PATTERN.stone, ink: 'body' }, () => {
            const outline: [number, number][] = [...us.map((u): [number, number] => [u, at(u).bottom]), ...[...us].reverse().map((u): [number, number] => [u, at(u).top - 0.04])];
            b.polygon(outline.map(([u, v]): Vec3 => [u, v, t1]));
            b.polygon([...outline].reverse().map(([u, v]): Vec3 => [u, v, t0]));
            for (let i = 0; i + 1 < us.length; i++) {
              const u0 = us[i]!, u1 = us[i + 1]!;
              b.quad([u0, at(u0).bottom, t0], [u1, at(u1).bottom, t0], [u1, at(u1).bottom, t1], [u0, at(u0).bottom, t1]);
            }
            // The tip, where the run ends in the air.
            const tipU = rk.dir > 0 ? 1 : 0;
            if (!joined(rk.dir > 0 ? 'hi' : 'lo')) {
              const e = at(tipU);
              if (rk.dir > 0) b.quad([1, e.bottom, t1], [1, e.bottom, t0], [1, e.top, t0], [1, e.top, t1]);
              else b.quad([0, e.bottom, t0], [0, e.bottom, t1], [0, e.top, t1], [0, e.top, t0]);
            }
          });
          // A coping down its back.
          b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'cornice' }, () => {
            const o = 0.04, d = 0.05;
            for (let i = 0; i + 1 < us.length; i++) {
              const u0 = us[i]!, u1 = us[i + 1]!, y0 = at(u0).top, y1 = at(u1).top;
              b.quad([u0, y0, t1 + o], [u1, y1, t1 + o], [u1, y1, t0 - o], [u0, y0, t0 - o]);
              b.quad([u0, y0 - d, t1 + o], [u1, y1 - d, t1 + o], [u1, y1, t1 + o], [u0, y0, t1 + o]);
              b.quad([u1, y1 - d, t0 - o], [u0, y0 - d, t0 - o], [u0, y0, t0 - o], [u1, y1, t0 - o]);
            }
          });
          if (c.opening) {
            const mid = at(0.5);
            ownSockets(plan, anchors, c.opening.id, c.frame, { 'arch-crown': translation(0.5, mid.bottom, 0.5) });
          }
          return;
        }

        // ── the block and its openings ──
        b.with({ color: stone, pattern: PATTERN.stone, ink: 'body' }, () => {
          profileSlab(b, {
            ...slab,
            front: !hidden('front'),
            back: !hidden('back'),
            endLo: !hidden('lo') && !near.lo.ground && ext.lo === 0,
            endHi: !hidden('hi') && !near.hi.ground && ext.hi === 0,
          });
          // Abutments: the stone runs on past the cell line into the anchor.
          for (const end of ['lo', 'hi'] as const) {
            const e = ext[end];
            if (e === 0) continue;
            const from = openingHeight(c.openings, end === 'lo' ? 1e-4 : 1 - 1e-4);
            const only: BoxFace[] = [];
            if (!hidden('front')) only.push('s');
            if (!hidden('back')) only.push('n');
            if (only.length) b.box([end === 'lo' ? -e : 1, from, t0], [end === 'lo' ? 0 : 1 + e, H, t1], { only });
          }
          // Piers: straight down from the cell's foot.
          for (const p of c.piers) {
            const pp = p.params as { depth?: number; side?: number; water?: number };
            const depth = (pp.depth ?? 0) * H;
            if (depth <= 0) continue;
            const uc = pp.side === undefined ? 0.5 : pp.side === c.dir.hi ? 1 : 0;
            const same = (side: Side): boolean => {
              const o = near[side].shape;
              return o !== undefined && joined(side) && o.piers.some((q) => JSON.stringify(q.params) === JSON.stringify(p.params));
            };
            const skip: ('n' | 's' | 'top' | 'bottom')[] = ['top', 'bottom'];
            if (same('front')) skip.push('s');
            if (same('back')) skip.push('n');
            b.box([uc - ph, -depth, t0], [uc + ph, 0, t1], { skip });
          }
        });
        // The deck.
        // The top (deck, coping, cornice) stands TOP_LIFT over the storey line, where the ground beside
        // it, a house's floor band under its abutment and a marble block's cornice lie.
        if (c.topOpen && slim) {
          // A coping along the rib's back.
          b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'cornice' }, () => {
            const skip: ('bottom' | 'w' | 'e')[] = ['bottom'];
            if (joined('lo')) skip.push('w');
            if (joined('hi')) skip.push('e');
            b.box([-ext.lo, H - 0.07, t0 - 0.04], [1 + ext.hi, HT, t1 + 0.04], { skip });
          });
        } else if (c.topOpen) {
          b.with({ color: stone, pattern: c.walkable ? PATTERN.cobbles : PATTERN.none, ink: 'body' }, () =>
            b.quad([-ext.lo, HT, 1], [1 + ext.hi, HT, 1], [1 + ext.hi, HT, 0], [-ext.lo, HT, 0]),
          );
        }

        // ── imposts: the block an arch springs from where it meets a wall or a tower ──
        for (const end of ['lo', 'hi'] as const) {
          const e = Math.min(ext[end], 0.1);
          if (e === 0) continue;
          const o = c.openings.find((op) => (end === 'lo' ? op.lo < 0.02 && op.hi > 0.02 : op.hi > 0.98 && op.lo < 0.98));
          if (!o) continue;
          // Its top a hair over the springing: a springing on a storey line is level with the house's floor band.
          b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'impost' }, () =>
            b.box([end === 'lo' ? -e : 0.93, o.spring - 0.12, t0 - 0.03], [end === 'lo' ? 0.07 : 1 + e, o.spring + TOP_LIFT, t1 + 0.03], { skip: ['bottom', end === 'lo' ? 'w' : 'e'] }),
          );
        }

        // ── the voussoir ring round every opening ──
        if (!slim && MONUMENTS.archRing > 0) {
          b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'ring' }, () => {
            if (!hidden('front')) openingRing(b, slab, MONUMENTS.archRing, MONUMENTS.archRingOut, 'front');
            if (!hidden('back')) openingRing(b, slab, MONUMENTS.archRing, MONUMENTS.archRingOut, 'back');
          });
        }

        // ── pier footings ──
        for (const p of c.piers) {
          const pp = p.params as { depth?: number; side?: number; water?: number };
          const depth = (pp.depth ?? 0) * H;
          const uc = pp.side === undefined ? 0.5 : pp.side === c.dir.hi ? 1 : 0;
          const o = 0.06;
          b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: `foot${p.id}` }, () => {
            if (pp.water) {
              // A cutwater: the footing comes to a point up and down stream.
              const top = -depth + SEA_Y + MONUMENTS.footingRise;
              const noseF = joined('front') ? [] : [[uc, 1.17] as [number, number]];
              const noseB = joined('back') ? [] : [[uc, -0.17] as [number, number]];
              b.extrude([[uc - ph - o, 0], ...noseB, [uc + ph + o, 0], [uc + ph + o, 1], ...noseF, [uc - ph - o, 1]], -depth, top, { cap: 'top' });
            } else if (depth > 0) {
              b.box([uc - ph - o, -depth, t0 - 0.05], [uc + ph + o, -depth + 0.1, t1 + 0.05], { skip: ['bottom'] });
            }
          });
        }

        // ── keystones ──
        if (c.crown && !slim) {
          const o = c.openings[0];
          if (o && (o.lo + o.hi) / 2 >= 0 && (o.lo + o.hi) / 2 < 1) {
            const uc = (o.lo + o.hi) / 2, top = o.spring + o.rise;
            for (const side of ['front', 'back'] as const) {
              if (hidden(side)) continue;
              const t = side === 'front' ? 1 : 0, sgn = side === 'front' ? 1 : -1;
              b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: `key-${c.cell}-${side}` }, () => {
                const z0 = t, z1 = t + sgn * (MONUMENTS.archRingOut + 0.03);
                const y0 = top - 0.025, y1 = top + 0.085;
                const a: Vec3 = [uc - 0.05, y0, z1], bb: Vec3 = [uc + 0.05, y0, z1], cc: Vec3 = [uc + 0.075, y1, z1], d: Vec3 = [uc - 0.075, y1, z1];
                const A: Vec3 = [a[0], a[1], z0], B: Vec3 = [bb[0], bb[1], z0], C: Vec3 = [cc[0], cc[1], z0], D: Vec3 = [d[0], d[1], z0];
                if (sgn > 0) {
                  b.quad(a, bb, cc, d).quad(A, B, bb, a).quad(B, C, cc, bb).quad(C, D, d, cc).quad(D, A, a, d);
                } else {
                  b.quad(bb, a, d, cc).quad(B, A, a, bb).quad(C, B, bb, cc).quad(D, C, cc, d).quad(A, D, d, a);
                }
              });
            }
          }
        }
        // The crown's socket (for a hanging lantern), whether or not a keystone marks it.
        if (c.crown && c.opening && c.openings[0]) {
          const o = c.openings[0];
          ownSockets(plan, anchors, c.opening.id, c.frame, { 'arch-crown': translation(Math.min(Math.max((o.lo + o.hi) / 2, 0), 1), o.spring + o.rise, 0.5) });
        }

        // ── the top course: cornice and parapet on every side that drops away ──
        if (!c.topOpen || slim) return;
        for (const side of SIDES) {
          if (!c.edge[side]) continue;
          // Work in a frame where this side runs along +X at z = 1 (the front), then turn it into place.
          const turn = side === 'front' ? 0 : side === 'back' ? Math.PI : side === 'hi' ? Math.PI / 2 : -Math.PI / 2;
          const along = side === 'front' || side === 'back';
          const rise = (k: number): number => {
            if (!along) return 0;
            return hump(side === 'front' ? k : 1 - k);
          };
          // Does the course carry on past each end of this side, or stop there?
          const leftSide: Side = side === 'front' ? 'lo' : side === 'back' ? 'hi' : side === 'hi' ? 'front' : 'back';
          const rightSide: Side = side === 'front' ? 'hi' : side === 'back' ? 'lo' : side === 'hi' ? 'back' : 'front';
          const carries = (end: Side, parapet: boolean): boolean => {
            const o = near[end].shape;
            if (o === undefined || !o.topOpen) return false;
            // The same world side on the neighbour.
            const theirs = SIDES.find((sd) => o.dir[sd] === c.dir[side])!;
            return o.edge[theirs] && (!parapet || o.walkable);
          };
          const capL = !carries(leftSide, false), capR = !carries(rightSide, false);
          const stopL = !carries(leftSide, true), stopR = !carries(rightSide, true);
          const cornerL = c.edge[leftSide], cornerR = c.edge[rightSide];
          const eL = along ? ext[leftSide as 'lo' | 'hi'] : 0, eR = along ? ext[rightSide as 'lo' | 'hi'] : 0;
          b.at(compose(translation(0.5, 0, 0.5), rotationY(turn), translation(-0.5, 0, -0.5)), () => {
            const n = humped && along ? 4 : 1;
            const x0 = cornerL ? -cOut : -eL, x1 = cornerR ? 1 + cOut : 1 + eR;
            const xs: number[] = [];
            for (let i = 0; i <= n; i++) xs.push(i / n);
            // The wall carries up behind the hump.
            if (humped && along) {
              b.with({ color: stone, pattern: PATTERN.stone, ink: 'body' }, () => {
                for (let i = 0; i < n; i++) {
                  const a = xs[i]!, d = xs[i + 1]!;
                  b.quad([a, H, 1], [d, H, 1], [d, H + rise(d), 1], [a, H + rise(a), 1]);
                }
              });
            }
            b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'cornice' }, () => {
              for (let i = 0; i < n; i++) {
                const a = i === 0 ? x0 : xs[i]!, d = i === n - 1 ? x1 : xs[i + 1]!;
                const ra = rise(xs[i]!), rd = rise(xs[i + 1]!);
                b.quad([a, H - cH + ra, 1 + cOut], [d, H - cH + rd, 1 + cOut], [d, HT + rd, 1 + cOut], [a, HT + ra, 1 + cOut]);
                b.quad([a, HT + ra, 1 + cOut], [d, HT + rd, 1 + cOut], [d, HT + rd, 1], [a, HT + ra, 1]);
                b.quad([a, H - cH + ra, 1], [d, H - cH + rd, 1], [d, H - cH + rd, 1 + cOut], [a, H - cH + ra, 1 + cOut]);
              }
              if (capL && !cornerL && eL === 0) b.quad([0, H - cH, 1], [0, H - cH, 1 + cOut], [0, HT, 1 + cOut], [0, HT, 1]);
              if (capR && !cornerR && eR === 0) b.quad([1, H - cH, 1 + cOut], [1, H - cH, 1], [1, HT, 1], [1, HT, 1 + cOut]);
            });
            if (!c.walkable) return;
            if (c.deck === 'covered' && along) return; // the gallery's own walls stand on these sides
            if (c.deck === 'balcony') {
              // A loggia: an open balustrade. Rail, plinth and balusters are one object.
              b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'balustrade' }, () => {
                const zc = 1 - pT / 2, top = H + 0.27;
                b.box([-eL, H, 1 - pT], [1 + eR, H + 0.04, 1], { skip: ['bottom', ...(stopL ? [] : ['w' as const]), ...(stopR ? [] : ['e' as const])] });
                b.box([-eL, top - 0.05, 1 - pT - 0.01], [1 + eR, top, 1 + 0.01], { skip: [...(stopL ? [] : ['w' as const]), ...(stopR ? [] : ['e' as const])] });
                for (const bx of [0.125, 0.375, 0.625, 0.875]) {
                  b.at(translation(bx, H + 0.04, zc), () => b.lathe([[0.022, 0], [0.036, 0.06], [0.02, 0.13], [0.026, 0.18]], { segments: 6 }));
                }
              });
              return;
            }
            const ends = (i: number): [number, number] => [i === 0 ? -eL : xs[i]!, i === n - 1 ? 1 + eR : xs[i + 1]!];
            b.with({ color: stone, pattern: PATTERN.stone, ink: 'parapet' }, () => {
              for (let i = 0; i < n; i++) {
                const [a, d] = ends(i);
                const ra = rise(xs[i]!), rd = rise(xs[i + 1]!);
                b.quad([a, H + ra, 1], [d, H + rd, 1], [d, H + rd + pH, 1], [a, H + ra + pH, 1]); // outside
                if (gate) b.quad([a, H + ra + pH, 1], [d, H + rd + pH, 1], [d, H + rd + pH, 1 - pT], [a, H + ra + pH, 1 - pT]); // top (a plain parapet's is under its coping)
                b.quad([d, H, 1 - pT], [a, H, 1 - pT], [a, H + ra + pH, 1 - pT], [d, H + rd + pH, 1 - pT]); // inside
              }
              if (stopL && !cornerL && eL === 0) b.quad([0, H, 1 - pT], [0, H, 1], [0, H + pH, 1], [0, H + pH, 1 - pT]);
              if (stopR && !cornerR && eR === 0) b.quad([1, H, 1], [1, H, 1 - pT], [1, H + pH, 1 - pT], [1, H + pH, 1]);
              if (gate) {
                // A crenellated crown: three merlons to a side.
                for (const mx of [0.09, 0.5, 0.91]) b.box([mx - 0.09, H + pH, 1 - pT], [mx + 0.09, H + pH + 0.11, 1], { skip: ['bottom'] });
              }
            });
            if (!gate) {
              // The coping: a flat stone course capping the parapet, a little wider than it.
              b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'coping' }, () => {
                const o = 0.018, ch = 0.035;
                for (let i = 0; i < n; i++) {
                  const [a0, d0] = ends(i);
                  const a = i === 0 && cornerL ? -o : a0, d = i === n - 1 && cornerR ? 1 + o : d0;
                  const ya = H + rise(xs[i]!) + pH, yd = H + rise(xs[i + 1]!) + pH;
                  b.quad([a, ya + ch, 1 + o], [d, yd + ch, 1 + o], [d, yd + ch, 1 - pT - o], [a, ya + ch, 1 - pT - o]);
                  b.quad([a, ya, 1 + o], [d, yd, 1 + o], [d, yd + ch, 1 + o], [a, ya + ch, 1 + o]);
                  b.quad([d, yd, 1 - pT - o], [a, ya, 1 - pT - o], [a, ya + ch, 1 - pT - o], [d, yd + ch, 1 - pT - o]);
                }
                if (stopL && !cornerL && eL === 0) b.quad([0, H + pH, 1 - pT - o], [0, H + pH, 1 + o], [0, H + pH + ch, 1 + o], [0, H + pH + ch, 1 - pT - o]);
                if (stopR && !cornerR && eR === 0) b.quad([1, H + pH, 1 + o], [1, H + pH, 1 - pT - o], [1, H + pH + ch, 1 - pT - o], [1, H + pH + ch, 1 + o]);
              });
            }
          });
        }
      });
    }

    // ── features ──
    for (const f of plan.featuresByStructure.get(s.id) ?? []) {
      if (f.type === 'arch-opening' || f.type === 'pier') continue;
      const c = f.cell === undefined ? undefined : cells.get(f.cell);
      if (c && archExtras(b, anchors, f, c, { plan, stone, humped, cells, raking })) continue;
      if (c && f.type === 'railing' && f.dir !== undefined) {
        // A railing where the parapet already stands would double it.
        const side = SIDES.find((sd) => c.dir[sd] === f.dir);
        if (side && c.edge[side] && c.topOpen && c.walkable) continue;
      }
      const at = featureFrame(f);
      if (at) placeFeature(b, anchors, f, at, { plan, structure: s, parts });
    }
    return { mesh: b.build(), anchors };
  },
});
