import { ActionStatus, type Action } from '@game/sim/brain/action';
import { MoveTo } from '@game/sim/brain/actions/move-to';
import { placeAround } from '@game/sim/brain/places';
import type { Creature } from '@game/sim/creature';
import type { Simulation } from '@game/sim/simulation';

const LEG_DISTANCE = { min: 8, max: 16 }; // blocks: how far the next place to look from is
const LEG_REACH = 0.5;
const LEGS_MAX = 12; // so many places and nothing found: the search is given up

// Looks for something: goes from place to place, random ones, until `found` says it can be seen. Then it is done, and whoever
// planned it plans again, with the thing in sight.
export class Search implements Action {
  readonly label = 'Searching';
  readonly interruptible = true;
  failure?: string;
  private leg: MoveTo | null = null;
  private legs = 0;

  constructor(private readonly found: (self: Creature, sim: Simulation) => boolean) {}

  update(self: Creature, sim: Simulation, dt: number): ActionStatus {
    if (this.found(self, sim)) return ActionStatus.Done;
    // Whether the leg is done or stuck, the next place to look from is another one.
    if (this.leg && this.leg.update(self, sim, dt) === ActionStatus.Running) return ActionStatus.Running;
    this.leg = null;

    if (this.legs >= LEGS_MAX) {
      this.failure = 'nothing found';
      return ActionStatus.Failed;
    }
    const place = placeAround(self, sim, LEG_DISTANCE.min, LEG_DISTANCE.max);
    if (!place) {
      this.failure = 'nowhere to go';
      return ActionStatus.Failed;
    }
    this.legs++;
    this.leg = new MoveTo(place.x, place.z, LEG_REACH);
    return ActionStatus.Running;
  }
}
