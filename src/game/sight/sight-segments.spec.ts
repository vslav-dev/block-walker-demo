import { polygonContains as contains } from '@game/testing/geometry';
import { SEEDS } from '@game/testing/worlds';
import { Block, WallSide } from '@game/world/blocks';
import { generateDepot } from '@game/world/depot/depot-generator';
import { World } from '@game/world/world';
import { sightSegments } from './sight-segments';
import { visibilityPolygon } from './visibility-polygon';

const ROW = 2; // the row of the eyes on the ground floor
const RANGE = 60;

// A hall of 10 by 10 cells, split by a wall on the west border of the column 5 over both rows of the storey, with a doorway at z = 4.
function splitHall(): World {
  const world = new World(10, 4, 10);
  for (let z = 0; z < 10; z++) for (let row = 1; row <= 2; row++) if (z !== 4) world.addWalls(5, row, z, WallSide.West);
  return world;
}

const seenFrom = (world: World, x: number, z: number) => visibilityPolygon(sightSegments(world, ROW), x, z, RANGE);

describe('sightSegments', () => {
  it('a wall stops the sight, a doorway does not: what is behind the wall is out of sight, and what is behind the doorway, in a cone', () => {
    const world = splitHall();
    const seen = seenFrom(world, 2.5, 1.5);
    expect(contains(seen, 2.5, 8.5), 'on its own side').toBe(true);
    expect(contains(seen, 7.5, 1.5), 'behind the wall').toBe(false);
    expect(contains(seen, 7.5, 8.5), 'behind the wall, farther').toBe(false);
    expect(contains(seenFrom(world, 2.5, 4.5), 7.5, 4.5), 'straight through the doorway').toBe(true);
    expect(contains(seenFrom(world, 2.5, 4.5), 7.5, 0.5), 'not beside the doorway').toBe(false);
  });

  it('the slab of a wall is seen from the side where the player is, whichever side of the border it stands on: the near face is in, the far face out', () => {
    const world = splitHall(); // the slab of the west border of the column 5 stands in the column 5: from 5 to 5.1
    const fromWest = seenFrom(world, 2.5, 1.5);
    expect(contains(fromWest, 4.99, 1.5), 'the face to the player, on the border').toBe(true);
    expect(contains(fromWest, 5.09, 1.5), 'the face from the player, in the slab').toBe(false);
    const fromEast = seenFrom(world, 7.5, 1.5);
    expect(contains(fromEast, 5.09, 1.5), 'the face to the player, 0.1 from the border').toBe(true);
    expect(contains(fromEast, 4.99, 1.5), 'the face from the player').toBe(false);
  });

  it('in a closed room there is no gap to see out through, not at the corners either', () => {
    const world = new World(10, 4, 10);
    for (let z = 3; z < 7; z++) {
      for (let x = 3; x < 7; x++) {
        const sides = (z === 3 ? WallSide.North : 0) | (z === 6 ? WallSide.South : 0) | (x === 3 ? WallSide.West : 0) | (x === 6 ? WallSide.East : 0);
        for (let row = 1; row <= 2; row++) world.addWalls(x, row, z, sides);
      }
    }
    for (const [x, z] of [[4.5, 4.5], [3.4, 3.4], [6.6, 6.6], [3.4, 6.6], [6.6, 3.4]]) {
      const seen = seenFrom(world, x, z);
      for (let i = 0; i < seen.length; i += 2) {
        expect(seen[i] > 2.9 && seen[i] < 7.1 && seen[i + 1] > 2.9 && seen[i + 1] < 7.1, `from (${x}, ${z}): (${seen[i]}, ${seen[i + 1]})`).toBe(true);
      }
    }
  });

  it('in a closed room all of the faces of the walls that face the room are seen, up to the very corners of it', () => {
    const world = new World(10, 4, 10);
    for (let z = 3; z < 7; z++) {
      for (let x = 3; x < 7; x++) {
        const sides = (z === 3 ? WallSide.North : 0) | (z === 6 ? WallSide.South : 0) | (x === 3 ? WallSide.West : 0) | (x === 6 ? WallSide.East : 0);
        for (let row = 1; row <= 2; row++) world.addWalls(x, row, z, sides);
      }
    }
    // The faces are 0.1 from the borders: z = 3.1, z = 6.9, x = 3.1, x = 6.9.
    for (const [px, pz] of [[4.5, 4.5], [3.4, 3.4], [6.6, 6.6], [3.4, 6.6], [6.6, 3.4], [4.5, 6.6]]) {
      const seen = seenFrom(world, px, pz);
      for (const [x, z] of [[3.12, 3.12], [6.88, 3.12], [3.12, 6.88], [6.88, 6.88], [4.5, 3.12], [6.88, 4.5], [3.12, 4.5], [4.5, 6.88], [6.5, 3.15], [3.15, 6.5]]) {
        expect(contains(seen, x, z), `(${x}, ${z}) of the walls, seen from (${px}, ${pz})`).toBe(true);
      }
    }
  });

  it('a cube stops the sight, and its sides that face another cube are not walls', () => {
    const world = new World(10, 4, 10);
    world.set(5, ROW, 2, Block.Planks);
    world.set(6, ROW, 2, Block.Planks);
    const seen = seenFrom(world, 1.5, 2.5);
    expect(contains(seen, 8.5, 2.5), 'behind the cubes').toBe(false);
    expect(contains(seen, 8.5, 6.5), 'beside them').toBe(true);
    expect(sightSegments(world, ROW), 'a block of two is one outline of four stretches, not eight').toHaveLength(4);
  });

  it('the stretches of a wall are joined: a depot has a few dozen of them, not a few hundred', () => {
    for (const seed of SEEDS) {
      const { world } = generateDepot(seed);
      const segments = sightSegments(world, ROW);
      expect(segments.length, `seed ${seed}`).toBeGreaterThan(4);
      expect(segments.length, `seed ${seed}`).toBeLessThan(120);
    }
  });

  it('the outer wall of a depot is whole: nothing is seen beyond the hall, from wherever the player starts', () => {
    for (const seed of SEEDS) {
      const { world, spawn } = generateDepot(seed);
      const seen = visibilityPolygon(sightSegments(world, ROW), spawn.x, spawn.z, RANGE);
      for (let i = 0; i < seen.length; i += 2) {
        expect(seen[i] >= 0 && seen[i] <= world.sizeX && seen[i + 1] >= 0 && seen[i + 1] <= world.sizeZ, `seed ${seed}: (${seen[i]}, ${seen[i + 1]})`).toBe(true);
      }
    }
  });
});
