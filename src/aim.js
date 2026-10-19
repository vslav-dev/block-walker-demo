import { NORTH, turnToward, wrapAngle } from './angles.js';

const YAW_SPEED = 18; // how fast the character turns to where it is aimed
const LOOK_PER_PIXEL = 0.0015; // radians per pixel of mouse movement while aiming, at the sensitivity 1, the usual one

// Where the character looks and where the camera should look. Pure logic, no rendering.
// Overview: the character looks at the cursor and the camera looks north.
// Aim: the mouse turns the view, the character looks where the camera looks.
export class Aim {
  // settings.mouseSensitivity is read on every update, so a change takes effect at once.
  constructor(settings) {
    this.settings = settings;
    this.aiming = false;
    this.yaw = 0; // where the character looks
    this.look = 0; // the yaw the mouse has set while aiming
    this.heading = NORTH; // where the camera should look
  }

  // aiming = the aim mode is on, lookX = mouse movement in pixels since the last call, to the right is positive,
  // cursorYaw = the yaw of the cursor as seen from the character, or null if it is right over it.
  update(dt, aiming, lookX, cursorYaw) {
    if (aiming && !this.aiming) this.look = this.yaw; // the camera turns to what the character already looks at
    this.aiming = aiming;

    if (aiming) this.look = wrapAngle(this.look - lookX * LOOK_PER_PIXEL * this.settings.mouseSensitivity); // turning right lowers the yaw
    this.heading = aiming ? this.look : NORTH;

    const target = aiming ? this.look : cursorYaw;
    if (target !== null) this.yaw = turnToward(this.yaw, target, YAW_SPEED, dt);
  }
}
