import type { Creature } from '@game/sim/creature';
import type { Simulation } from '@game/sim/simulation';

const ATTEMPTS = 8;
const EDGE_MARGIN = 1.5; // blocks: places nearer to the edge of the world are not chosen

// A place a creature can stand on, a random distance from min to max away from where it is, in a random direction; null if a few
// tries find none (it is in a corner and the direction was bad each time).
export function placeAround(self: Creature, sim: Simulation, min: number, max: number): { x: number; z: number } | null {
  const { world, random } = sim;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const angle = random.rand() * 2 * Math.PI;
    const distance = min + random.rand() * (max - min);
    const x = self.body.x + Math.sin(angle) * distance;
    const z = self.body.z + Math.cos(angle) * distance;
    const inside = x > EDGE_MARGIN && z > EDGE_MARGIN && x < world.sizeX - EDGE_MARGIN && z < world.sizeZ - EDGE_MARGIN;
    if (inside && world.groundAt(x, z, self.body.y) !== null) return { x, z };
  }
  return null;
}
