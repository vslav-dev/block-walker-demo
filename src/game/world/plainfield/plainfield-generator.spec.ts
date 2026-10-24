import { SEEDS } from '@game/testing/worlds';
import { Simulation } from '@game/sim/simulation';
import { Biome } from '@game/world/biome';
import { Top } from '@game/world/blocks';
import { BUSHES, BUSH_SPACING, FIELD_SIZE, NPC_DISTANCE, SPAWN_CLEARING, generatePlainfield } from './plainfield-generator';

describe('generatePlainfield', () => {
  it('is a field of grass under the sky, with no building and no light of its own', () => {
    const { world, biome } = generatePlainfield(1);
    expect(biome).toBe(Biome.Surface);
    expect(world.lights).toEqual([]);
    expect(world.doors).toEqual([]);
    expect(world.buildings.every((id) => id === 0)).toBe(true);
    expect(world.blocks.every((id) => id === 0)).toBe(true);
    for (let z = 0; z < FIELD_SIZE; z++) {
      for (let x = 0; x < FIELD_SIZE; x++) expect(world.getTop(x, 0, z)).toBe(Top.Grass);
    }
  });

  it('has bushes spaced apart, clear of the start, inside the field, some with berries and some without', () => {
    let ready = 0;
    let bare = 0;
    for (const seed of SEEDS) {
      const { population, spawn } = generatePlainfield(seed);
      const { nodes } = population;
      expect(nodes.length, `seed ${seed}`).toBe(BUSHES);
      for (const [i, bush] of nodes.entries()) {
        expect(bush.x > 1 && bush.z > 1 && bush.x < FIELD_SIZE - 1 && bush.z < FIELD_SIZE - 1).toBe(true);
        expect(Math.hypot(bush.x - spawn.x, bush.z - spawn.z)).toBeGreaterThanOrEqual(SPAWN_CLEARING);
        for (const other of nodes.slice(i + 1)) expect(Math.hypot(bush.x - other.x, bush.z - other.z)).toBeGreaterThanOrEqual(BUSH_SPACING);
        if (bush.fullness === 1) ready++;
        else bare++;
      }
    }
    expect(ready).toBeGreaterThan(bare);
    expect(bare).toBeGreaterThan(0);
  });

  it('puts one person near the start of the player, on the ground', () => {
    for (const seed of SEEDS) {
      const { world, population, spawn } = generatePlainfield(seed);
      expect(population.creatures, `seed ${seed}`).toHaveLength(1);
      const [person] = population.creatures;
      const distance = Math.hypot(person.x - spawn.x, person.z - spawn.z);
      expect(distance).toBeGreaterThanOrEqual(NPC_DISTANCE.min - 1e-9);
      expect(distance).toBeLessThanOrEqual(NPC_DISTANCE.max + 1e-9);
      expect(world.groundAt(person.x, person.z, 1)).toBe(1);
    }
  });

  it('can be lived in: the simulation takes its population', () => {
    for (const seed of SEEDS) {
      const { world, population } = generatePlainfield(seed);
      const sim = new Simulation(world, population, seed);
      expect(sim.nodes).toHaveLength(BUSHES);
      expect(sim.creatures).toHaveLength(1);
    }
  });
});
