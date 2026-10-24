import { StatId } from './stats';
import type { Creature } from './creature';
import type { ResourceNode } from './nodes';
import type { Simulation } from './simulation';

// What a creature sees of the nodes of the world: those within its sight radius. Walls do not hide anything yet; when they do,
// it is a change in this function and nowhere else.
export function nearestNode(self: Creature, sim: Simulation, accept: (node: ResourceNode) => boolean): ResourceNode | null {
  const radius = self.stats[StatId.SightRadius];
  let nearest: ResourceNode | null = null;
  let nearestDistance = radius;
  for (const node of sim.nodes) {
    const distance = Math.hypot(node.x - self.body.x, node.z - self.body.z);
    if (distance <= nearestDistance && accept(node)) {
      nearest = node;
      nearestDistance = distance;
    }
  }
  return nearest;
}
