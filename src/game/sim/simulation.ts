import { CREATURE_KINDS } from '@game/sim/creature-kind';
import { Creature } from '@game/sim/creature';
import type { EntityId } from '@game/sim/entity';
import { EventLog, type EventType } from '@game/sim/event-log';
import { ResourceNode } from '@game/sim/nodes';
import { createRandom, type Random } from '@game/world/random';
import type { Population } from '@game/world/population';
import type { World } from '@game/world/world';

const MAX_STEP_SECONDS = 1 / 30; // a longer stretch is taken in equal steps no longer than this: a normal frame is one step
const SEED_SHIFT = 0x5eed; // the chance of the simulation is not the chance that made the world

// The life that goes on in a world: the creatures and the nodes of the world they live off. It is pure logic: it knows nothing of
// the screen, and its only input is time. The same world, population and seed give the same life for the same steps of time.
export class Simulation {
  readonly random: Random;
  readonly events = new EventLog();
  readonly creatures: Creature[] = [];
  readonly nodes: ResourceNode[] = [];
  time = 0; // seconds
  private nextId = 1;
  private readonly nodesById = new Map<EntityId, ResourceNode>();

  constructor(
    readonly world: World,
    population: Population,
    seed: number,
  ) {
    this.random = createRandom(seed + SEED_SHIFT);
    for (const { kind, x, z, fullness } of population.nodes) {
      const node = new ResourceNode(this.nextId++, kind, x, z, fullness);
      this.nodes.push(node);
      this.nodesById.set(node.id, node);
    }
    for (const { kind, x, z } of population.creatures) {
      this.creatures.push(new Creature(this.nextId++, CREATURE_KINDS[kind], world, x, z, this.random));
    }
  }

  node(id: EntityId): ResourceNode | undefined {
    return this.nodesById.get(id);
  }

  // Lets `seconds` of time pass.
  update(seconds: number): void {
    const steps = Math.ceil(seconds / MAX_STEP_SECONDS - 1e-9);
    for (let step = 0; step < steps; step++) this.tick(seconds / steps);
  }

  log(who: EntityId, type: EventType, text: string): void {
    this.events.push({ time: this.time, who, type, text });
  }

  private tick(dt: number): void {
    this.time += dt;
    for (const node of this.nodes) node.update(dt);
    for (const creature of this.creatures) creature.update(this, dt);
  }
}
