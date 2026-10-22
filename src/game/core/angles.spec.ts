import { NORTH, nearestQuarter, screenToWorld, turnToward, wrapAngle } from './angles';

const EAST = Math.PI / 2; // yaw of +x
const close = (a: number, b: number, message: string) => expect(Math.abs(wrapAngle(a - b)), `${message}: ${a} vs ${b}`).toBeLessThan(0.01);

describe('angles', () => {
  it('up the screen is the heading of the camera', () => {
    const north = screenToWorld(0, -1, NORTH);
    expect(Math.abs(north.x) < 1e-9 && Math.abs(north.z + 1) < 1e-9, 'north: W goes north').toBe(true);
    const right = screenToWorld(1, 0, NORTH);
    expect(Math.abs(right.x - 1) < 1e-9 && Math.abs(right.z) < 1e-9, 'north: D goes east').toBe(true);

    const forward = screenToWorld(0, -1, EAST);
    expect(Math.abs(forward.x - 1) < 1e-9 && Math.abs(forward.z) < 1e-9, 'looking east: W goes east').toBe(true);
    const strafe = screenToWorld(1, 0, EAST);
    expect(Math.abs(strafe.x) < 1e-9 && Math.abs(strafe.z - 1) < 1e-9, 'looking east: D goes south').toBe(true);
  });

  it('an angle turns the short way round', () => {
    const next = turnToward((170 * Math.PI) / 180, (-170 * Math.PI) / 180, 10, 0.1);
    expect(Math.abs(next), 'through 180°, not back through 0°').toBeGreaterThan((170 * Math.PI) / 180);
  });

  it('the quarter nearest to an angle', () => {
    const quarter = Math.PI / 2;
    close(nearestQuarter(NORTH + 0.1), NORTH, 'a little aside');
    close(nearestQuarter(NORTH + quarter * 0.6), NORTH + quarter, 'more than 45°');
    close(nearestQuarter(NORTH + quarter * 1.6), NORTH + 2 * quarter, 'next quarter');
    close(nearestQuarter(0.3, 0), 0, 'another origin');
  });
});
