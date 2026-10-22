import { Block, STOREY_H, Top } from '@game/world/blocks';
import type { RandomInt } from '@game/world/random';
import type { World } from '@game/world/world';
import { wallCell, wallLength, type BuildingPlan, type Cell } from './plan';

// Stairs run along a wall: a flight of STOREY_H cells with a landing at each end, and a corner cell beyond each landing.
export const STAIRS_WALL_MIN = STOREY_H + 4;

// Solid stairs in the cells of a random wall, rising along it in a random direction, docked to the wall.
// The upper floor has a hole above them, and its last step is level with it. The hole reaches over the landing at the
// foot too: a step is as high as it is long, so a head 1.7 blocks high meets a floor 2 blocks up before the stairs
// are under the hole. Returns the cells of the stairwell, the landing at the foot and the flight: the wall behind them stays whole.
export function buildStairs(world: World, plan: BuildingPlan, int: RandomInt): Cell[] {
  const index = int(0, 3);
  const first = int(2, wallLength(plan, index) - STOREY_H - 2); // u of the lowest u of the flight
  const rising = int(0, 1) === 1; // towards higher u
  const direction = (index < 2 ? 0 : 1) + (rising ? 0 : 2); // in StairDir order: +x, +z, -x, -z
  const cellAt = (step: number): Cell => wallCell(plan, index, rising ? first + step : first + STOREY_H - 1 - step); // step -1 = the landing at the foot
  const foot = cellAt(-1);
  world.setTop(foot.x, STOREY_H, foot.z, Top.None);
  const cells = [foot];
  for (let step = 0; step < STOREY_H; step++) {
    const { x, z } = cellAt(step);
    for (let j = 1; j <= step; j++) world.set(x, j, z, Block.Planks);
    world.set(x, 1 + step, z, Block.Stairs + direction);
    world.setTop(x, STOREY_H, z, Top.None);
    cells.push({ x, z });
  }
  return cells;
}
