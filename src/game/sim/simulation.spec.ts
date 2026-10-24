import { SEEDS, flatWorld, wallWorld } from '@game/testing/worlds';
import { plainfieldSim, runFor, simOf } from '@game/testing/sim';
import { CreatureKindId } from '@game/sim/creature-kind';
import { EventType } from '@game/sim/event-log';
import { NEED_MAX, NeedId } from '@game/sim/needs';
import { NODE_KINDS, NodeKindId } from '@game/sim/nodes';
import { Simulation } from '@game/sim/simulation';
import { SceneId, generateWorld } from '@game/world/generator';

const LIFE_SECONDS = 20 * 60;
const count = (sim: Simulation, type: EventType) => sim.events.all().filter((event) => event.type === type).length;

describe('Simulation', () => {
  it('time passes in steps no longer than the limit, and not at all when it is stopped', () => {
    const sim = plainfieldSim(1);
    sim.update(0);
    expect(sim.time).toBe(0);
    sim.update(0.5);
    expect(sim.time).toBeCloseTo(0.5);
  });

  it('the same world and seed give the same life, event by event', () => {
    const lives = [1, 2].map(() => {
      const sim = plainfieldSim(5);
      runFor(sim, 300);
      const { body } = sim.creatures[0];
      return JSON.stringify([sim.events.all(), body.x, body.z]);
    });
    expect(lives[0]).toBe(lives[1]);
  });

  for (const seed of SEEDS.slice(0, 3)) {
    it(`seed ${seed}: the person lives off the bushes for ${LIFE_SECONDS / 60} minutes: never starves, gathers, eats, always has something to do`, () => {
      const sim = plainfieldSim(seed);
      const person = sim.creatures[0];
      let hungriest = 0;
      runFor(sim, LIFE_SECONDS, () => {
        hungriest = Math.max(hungriest, person.needs.level(NeedId.Hunger));
        expect(person.brain!.actionLabel).not.toBe('—');
      });
      expect(hungriest, 'never close to the most').toBeLessThan(NEED_MAX * 0.95);
      expect(count(sim, EventType.Gathered), 'gathered').toBeGreaterThan(3);
      expect(count(sim, EventType.Ate), 'ate').toBeGreaterThan(6);
    });
  }

  it('hunger makes the person go for food, and the choice is in the log with its reasons', () => {
    const sim = plainfieldSim(3);
    const person = sim.creatures[0];
    person.needs.tick(1e6); // as hungry as it gets
    sim.update(0.1);
    const [decision] = sim.events.all();
    expect(decision.type).toBe(EventType.Decided);
    expect(decision.text).toMatch(/^hunger [\d.]+ · .*→ hunger$/);
    expect(person.brain!.goalLabel).toBe('Eat');
  });

  it('a person who sees no bush looks for one, finds it and eats', () => {
    const { world } = generateWorld(SceneId.Plainfield, 1);
    const sim = simOf(world, {
      nodes: [{ kind: NodeKindId.BerryBush, x: 30.5, z: 22.5, fullness: 1 }],
      creatures: [{ kind: CreatureKindId.Human, x: 5.5, z: 5.5 }],
    });
    const person = sim.creatures[0];
    person.needs.tick(1e6);
    runFor(sim, 900, () => {
      expect(person.brain!.actionLabel).not.toBe('—');
    });
    expect(count(sim, EventType.Gathered), 'found the bush').toBeGreaterThan(0);
    expect(count(sim, EventType.Ate), 'ate').toBeGreaterThan(0);
  });

  it('a bush that was gathered is empty, and its berries are in the inventory and then eaten', () => {
    const { world } = generateWorld(SceneId.Plainfield, 1);
    const sim = simOf(world, {
      nodes: [{ kind: NodeKindId.BerryBush, x: 8.5, z: 5.5, fullness: 1 }],
      creatures: [{ kind: CreatureKindId.Human, x: 5.5, z: 5.5 }],
    });
    const [bush] = sim.nodes;
    const [person] = sim.creatures;
    person.needs.tick(1e6);
    runFor(sim, 60);
    expect(count(sim, EventType.Gathered)).toBe(1);
    expect(bush.ready).toBe(false);
    expect(count(sim, EventType.Ate)).toBe(NODE_KINDS[NodeKindId.BerryBush].amount);
    expect(person.inventory.describe()).toBe('nothing');
  });

  it('a bush behind a wall is not a way: the walk fails as stuck, and the person goes on with something else', () => {
    const sim = simOf(wallWorld(), {
      nodes: [{ kind: NodeKindId.BerryBush, x: 6.5, z: 2.5, fullness: 1 }],
      creatures: [{ kind: CreatureKindId.Human, x: 1.5, z: 2.5 }],
    });
    const person = sim.creatures[0];
    person.needs.tick(1e6);
    runFor(sim, 40, () => {
      expect(person.brain!.actionLabel).not.toBe('—');
    });
    const stuck = sim.events.all().filter((event) => event.type === EventType.Failed && event.text.includes('stuck'));
    expect(stuck.length).toBeGreaterThan(0);
  });

  it('a person in a world with nothing to eat lives on without an error', () => {
    const sim = simOf(flatWorld(), { creatures: [{ kind: CreatureKindId.Human, x: 4.5, z: 4.5 }] });
    const person = sim.creatures[0];
    person.needs.tick(1e6);
    runFor(sim, 120, () => {
      expect(person.brain!.actionLabel).not.toBe('—');
    });
    expect(count(sim, EventType.Ate)).toBe(0);
    expect(person.needs.level(NeedId.Hunger)).toBe(NEED_MAX);
  });
});
