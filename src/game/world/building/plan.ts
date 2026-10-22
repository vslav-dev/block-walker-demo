import { WALL_SIDES } from '@game/world/blocks';
import type { RandomInt } from '@game/world/random';

// What every building of every scene is made of: a rectangle of cells with walls on its outline.

export interface Cell {
  x: number;
  z: number;
}

// A cell of a wall and the WallSide of the slab that sits in it.
export interface WallCell extends Cell {
  side: number;
}

// The footprint of a building, x0..x0 + w - 1 by z0..z0 + d - 1 cells, and its number of storeys.
export interface BuildingPlan {
  x0: number;
  z0: number;
  w: number;
  d: number;
  storeys: number;
}

export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.z === b.z;

// A wall is addressed by its index in WALL_SIDES (0 = north, 1 = south, 2 = west, 3 = east) and a cell on it by the
// distance u from its first corner: 0..length - 1 towards +x on the north and south walls, towards +z on the others.
export const wallLength = ({ w, d }: BuildingPlan, index: number): number => (index < 2 ? w : d);

export function wallCell({ x0, z0, w, d }: BuildingPlan, index: number, u: number): Cell {
  if (index === 0) return { x: x0 + u, z: z0 };
  if (index === 1) return { x: x0 + u, z: z0 + d - 1 };
  if (index === 2) return { x: x0, z: z0 + u };
  return { x: x0 + w - 1, z: z0 + u };
}

// Random cell on a random wall, corners excluded. `side` is the WallSide of the slab that sits in this cell.
export function randomWallCell(plan: BuildingPlan, int: RandomInt): WallCell {
  const index = int(0, 3);
  return { ...wallCell(plan, index, int(1, wallLength(plan, index) - 2)), side: WALL_SIDES[index].bit };
}
