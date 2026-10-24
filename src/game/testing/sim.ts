import { Simulation } from '@game/sim/simulation';
import { SceneId, generateWorld } from '@game/world/generator';
import type { Population } from '@game/world/population';
import type { World } from '@game/world/world';

// Simulations and helpers for the tests.

export const SIM_DT = 1 / 30; // one step of the simulation per call: no frame's worth of time is needed to see how lives go

export function plainfieldSim(seed: number): Simulation {
  const { world, population } = generateWorld(SceneId.Plainfield, seed);
  return new Simulation(world, population, seed);
}

export function simOf(world: World, population: Partial<Population>, seed = 1): Simulation {
  return new Simulation(world, { nodes: [], creatures: [], ...population }, seed);
}

// Lets the time pass, `each` is called after every step.
export function runFor(sim: Simulation, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += SIM_DT) {
    sim.update(SIM_DT);
    each?.();
  }
}
