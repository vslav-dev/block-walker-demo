import { STOREY_H, Top, WallSide } from '@game/world/blocks';
import type { RandomInt } from '@game/world/random';
import type { World } from '@game/world/world';
import { openDoorway } from './openings';
import type { BuildingPlan } from './plan';

// The shell of a building: the number of the building on its columns, a floor under every storey, the walls of every storey
// on the outline and the roof over the highest one. Openings are made later.
export function raiseShell(world: World, id: number, { x0, z0, w, d, storeys }: BuildingPlan): void {
  const x1 = x0 + w - 1;
  const z1 = z0 + d - 1;
  const roofY = storeys * STOREY_H; // the roof is the top slab of the highest cell of the walls

  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      world.setBuilding(x, z, id);
      const sides =
        (z === z0 ? WallSide.North : 0) | (z === z1 ? WallSide.South : 0) | (x === x0 ? WallSide.West : 0) | (x === x1 ? WallSide.East : 0);
      for (let s = 0; s < storeys; s++) {
        const base = s * STOREY_H; // the floor of the storey is the top slab of this cell, the walls are above it
        world.setTop(x, base, z, Top.Planks);
        for (let j = 1; j <= STOREY_H; j++) world.addWalls(x, base + j, z, sides);
      }
      world.setTop(x, roofY, z, Top.Roof);
    }
  }
}

// A wall inside a building, on the ground floor, on the border of cells: a vertical one is the west edge of the column `line`,
// a horizontal one the north edge of the row `line`. It runs over the cells from `from` to `to` (inclusive) along itself.
export interface Partition {
  vertical: boolean;
  line: number;
  from: number;
  to: number;
}

// The cell of a partition at the distance t along it.
const partitionCell = ({ vertical, line }: Partition, t: number) => (vertical ? { x: line, z: t } : { x: t, z: line });

// Raises the partition, whole from wall to wall, with no doorway yet.
export function raisePartition(world: World, partition: Partition): void {
  const side = partition.vertical ? WallSide.West : WallSide.North;
  for (let t = partition.from; t <= partition.to; t++) {
    const { x, z } = partitionCell(partition, t);
    for (let j = 1; j <= STOREY_H; j++) world.addWalls(x, j, z, side);
  }
}

// Is the cell at the distance t along the partition free of walls that meet the partition at either of its edges? Next to
// such a wall a doorway would be only a tenth wide for the body: it is 0.8 wide against walls and the doorway is 1.
export function isDoorwayClear(world: World, { vertical, line }: Partition, t: number): boolean {
  const walls = (x: number, z: number): number => world.getWalls(x, 1, z);
  // The cells on both sides of the partition, and at both edges of the cell the walls that run across the partition.
  return [line - 1, line].every((across) =>
    vertical
      ? ((walls(across, t) & WallSide.North) | (walls(across, t - 1) & WallSide.South) | (walls(across, t + 1) & WallSide.North) | (walls(across, t) & WallSide.South)) === 0
      : ((walls(t, across) & WallSide.West) | (walls(t - 1, across) & WallSide.East) | (walls(t + 1, across) & WallSide.West) | (walls(t, across) & WallSide.East)) === 0,
  );
}

// Opens a doorway in the partition, not in its end cells: there it would be right next to the wall that the partition meets.
// The cells that `isClear` takes are preferred, if there are any. Returns where the doorway is, as a distance along the partition.
export function openPartitionDoorway(world: World, partition: Partition, int: RandomInt, isClear: (t: number) => boolean = () => true): number {
  const side = partition.vertical ? WallSide.West : WallSide.North;
  const cells = Array.from({ length: partition.to - partition.from - 1 }, (_, i) => partition.from + 1 + i);
  const clear = cells.filter(isClear);
  const candidates = clear.length > 0 ? clear : cells;
  const doorway = candidates[int(0, candidates.length - 1)];
  const { x, z } = partitionCell(partition, doorway);
  openDoorway(world, x, z, side);
  return doorway;
}

// Builds the partition: raises it and opens a doorway in it. Returns where the doorway is, as a distance along the partition.
export function buildPartition(world: World, partition: Partition, int: RandomInt): number {
  raisePartition(world, partition);
  return openPartitionDoorway(world, partition, int);
}
