import { wrapAngle } from '@game/core/angles';
import { Steering } from './steering';

const DEG = Math.PI / 180;
const EAST = Math.PI / 2; // yaw of +x

function run(steering: Steering, seconds: number, aimYaw: number, moveX: number, moveZ: number): number {
  let twist = 0;
  for (let t = 0; t < seconds; t += 1 / 60) twist = steering.update(1 / 60, aimYaw, moveX, moveZ);
  return twist;
}

describe('Steering', () => {
  it('legs follow the movement, the upper body twists to the cursor', () => {
    const s = new Steering();
    const twist = run(s, 1, 0, 1, 0); // cursor to the south (yaw 0), walking east
    expect(Math.abs(s.legsYaw - EAST)).toBeLessThan(0.01);
    expect(Math.abs(twist - -EAST)).toBeLessThan(0.01);
    expect(s.backpedal).toBe(false);
  });

  it('moving away from the cursor backpedals with a hysteresis', () => {
    const s = new Steering();
    run(s, 1, Math.PI, 0, 1); // cursor to the north, walking south: 180° away
    expect(s.backpedal).toBe(true);
    expect(Math.abs(wrapAngle(s.legsYaw - Math.PI)), 'legs face away from the movement').toBeLessThan(0.01);

    const edge = new Steering();
    run(edge, 0.5, 90 * DEG + EAST, 1, 0); // exactly 90° away
    expect(edge.backpedal, 'does not enter backpedal at 90°').toBe(false);
    edge.backpedal = true;
    run(edge, 0.5, 90 * DEG + EAST, 1, 0);
    expect(edge.backpedal, 'stays in backpedal at 90°').toBe(true);
  });

  it('standing still keeps small twists and catches up with large ones', () => {
    const small = new Steering();
    run(small, 1, 30 * DEG, 0, 0);
    expect(Math.abs(small.legsYaw), 'legs stay planted within 40°').toBeLessThan(0.01);

    const large = new Steering();
    const twist = run(large, 2, 120 * DEG, 0, 0);
    expect(Math.abs(twist), 'legs caught up until the twist is 40°').toBeLessThanOrEqual(40 * DEG + 0.01);
  });
});
