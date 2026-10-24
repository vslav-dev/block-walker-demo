import { ActionStatus, type Action } from '@game/sim/brain/action';
import type { Creature } from '@game/sim/creature';
import { EventType } from '@game/sim/event-log';
import { ITEMS, itemsRelieving, type ItemId } from '@game/sim/items';
import { NEEDS, type NeedId } from '@game/sim/needs';
import type { Simulation } from '@game/sim/simulation';

const CONSUME_SECONDS = 1.5; // for one item

// Uses up the items that relieve a need, one at a time, until the need is down to sated or the items are gone.
export class Consume implements Action {
  readonly label: string;
  readonly interruptible = false; // an item half eaten is eaten
  failure?: string;
  private readonly items: readonly ItemId[];
  private elapsed = 0;
  private used = 0;

  constructor(private readonly need: NeedId) {
    this.label = NEEDS[need].action;
    this.items = itemsRelieving(need);
  }

  update(self: Creature, sim: Simulation, dt: number): ActionStatus {
    if (self.needs.level(this.need) <= NEEDS[this.need].sated) return ActionStatus.Done;
    const item = self.inventory.firstOf(this.items);
    if (item === null) {
      if (this.used > 0) return ActionStatus.Done; // ate what there was, and the plan goes on from there
      this.failure = 'nothing to use';
      return ActionStatus.Failed;
    }
    this.elapsed += dt;
    if (this.elapsed < CONSUME_SECONDS) return ActionStatus.Running;

    this.elapsed = 0;
    this.used++;
    self.inventory.take(item);
    self.needs.relieve(this.need, ITEMS[item].relieves!.amount);
    sim.log(self.id, EventType.Ate, `${ITEMS[item].label}, ${NEEDS[this.need].label.toLowerCase()} now ${self.needs.level(this.need).toFixed(2)}`);
    return ActionStatus.Running;
  }
}
