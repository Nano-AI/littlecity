// Indexes over the finished shape plan, for dressing-stage rules: "every
// chimney-top socket", "every door". They read facts.shape, so roles and
// joinery rules cannot use them (they read ctx.plan directly).

import type { FeatureType, SocketType } from '@/core/vocab';
import type { Feature, FeatureOf, Socket } from '../plan';
import { defineFact, type Facts } from './api';

const socketIndex = defineFact('socketsByType', (f) => {
  const byType = new Map<SocketType, Socket[]>();
  for (const s of f.shape.sockets) {
    const list = byType.get(s.type);
    if (list) list.push(s);
    else byType.set(s.type, [s]);
  }
  return byType;
});

const featureIndex = defineFact('featuresByType', (f) => {
  const byType = new Map<FeatureType, Feature[]>();
  for (const feature of f.shape.features) {
    const list = byType.get(feature.type);
    if (list) list.push(feature);
    else byType.set(feature.type, [feature]);
  }
  return byType;
});

const socketsById = defineFact('socketsById', (f) => new Map(f.shape.sockets.map((s) => [s.id, s] as const)));

/** Shape-stage sockets of one type, in emission order. Dressing-stage rules only. */
export function socketsOfType(f: Facts, type: SocketType): readonly Socket[] {
  return socketIndex(f).get(type) ?? [];
}
/** Features of one type, in emission order. Dressing-stage rules only. */
export function featuresOfType<T extends FeatureType>(f: Facts, type: T): readonly FeatureOf<T>[] {
  return (featureIndex(f).get(type) ?? []) as unknown as readonly FeatureOf<T>[];
}
/** A shape-stage socket by id. Dressing-stage rules only. */
export function socketById(f: Facts, id: string): Socket | undefined {
  return socketsById(f).get(id);
}

export { socketIndex as socketsByType, featureIndex as featuresByType, socketsById };
