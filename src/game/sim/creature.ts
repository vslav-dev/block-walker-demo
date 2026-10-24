import { Body } from '@game/character/body';
import { Brain } from '@game/sim/brain/brain';
import type { CreatureKind } from '@game/sim/creature-kind';
import type { EntityId } from '@game/sim/entity';
import { Inventory } from '@game/sim/items';
import { Needs } from '@game/sim/needs';
import type { Simulation } from '@game/sim/simulation';
import type { Stats } from '@game/sim/stats';
import type { Random } from '@game/world/random';
import type { World } from '@game/world/world';

const INITIAL_NEED = { min: 0.15, max: 0.45 }; // creatures made together are not all hungry at the same moment

// A living thing of the simulation, of any kind: a person, an animal. Its kind says what it is; what it is now is here.
// It acts through its brain, which sets where it means to go; the simulation moves its body.
export class Creature {
  readonly body: Body; // the same body the player has: a creature walks as the player does
  readonly stats: Stats;
  readonly needs: Needs;
  readonly inventory = new Inventory();
  readonly brain: Brain | null; // none: it is controlled from outside
  readonly velocity = { x: 0, z: 0 }; // blocks per second: where it means to go this step; the actions set it, and it is clear at the start of every step
  heading: number; // where it looks, radians as the yaw of the aim: atan2(x, z)

  constructor(
    readonly id: EntityId,
    readonly kind: CreatureKind,
    world: World,
    x: number,
    z: number,
    random: Random,
  ) {
    this.body = new Body(world, x, z);
    this.stats = kind.stats;
    this.needs = new Needs(kind.needs, () => INITIAL_NEED.min + random.rand() * (INITIAL_NEED.max - INITIAL_NEED.min));
    this.brain = kind.goals.length > 0 ? new Brain(kind.goals) : null;
    this.heading = random.rand() * 2 * Math.PI;
  }

  update(sim: Simulation, dt: number): void {
    this.needs.tick(dt);
    this.velocity.x = 0;
    this.velocity.z = 0;
    this.brain?.update(this, sim, dt);
    this.body.update(dt, this.velocity.x, this.velocity.z);
    if (this.velocity.x !== 0 || this.velocity.z !== 0) this.heading = Math.atan2(this.velocity.x, this.velocity.z);
  }

  face(x: number, z: number): void {
    this.heading = Math.atan2(x - this.body.x, z - this.body.z);
  }
}
