// Yaw is the direction on the ground: atan2(x, z), so 0 looks along +z (south, down the screen) and PI along -z (north).
export const NORTH = Math.PI;

export const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

// The angle moved to the nearest of the four directions at right angles to each other that include `origin`: it goes to
// the side it is turned towards, to origin itself if it is turned by less than 45° from it, to the opposite one if by more than 135°.
export const nearestQuarter = (angle: number, origin = NORTH): number => {
  const quarter = Math.PI / 2;
  return wrapAngle(origin + Math.round(wrapAngle(angle - origin) / quarter) * quarter);
};

// Moves the angle towards the target the short way round; `speed` is per second, the approach slows down near the target.
export const turnToward = (angle: number, target: number, speed: number, dt: number): number =>
  wrapAngle(angle + wrapAngle(target - angle) * (1 - Math.exp(-speed * dt)));

// A direction given as on the screen (x = right, z = down, so up the screen is -z) for a camera looking along `heading`,
// turned into the world's: the heading itself is "up the screen".
export function screenToWorld(x: number, z: number, heading: number): { x: number; z: number } {
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  return { x: -x * cos - z * sin, z: x * sin - z * cos };
}
