// How the robot's body is oriented relative to its movement and the cursor. Pure math, no rendering.
// The legs follow the movement, the upper body follows the cursor, and the robot backpedals when moving against it.

const DEG = Math.PI / 180;
const LEGS_TURN_SPEED = 14; // how fast legs follow the movement direction
const IDLE_TURN_SPEED = 8; // how fast the body catches up with the cursor while standing
const MAX_IDLE_TWIST = 40 * DEG; // standing: legs stay planted until the twist exceeds this
const MAX_TWIST = 120 * DEG; // hard limit for the spine, even in the middle of a fast turn
// Moving more than 100° away from the cursor switches to backpedaling, back below 80°.
const BACKPEDAL_ENTER = 100 * DEG;
const BACKPEDAL_EXIT = 80 * DEG;

export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export class Steering {
  constructor() {
    this.legsYaw = 0; // yaw of the lower body
    this.backpedal = false; // moving backwards relative to the cursor: play the gait in reverse
  }

  // Returns the yaw of the upper body relative to the legs.
  update(dt, aimYaw, moveX, moveZ) {
    if (moveX !== 0 || moveZ !== 0) {
      const moveYaw = Math.atan2(moveX, moveZ);
      const away = Math.abs(wrapAngle(moveYaw - aimYaw));
      this.backpedal = away > (this.backpedal ? BACKPEDAL_EXIT : BACKPEDAL_ENTER);
      this.turnLegs(this.backpedal ? moveYaw + Math.PI : moveYaw, LEGS_TURN_SPEED, dt);
    } else {
      this.backpedal = false;
      const twist = wrapAngle(aimYaw - this.legsYaw);
      this.turnLegs(this.legsYaw + twist - clamp(twist, -MAX_IDLE_TWIST, MAX_IDLE_TWIST), IDLE_TURN_SPEED, dt);
    }
    return clamp(wrapAngle(aimYaw - this.legsYaw), -MAX_TWIST, MAX_TWIST);
  }

  turnLegs(target, speed, dt) {
    this.legsYaw = wrapAngle(this.legsYaw + wrapAngle(target - this.legsYaw) * (1 - Math.exp(-speed * dt)));
  }
}
