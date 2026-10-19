// Yaw is the direction on the ground: atan2(x, z), so 0 looks along +z (south, down the screen) and PI along -z (north).
export const NORTH = Math.PI;

export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Moves the angle towards the target the short way round; `speed` is per second, the approach slows down near the target.
export const turnToward = (angle, target, speed, dt) => wrapAngle(angle + wrapAngle(target - angle) * (1 - Math.exp(-speed * dt)));

// A direction given as on the screen (x = right, z = down, so up the screen is -z) for a camera looking along `heading`,
// turned into the world's: the heading itself is "up the screen".
export function screenToWorld(x, z, heading) {
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  return { x: -x * cos - z * sin, z: x * sin - z * cos };
}
