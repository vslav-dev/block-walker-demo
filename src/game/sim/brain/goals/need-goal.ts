import { Consume } from '@game/sim/brain/actions/consume';
import { GATHER_REACH, Gather } from '@game/sim/brain/actions/gather';
import { MoveTo } from '@game/sim/brain/actions/move-to';
import { Search } from '@game/sim/brain/actions/search';
import type { Goal } from '@game/sim/brain/goal';
import type { Creature } from '@game/sim/creature';
import { itemsRelieving } from '@game/sim/items';
import { NEEDS, type NeedId } from '@game/sim/needs';
import { nodeKindsGiving } from '@game/sim/nodes';
import { nearestNode } from '@game/sim/perception';
import type { Simulation } from '@game/sim/simulation';

// The goal of relieving a need, made from the need alone: it wants it as much as the need is urgent, and gets what relieves it
// from the inventory, or else from a node of the world that gives it, or else goes looking for such a node. A new need with
// its items and nodes needs no new goal, only a line in the goals of the kinds that have it.
export function needGoal(need: NeedId): Goal {
  const items = itemsRelieving(need);
  const sources = nodeKindsGiving(items);
  const seenSource = (self: Creature, sim: Simulation) => nearestNode(self, sim, (node) => node.ready && sources.has(node.kind));

  return {
    id: need,
    label: NEEDS[need].goal,
    score: (self) => self.needs.urgency(need),
    plan(self, sim) {
      if (self.inventory.firstOf(items) !== null) return [new Consume(need)];
      const source = seenSource(self, sim);
      if (source) return [new MoveTo(source.x, source.z, GATHER_REACH), new Gather(source.id), new Consume(need)];
      return [new Search((searcher, world) => seenSource(searcher, world) !== null)];
    },
  };
}
