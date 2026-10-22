import { Opening, STOREY_H, WALL_SIDES, frameValue } from '@game/world/blocks';
import type { RandomInt } from '@game/world/random';
import type { World } from '@game/world/world';
import { wallCell, wallLength, type BuildingPlan, type WallCell } from './plan';

// A doorway on the ground floor: the slabs of both rows of the wall are taken out of the cell, nothing is felt of the door.
// The frame in it (lowest row) is drawn: posts, a header and a strip of wall over it, see DOOR_H.
export function openDoorway(world: World, x: number, z: number, side: number): void {
  for (let y = 1; y <= STOREY_H; y++) world.removeWalls(x, y, z, side);
  world.setFrame(x, 1, z, frameValue(side, Opening.Door));
}

// A window in a storey: the slab of the upper row is taken out of the cell, the lower one stays as the parapet. The frame
// (lowest row) is drawn from WINDOW_BOTTOM to WINDOW_TOP, which does not follow the rows.
export function openWindow(world: World, x: number, storey: number, z: number, side: number): void {
  const base = storey * STOREY_H;
  world.removeWalls(x, base + STOREY_H, z, side);
  world.setFrame(x, base + 1, z, frameValue(side, Opening.Window));
}

export interface WindowOptions {
  percent: number; // chance of a window in a wall cell, corners excluded
  min: number; // at least this many in the storey, so that no building is a dark box
  excluded?: (cell: WallCell) => boolean; // cells that must stay whole
}

// Windows in about `percent` of the wall cells of the outline of a storey and in at least `min` of them.
export function openRandomWindows(world: World, plan: BuildingPlan, storey: number, int: RandomInt, options: WindowOptions): void {
  const candidates: WallCell[] = [];
  for (let index = 0; index < WALL_SIDES.length; index++) {
    for (let u = 1; u < wallLength(plan, index) - 1; u++) {
      const cell: WallCell = { ...wallCell(plan, index, u), side: WALL_SIDES[index].bit };
      if (!options.excluded?.(cell)) candidates.push(cell);
    }
  }
  const windows = new Set(candidates.filter(() => int(1, 100) <= options.percent));
  while (windows.size < options.min) windows.add(candidates[int(0, candidates.length - 1)]);
  for (const cell of windows) openWindow(world, cell.x, storey, cell.z, cell.side);
}
