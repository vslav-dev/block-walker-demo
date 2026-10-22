// How the robot's body is oriented relative to its movement and the cursor. Pure math, no rendering.
// The legs follow the movement, the upper body follows the cursor, and the robot backpedals when moving against it.
import { turnToward, wrapAngle } from '@game/core/angles';

const DEG = Math.PI / 180;
const LEGS_TURN_SPEED = 14; // how fast legs follow the movement direction
const IDLE_TURN_SPEED = 8; // how fast the body catches up with the cursor while standing
const MAX_IDLE_TWIST = 40 * DEG; // standing: legs stay planted until the twist exceeds this
const MAX_TWIST = 120 * DEG; // hard limit for the spine, even in the middle of a fast turn
// Moving more than 100° away from the cursor switches to backpedaling, back below 80°.
const BACKPEDAL_ENTER = 100 * DEG;
const BACKPEDAL_EXIT = 80 * DEG;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export class Steering {
  legsYaw = 0; // yaw of the lower body
  backpedal = false; // moving backwards relative to the cursor: play the gait in reverse

  // Returns the yaw of the upper body relative to the legs.
  update(dt: number, aimYaw: number, moveX: number, moveZ: number): number {
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

  private turnLegs(target: number, speed: number, dt: number): void {
    this.legsYaw = turnToward(this.legsYaw, target, speed, dt);
  }
}
