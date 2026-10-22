import type { PlayerBody } from '@game/character/player-body';
import { Block, STOREY_H, StairDir, Top, WALL_SIDES, WallSide, isStairs, type WallSideInfo } from '@game/world/blocks';
import { World } from '@game/world/world';

// Worlds and helpers for the tests.

export const DT = 1 / 60;
export const SEEDS = [1, 2, 3, 42, 777];

export function flatWorld(): World {
  const world = new World(8, 8, 8);
  for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) world.setTop(x, 0, z, Top.Grass);
  return world;
}

// A wall along the west edge of column 4, with a doorway at z=6.
export function wallWorld(): World {
  const world = flatWorld();
  for (let z = 0; z < 8; z++) for (let j = 1; j <= 3; j++) world.addWalls(4, j, z, WallSide.West);
  world.removeWalls(4, 1, 6, WallSide.West);
  world.removeWalls(4, 2, 6, WallSide.West);
  return world;
}

export function walk(body: PlayerBody, vx: number, vz: number, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) body.update(DT, vx, vz);
}

// A staircase: its first (lowest) step, the direction it rises to, the wall it is docked to and its stairwell,
// the cells of the landing at the foot and of the flight.
export interface Staircase {
  x: number;
  z: number;
  dir: { x: number; z: number };
  wall: WallSideInfo;
  cells: { x: number; z: number }[];
}

// Every staircase of the world.
export function staircases(world: World): Staircase[] {
  const found: Staircase[] = [];
  for (let z = 0; z < world.sizeZ; z++) {
    for (let x = 0; x < world.sizeX; x++) {
      const id = world.get(x, 1, z);
      if (!isStairs(id)) continue;
      const dir = StairDir[id - Block.Stairs];
      const wall = WALL_SIDES.find((side) => (world.getWalls(x, 1, z) & side.bit) !== 0)!;
      const cells = Array.from({ length: STOREY_H + 1 }, (_, i) => ({ x: x + dir.x * (i - 1), z: z + dir.z * (i - 1) }));
      found.push({ x, z, dir, wall, cells });
    }
  }
  return found;
}

// A point on the ground floor in front of the stairs, `offset` blocks away from the wall they are docked to.
export function atFootOfStairs({ x, z, dir, wall }: Staircase, offset: number): { x: number; z: number } {
  const foot = { x: x - dir.x + 0.5, z: z - dir.z + 0.5 };
  if (wall.dz !== 0) foot.z = (wall.dz < 0 ? z : z + 1) - wall.dz * offset;
  else foot.x = (wall.dx < 0 ? x : x + 1) - wall.dx * offset;
  return foot;
}
