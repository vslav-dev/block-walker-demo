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

// Builds the partition, whole from wall to wall, with a doorway in it, not in its end cells: there it would be right
// next to the wall that the partition meets. Returns where the doorway is, as a distance along the partition.
export function buildPartition(world: World, partition: Partition, int: RandomInt): number {
  const side = partition.vertical ? WallSide.West : WallSide.North;
  for (let t = partition.from; t <= partition.to; t++) {
    const { x, z } = partitionCell(partition, t);
    for (let j = 1; j <= STOREY_H; j++) world.addWalls(x, j, z, side);
  }
  const doorway = int(partition.from + 1, partition.to - 1);
  const { x, z } = partitionCell(partition, doorway);
  openDoorway(world, x, z, side);
  return doorway;
}
