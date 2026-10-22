import { BODY_H } from './world';
import { DOOR_H, FRAME_WIDTH, STOREY_H, WINDOW_BOTTOM, WINDOW_TOP, WallSide, sidesFacing, storeyAt } from './blocks';

describe('blocks', () => {
  it('the view switches to the next storey one block up the stairs, not at its floor', () => {
    expect(STOREY_H, 'the numbers below assume 2 blocks per storey').toBe(2);
    // Floors are at y = 1, 3, 5.
    for (const [y, storey] of [[1, 0], [1.9, 0], [2, 1], [3, 1], [3.9, 1], [4, 2], [5, 2]]) {
      expect(storeyAt(y), `storey at y=${y}`).toBe(storey);
    }
  });

  it('the openings: the head fits under the door header, wall is left over the door and the window, the window is taller than a block', () => {
    expect(DOOR_H, 'the character walks through the doorway').toBeGreaterThan(BODY_H);
    expect(STOREY_H - (DOOR_H + FRAME_WIDTH), 'a strip of wall over the header is as thick as the header').toBeGreaterThanOrEqual(FRAME_WIDTH - 1e-9);
    expect(WINDOW_TOP - WINDOW_BOTTOM, 'the window is a little taller than a block').toBeGreaterThan(1);
    expect(STOREY_H - WINDOW_TOP, 'wall over the window frame').toBeGreaterThanOrEqual(FRAME_WIDTH - 1e-9);
    expect(WINDOW_BOTTOM, 'wall under the window frame').toBeGreaterThan(0);
    expect(WINDOW_TOP, 'the window is level with the top of the door').toBe(DOOR_H + FRAME_WIDTH);
  });

  it('the sides facing a direction', () => {
    expect(sidesFacing(0, 1, 0.15)).toBe(WallSide.South);
    expect(sidesFacing(0, -1, 0.15)).toBe(WallSide.North);
    expect(sidesFacing(Math.SQRT1_2, Math.SQRT1_2, 0.15)).toBe(WallSide.South | WallSide.East);
    expect(sidesFacing(Math.sin(0.1), Math.cos(0.1), 0.15), 'a wall almost edge-on is not facing').toBe(WallSide.South);
  });
});
