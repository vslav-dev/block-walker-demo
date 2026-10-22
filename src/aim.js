import { NORTH, nearestQuarter, turnToward, wrapAngle } from './angles.js';

// The red line of sight shown in the aim mode, for the debug panel: in the world, where the walls and the rest hide it
// as they hide anything behind them, and, for debugging, over everything.
export const AIM_TUNABLES = [
  { key: 'aimLine', group: 'Aim', label: 'Aim line, hidden behind objects', boolean: true, value: true },
  { key: 'aimLineOverEverything', group: 'Aim', label: 'Aim line over everything (debug)', boolean: true, value: false },
];

const YAW_SPEED = 18; // how fast the character turns to where it is aimed
const LOOK_PER_PIXEL = 0.0015; // radians per pixel of mouse movement while aiming, at the sensitivity 1, the usual one

// Where the character looks and where the camera should look. Pure logic, no rendering.
// Overview: the character looks at the cursor and the camera looks along its view, north at the start.
// Aim: the mouse turns the view, the character looks where the camera looks. When the aim ends, the view becomes the
// nearest of the four directions at right angles to north, however far and often it was turned: the camera stays on
// the side it was turned to instead of going back north.
export class Aim {
  // settings.mouseSensitivity is read on every update, so a change takes effect at once.
  constructor(settings) {
    this.settings = settings;
    this.aiming = false;
    this.yaw = 0; // where the character looks
    this.look = 0; // the yaw the mouse has set while aiming
    this.view = NORTH; // where the camera looks in the overview: north or a quarter turn from it
    this.heading = NORTH; // where the camera should look
  }

  // aiming = the aim mode is on, lookX = mouse movement in pixels since the last call, to the right is positive,
  // cursorYaw = the yaw of the cursor as seen from the character, or null if it is right over it.
  update(dt, aiming, lookX, cursorYaw) {
    if (aiming && !this.aiming) this.look = this.yaw; // the camera turns to what the character already looks at
    if (!aiming && this.aiming) this.view = nearestQuarter(this.look);
    this.aiming = aiming;

    if (aiming) this.look = wrapAngle(this.look - lookX * LOOK_PER_PIXEL * this.settings.mouseSensitivity); // turning right lowers the yaw
    this.heading = aiming ? this.look : this.view;

    const target = aiming ? this.look : cursorYaw;
    if (target !== null) this.yaw = turnToward(this.yaw, target, YAW_SPEED, dt);
  }
}
