import { CreatureKindId } from '@game/sim/creature-kind';
import { NodeKindId } from '@game/sim/nodes';
import { Biome } from '@game/world/biome';
import { Top } from '@game/world/blocks';
import type { CreatureSpawn, NodeSpawn } from '@game/world/population';
import { createRandom } from '@game/world/random';
import { World, type GeneratedWorld } from '@game/world/world';

export const FIELD_SIZE = 56;
const WORLD_HEIGHT = 3; // nothing stands above the ground; a little air for the body
export const BUSHES = 30; // places tried for a berry bush (the field is wide, they all fit)
export const BUSH_SPACING = 3; // blocks between two bushes at least
export const SPAWN_CLEARING = 3; // blocks from the player's start where there is no bush
const BUSH_EDGE = 2; // cells from the edge of the field where there is no bush
const BUSH_ATTEMPTS = 20; // per bush
const BARE_CHANCE = 0.3; // a bush that has no berries at the start, and is growing them back
export const NPC_DISTANCE = { min: 6, max: 9 }; // blocks from the player's start

// The plainfield: nothing but grass and berry bushes, and a person who lives off them. Under the sky, with day and night.
// The player starts in the middle.
export function generatePlainfield(seed: number): GeneratedWorld {
  const { rand, int } = createRandom(seed);
  const world = new World(FIELD_SIZE, WORLD_HEIGHT, FIELD_SIZE);
  for (let z = 0; z < FIELD_SIZE; z++) {
    for (let x = 0; x < FIELD_SIZE; x++) world.setTop(x, 0, z, Top.Grass);
  }
  const start = { x: FIELD_SIZE / 2 + 0.5, z: FIELD_SIZE / 2 + 0.5 };

  const nodes: NodeSpawn[] = [];
  for (let n = 0; n < BUSHES * BUSH_ATTEMPTS && nodes.length < BUSHES; n++) {
    const x = int(BUSH_EDGE, FIELD_SIZE - 1 - BUSH_EDGE) + 0.5;
    const z = int(BUSH_EDGE, FIELD_SIZE - 1 - BUSH_EDGE) + 0.5;
    const free = nodes.every((bush) => Math.hypot(bush.x - x, bush.z - z) >= BUSH_SPACING);
    if (!free || Math.hypot(start.x - x, start.z - z) < SPAWN_CLEARING) continue;
    nodes.push({ kind: NodeKindId.BerryBush, x, z, fullness: rand() < BARE_CHANCE ? rand() * 0.95 : 1 });
  }

  const angle = rand() * 2 * Math.PI;
  const distance = NPC_DISTANCE.min + rand() * (NPC_DISTANCE.max - NPC_DISTANCE.min);
  const person: CreatureSpawn = {
    kind: CreatureKindId.Human,
    x: start.x + Math.sin(angle) * distance,
    z: start.z + Math.cos(angle) * distance,
  };

  return { world, spawn: start, biome: Biome.Surface, population: { nodes, creatures: [person] } };
}
