// DEMO FIXTURE, not a catalogue rule. A decoration rule: a lamp in front of
// half the doors, claiming the floor slot it stands on.
import { neighbor, NO_CELL } from '@/core/grid';
import { featuresOfType } from '@/resolve/facts/plan-index.fact';
import { defineRule, slot } from '@/resolve/engine/api';

export default defineRule({
  id: 'D-X01.demo-lamp',
  part: 'decoration',
  tier: 1,
  priority: 50,
  chance: 0.5,
  about: 'Reads: door features. Claims: the centre floor slot in front of the door.',
  find({ facts }) {
    return featuresOfType(facts, 'door')
      .map((door) => ({ door, front: neighbor(door.cell!, door.dir!) }))
      .filter(({ front }) => front !== NO_CELL)
      .map(({ door, front }) => ({ anchor: front, structure: door.structure }));
  },
  claims(c) {
    return [slot.floor(c.anchor, 'c')];
  },
  apply(c, out, { rand }) {
    const lamp = out.prop({ type: 'lamp', variant: rand('arms') < 0.2 ? 'four-arm' : 'post', at: { cell: c.anchor, pos: 'c' } });
    out.socket({ type: 'lamp-head', owner: lamp, cell: c.anchor });
  },
});
