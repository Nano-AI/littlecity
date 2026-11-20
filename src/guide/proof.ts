// Does a town hold what a guide entry promises? Used by the proof test (on
// the entry's own recipe) and by the guide panel's ticks (on the player's
// town). Pure: plans in, answers out.

import type { DressingPlan, ShapePlan } from '@/resolve/plan';
import type { Proof } from './entries';

/** What a town contains, worked out once per plan so each entry is a cheap lookup. */
export interface TownContents {
  roles: ReadonlySet<string>;
  /** Kinds the town's Auto blocks resolved to. */
  autoKinds: ReadonlySet<string>;
  /** `rule` and `rule|type` of every prop, and `actor:rule`, `actor:rule|type` of every actor; null until the dressing is known. */
  props: ReadonlySet<string> | null;
}

export function contentsOf(shape: ShapePlan, dressing: DressingPlan | null): TownContents {
  const roles = new Set<string>();
  for (const r of shape.roles.values()) roles.add(r.role);
  const autoKinds = new Set<string>();
  for (const [cell, block] of shape.world.blocks) {
    if (block.kind !== 'auto') continue;
    const kind = shape.kinds.get(cell);
    if (kind) autoKinds.add(kind);
  }
  return { roles, autoKinds, props: dressing ? propsOf(dressing) : null };
}

export function propsOf(dressing: DressingPlan): ReadonlySet<string> {
  const props = new Set<string>();
  for (const p of dressing.props) {
    props.add(p.rule);
    props.add(`${p.rule}|${p.type}`);
  }
  for (const a of dressing.actors) {
    props.add(`actor:${a.rule}`);
    props.add(`actor:${a.rule}|${a.type}`);
  }
  for (const s of dressing.sockets) props.add(`socket:${s.rule}`);
  return props;
}

/** True when the town holds it, false when it does not, null when it cannot be told yet (no dressing). */
export function holds(proof: Proof, town: TownContents): boolean | null {
  if ('role' in proof) return town.roles.has(proof.role);
  if ('autoKinds' in proof) return proof.autoKinds.every((k) => town.autoKinds.has(k));
  if (!town.props) return null;
  if ('socket' in proof) return town.props.has(`socket:${proof.socket.rule}`);
  if ('actor' in proof) return town.props.has(`actor:${proof.actor.rule}${proof.actor.type ? `|${proof.actor.type}` : ''}`);
  return town.props.has(proof.prop.type ? `${proof.prop.rule}|${proof.prop.type}` : proof.prop.rule);
}
