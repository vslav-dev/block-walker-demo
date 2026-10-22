import { flatWorld } from '@game/testing/worlds';
import {
  Block,
  DOOR_H,
  FRAME_WIDTH,
  Opening,
  STAIR_STEPS,
  STOREY_H,
  WINDOW_BOTTOM,
  WINDOW_TOP,
  WallSide,
  frameValue,
} from './blocks';
import { BODY_H, EYE_H, type World } from './world';

describe('World.castRay', () => {
  it('a ray from the middle of the body stops at what is in the way, and at nothing else', () => {
    const y = 1 + BODY_H / 2; // the character stands on the ground plane
    const cast = (world: World, maxDist = 100) => world.castRay(1.5, y, 4.5, 1, 0, maxDist);
    const near = (actual: number, expected: number, message: string) => {
      expect(actual <= expected && actual > expected - 0.06, `${message}: ${actual} vs ${expected}`).toBe(true);
    };

    near(cast(flatWorld()), 6.5, 'the edge of the world');
    near(cast(flatWorld(), 3), 3, 'the range');

    const rock = flatWorld();
    rock.set(5, 1, 4, Block.Rock);
    near(cast(rock), 3.5, 'a cube, even one block high');

    const wall = flatWorld();
    wall.addWalls(3, 1, 4, WallSide.East);
    near(cast(wall), 2.5, 'a wall of the cell the ray leaves');
    const other = flatWorld();
    other.addWalls(4, 1, 4, WallSide.West);
    near(cast(other), 2.5, 'a wall of the cell the ray enters');

    const window = flatWorld();
    window.addWalls(4, 2, 4, WallSide.West);
    near(cast(window), 6.5, 'the ray passes under a window, a slab above it is no obstacle');

    const stairs = flatWorld();
    stairs.set(5, 1, 4, Block.Stairs); // rises to the east: the ray meets the step that is higher than it
    near(cast(stairs), 3.5 + (STAIR_STEPS - 1) / STAIR_STEPS, 'stairs'); // over the steps lower than the ray, at the last one
  });

  it('a ray goes through a doorway or a window only where it is clear: not through the frame, the wall over it or under it', () => {
    const floor = 1; // the plane of the ground floor
    const cast = (world: World, height: number) => world.castRay(1.5, floor + height, 4.5, 1, 0, 100);
    const stopped = (length: number) => length < 2.6; // the wall is at 2.5 from the start
    const wall = () => {
      const world = flatWorld();
      for (const y of [1, 2]) world.addWalls(4, y, 4, WallSide.West);
      return world;
    };

    const window = wall();
    window.removeWalls(4, 2, 4, WallSide.West);
    window.setFrame(4, 1, 4, frameValue(WallSide.West, Opening.Window));
    expect(stopped(cast(window, EYE_H)), 'the eyes see through the window').toBe(false);
    expect(stopped(cast(window, WINDOW_BOTTOM + FRAME_WIDTH / 2)), 'not through the sill').toBe(true);
    expect(stopped(cast(window, 0.3)), 'not through the wall under it').toBe(true);
    expect(stopped(cast(window, WINDOW_TOP - FRAME_WIDTH / 2)), 'not through the header').toBe(true);
    expect(stopped(cast(window, STOREY_H - 0.05)), 'not through the wall over it, though the slab of that row is gone').toBe(true);

    const door = wall();
    for (const y of [1, 2]) door.removeWalls(4, y, 4, WallSide.West);
    door.setFrame(4, 1, 4, frameValue(WallSide.West, Opening.Door));
    expect(!stopped(cast(door, EYE_H)) && !stopped(cast(door, 0.3)), 'through the doorway, high and low').toBe(true);
    expect(stopped(cast(door, DOOR_H + FRAME_WIDTH / 2)), 'not through the header').toBe(true);
    expect(stopped(cast(door, STOREY_H - 0.05)), 'not through the wall over it').toBe(true);

    const upper = flatWorld(); // the same on the upper storey: its floor is at 3
    for (const y of [3, 4]) upper.addWalls(4, y, 4, WallSide.West);
    upper.removeWalls(4, 4, 4, WallSide.West);
    upper.setFrame(4, 3, 4, frameValue(WallSide.West, Opening.Window));
    expect(upper.castRay(1.5, 3 + EYE_H, 4.5, 1, 0, 100), 'a window of the upper storey is as clear').toBeGreaterThanOrEqual(2.6);
    expect(upper.castRay(1.5, 3 + 0.3, 4.5, 1, 0, 100), 'and as closed under it').toBeLessThan(2.6);
  });
});
