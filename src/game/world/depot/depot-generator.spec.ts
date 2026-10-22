import { GRID_STEP, SEEDS, floodFill } from '@game/testing/worlds';
import { Opening, STOREY_H, Top, WallSide, frameOpening, frameSide } from '@game/world/blocks';
import type { World } from '@game/world/world';
import { generateDepot } from './depot-generator';

// The sides of the cell that are on the outline of the world, which is the outer wall of the hall.
function outerSides(world: World, x: number, z: number): number {
  return (
    (z === 0 ? WallSide.North : 0) | (z === world.sizeZ - 1 ? WallSide.South : 0) | (x === 0 ? WallSide.West : 0) | (x === world.sizeX - 1 ? WallSide.East : 0)
  );
}

// Every doorway of the ground floor: the frame of a door, in the lowest row.
function doorways(world: World): { x: number; z: number; side: number }[] {
  const found = [];
  for (let z = 0; z < world.sizeZ; z++) {
    for (let x = 0; x < world.sizeX; x++) {
      const frame = world.getFrame(x, 1, z);
      if (frame !== 0 && frameOpening(frame) === Opening.Door) found.push({ x, z, side: frameSide(frame) });
    }
  }
  return found;
}

describe('generateDepot', () => {
  it('the world is exactly the hall: one building on every column, a floor everywhere, a roof over all, no entrance', () => {
    for (const seed of SEEDS) {
      const { world } = generateDepot(seed);
      expect(world.sizeX, `seed ${seed}`).toBeGreaterThanOrEqual(30);
      for (let z = 0; z < world.sizeZ; z++) {
        for (let x = 0; x < world.sizeX; x++) {
          expect(world.buildingAt(x, z)).toBe(1);
          expect(world.getTop(x, 0, z), 'a floor').toBe(Top.Planks);
          expect(world.getTop(x, STOREY_H, z), 'a roof').toBe(Top.Roof);
        }
      }
      expect(world.doors, 'nobody enters from outside: there is no outside').toEqual([]);
    }
  });

  it('the outer wall is whole all the way round, in every row: no windows, no doorways', () => {
    for (const seed of SEEDS) {
      const { world } = generateDepot(seed);
      for (let z = 0; z < world.sizeZ; z++) {
        for (let x = 0; x < world.sizeX; x++) {
          const outer = outerSides(world, x, z);
          for (let y = 1; y <= STOREY_H; y++) expect(world.getWalls(x, y, z) & outer, `seed ${seed}: row ${y} at (${x}, ${z})`).toBe(outer);
        }
      }
    }
  });

  it('there are no windows at all: no frame of a window anywhere', () => {
    for (const seed of SEEDS) {
      const { world } = generateDepot(seed);
      expect(world.frames.some((frame) => frame !== 0 && frameOpening(frame) === Opening.Window), `seed ${seed}`).toBe(false);
    }
  });

  it('the inside is divided by walls with doorways, framed and as high as the wall, none of them in the outer wall', () => {
    for (const seed of SEEDS) {
      const { world } = generateDepot(seed);
      const found = doorways(world);
      expect(found.length, `seed ${seed}: several rooms`).toBeGreaterThanOrEqual(2);
      for (const { x, z, side } of found) {
        expect(outerSides(world, x, z) & side, `the doorway (${x}, ${z}) is inside`).toBe(0);
        for (let y = 1; y <= STOREY_H; y++) expect(world.getWalls(x, y, z) & side, `gap at y=${y}`).toBe(0);
      }
    }
  });

  it('every room is connected: the body gets from where it starts to every cell of the hall', () => {
    for (const seed of SEEDS) {
      const { world, spawn } = generateDepot(seed);
      const { nx, reached } = floodFill(world, spawn);
      // A cell is reached if the body can stand at some point of it: beside a wall the middle of the cell is too close to it.
      const pointsPerCell = Math.round(1 / GRID_STEP);
      const cellReached = (x: number, z: number) => {
        for (let k = 0; k < pointsPerCell; k++) {
          for (let i = 0; i < pointsPerCell; i++) {
            if (reached[x * pointsPerCell + i + (z * pointsPerCell + k) * nx]) return true;
          }
        }
        return false;
      };
      for (let z = 0; z < world.sizeZ; z++) {
        for (let x = 0; x < world.sizeX; x++) expect(cellReached(x, z), `seed ${seed}: the cell (${x}, ${z}) cannot be reached`).toBe(true);
      }
    }
  });
});
