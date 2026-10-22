import { polygonContains as contains } from '@game/testing/geometry';
import type { Segment } from './sight-segments';
import { visibilityPolygon } from './visibility-polygon';

const wall = (ax: number, az: number, bx: number, bz: number): Segment => ({ ax, az, bx, bz });

describe('visibilityPolygon', () => {
  it('with nothing in the way, as far as the range in every direction', () => {
    const corners = visibilityPolygon([], 3, 4, 10);
    expect(contains(corners, 3, 4)).toBe(true);
    for (const [x, z] of [[12, 4], [-6, 4], [3, 13], [3, -5], [11, 13], [-5, -4]]) expect(contains(corners, x, z), `(${x}, ${z})`).toBe(true);
    expect(contains(corners, 14, 4), 'not farther than the range').toBe(false);
  });

  it('a wall hides what is behind it, and only that', () => {
    const corners = visibilityPolygon([wall(5, -10, 5, 10)], 0, 0, 30);
    expect(contains(corners, 4.9, 0), 'in front of it').toBe(true);
    expect(contains(corners, 4.9, 9.9)).toBe(true);
    expect(contains(corners, -20, 3), 'on the other side from it').toBe(true);
    expect(contains(corners, 5.1, 0), 'right behind it').toBe(false);
    expect(contains(corners, 20, 8), 'far behind it').toBe(false);
  });

  it('beyond the end of a wall it is seen again, round the corner of it and not through it', () => {
    const corners = visibilityPolygon([wall(5, -10, 5, 2)], 0, 0, 30);
    expect(contains(corners, 8, 5), 'past the end of the wall').toBe(true);
    expect(contains(corners, 8, 1), 'behind the wall, in its shade').toBe(false);
    expect(contains(corners, 5.5, 2.5), 'close past the end').toBe(true);
  });

  it('a gap in a wall is a doorway: a cone of what is behind it is seen', () => {
    const corners = visibilityPolygon([wall(5, -10, 5, -0.5), wall(5, 0.5, 5, 10)], 0, 0, 30);
    expect(contains(corners, 8, 0), 'straight through').toBe(true);
    expect(contains(corners, 20, 1), 'the cone widens with the distance').toBe(true);
    expect(contains(corners, 8, 3), 'not beside it').toBe(false);
    expect(contains(corners, 20, 6)).toBe(false);
  });

  it('where two walls cross is a corner of what is seen: the wall is seen right up to it, the polygon does not cut it off', () => {
    // A wall along z = 0 and one along x = 8 that go past each other: the crossing at (8, 0) is the end of neither of them.
    const corners = visibilityPolygon([wall(-5, 0, 10, 0), wall(8, -5, 8, 10)], 3, 5, 40);
    for (const [x, z] of [[7.95, 0.05], [7.9, 0.02], [7.99, 0.5], [6, 0.01], [7.8, 3]]) expect(contains(corners, x, z), `(${x}, ${z}) in the corner`).toBe(true);
    expect(contains(corners, 8.05, 0.05), 'beyond the crossing').toBe(false);
    expect(contains(corners, 7.9, -0.05), 'beyond the crossing').toBe(false);
  });

  it('the corners go in the order of the angle round the point', () => {
    const corners = visibilityPolygon([wall(5, -10, 5, 10), wall(-4, -10, -4, 10)], 1, 1, 30);
    const angles = Array.from({ length: corners.length / 2 }, (_, i) => Math.atan2(corners[2 * i + 1] - 1, corners[2 * i] - 1));
    expect(angles).toEqual([...angles].sort((a, b) => a - b));
  });
});
