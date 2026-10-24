import { ActionStatus, type Action } from '@game/sim/brain/action';
import type { Creature } from '@game/sim/creature';
import type { EntityId } from '@game/sim/entity';
import { EventType } from '@game/sim/event-log';
import { ITEMS } from '@game/sim/items';
import type { Simulation } from '@game/sim/simulation';

export const GATHER_REACH = 1; // blocks from the node, where a creature goes to gather it
const GATHER_SLACK = 0.3; // how much farther it may be and still gather: the body is pushed a little by what it meets

// Gathers a node: takes time, then the node is empty and the items are in the inventory. If somebody else got there first or
// the creature is not by the node, it fails.
export class Gather implements Action {
  readonly label = 'Gathering';
  readonly interruptible = false; // half a gathering gives nothing
  failure?: string;
  private elapsed = 0;

  constructor(private readonly nodeId: EntityId) {}

  update(self: Creature, sim: Simulation, dt: number): ActionStatus {
    const node = sim.node(this.nodeId);
    if (!node?.ready) {
      this.failure = 'taken';
      return ActionStatus.Failed;
    }
    if (Math.hypot(node.x - self.body.x, node.z - self.body.z) > GATHER_REACH + GATHER_SLACK) {
      this.failure = 'too far';
      return ActionStatus.Failed;
    }
    self.face(node.x, node.z);
    this.elapsed += dt;
    if (this.elapsed < node.def.gatherSeconds) return ActionStatus.Running;

    const { item } = node.def;
    const amount = node.harvest();
    self.inventory.add(item, amount);
    sim.log(self.id, EventType.Gathered, `${amount} ${ITEMS[item].label} from ${node.def.label} #${node.id}`);
    return ActionStatus.Done;
  }
}
