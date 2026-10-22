import test from 'node:test';
import assert from 'node:assert/strict';
import { Aim } from '../src/aim.js';
import { NORTH, nearestQuarter, screenToWorld, turnToward, wrapAngle } from '../src/angles.js';

const settings = { mouseSensitivity: 1 };
const EAST = Math.PI / 2; // yaw of +x
const close = (a, b, message) => assert.ok(Math.abs(wrapAngle(a - b)) < 0.01, `${message}: ${a} vs ${b}`);

function run(aim, seconds, aiming, lookX, cursorYaw) {
  for (let t = 0; t < seconds; t += 1 / 60) aim.update(1 / 60, aiming, t === 0 ? lookX : 0, cursorYaw);
}

test('up the screen is the heading of the camera', () => {
  const north = screenToWorld(0, -1, NORTH);
  assert.ok(Math.abs(north.x) < 1e-9 && Math.abs(north.z + 1) < 1e-9, 'north: W goes north');
  const right = screenToWorld(1, 0, NORTH);
  assert.ok(Math.abs(right.x - 1) < 1e-9 && Math.abs(right.z) < 1e-9, 'north: D goes east');

  const forward = screenToWorld(0, -1, EAST);
  assert.ok(Math.abs(forward.x - 1) < 1e-9 && Math.abs(forward.z) < 1e-9, 'looking east: W goes east');
  const strafe = screenToWorld(1, 0, EAST);
  assert.ok(Math.abs(strafe.x) < 1e-9 && Math.abs(strafe.z - 1) < 1e-9, 'looking east: D goes south');
});

test('an angle turns the short way round', () => {
  const next = turnToward(170 * Math.PI / 180, -170 * Math.PI / 180, 10, 0.1);
  assert.ok(Math.abs(next) > 170 * Math.PI / 180, 'through 180°, not back through 0°');
});

test('in the overview the character looks at the cursor and the camera north', () => {
  const aim = new Aim(settings);
  run(aim, 1, false, 0, EAST);
  close(aim.yaw, EAST, 'yaw');
  close(aim.heading, NORTH, 'heading');
  run(aim, 1, false, 0, null);
  close(aim.yaw, EAST, 'a cursor over the character changes nothing');
});

test('the aim starts from where the character looks, so looking north changes nothing', () => {
  const aim = new Aim(settings);
  run(aim, 1, false, 0, NORTH);
  run(aim, 0.1, true, 0, NORTH);
  close(aim.heading, NORTH, 'heading');
  close(aim.yaw, NORTH, 'yaw');

  const east = new Aim(settings);
  run(east, 1, false, 0, EAST);
  run(east, 0.1, true, 0, null);
  close(east.heading, EAST, 'the camera turns to where the character looks');
});

test('while aiming the mouse turns the view and the character with it, the cursor is ignored', () => {
  const aim = new Aim(settings);
  run(aim, 1, false, 0, NORTH);
  run(aim, 1, true, 100, EAST); // 100 px to the right
  close(aim.heading, NORTH - 0.15, 'turning right lowers the yaw');
  close(aim.yaw, aim.heading, 'the character looks where the camera looks');
});

test('the mouse sensitivity of the settings scales the turn', () => {
  const aim = new Aim({ mouseSensitivity: 2 });
  run(aim, 1, false, 0, NORTH);
  run(aim, 1, true, 100, null);
  close(aim.heading, NORTH - 0.3, 'twice the turn');
});

// Pixels of mouse movement that turn the view to the right by this many degrees, at the sensitivity 1.
const pixels = (degrees) => ((degrees * Math.PI) / 180) / 0.0015;

// Turns the view right by `degrees` in one aim, releases it and lets the camera settle. The character looks north at first.
function turnAndRelease(aim, degrees) {
  run(aim, 1, false, 0, NORTH);
  run(aim, 0.1, true, 0, null);
  run(aim, 0.1, true, pixels(degrees), null);
  run(aim, 2, false, 0, null);
}

test('releasing the aim leaves the camera on the nearest of the four directions, on the side it was turned to', () => {
  const quarter = Math.PI / 2;
  for (const [degrees, turns] of [[10, 0], [40, 0], [50, 1], [90, 1], [130, 1], [140, 2], [180, 2], [220, 2], [230, 3], [300, 3], [320, 4], [-50, -1], [-140, -2]]) {
    const aim = new Aim(settings);
    turnAndRelease(aim, degrees);
    close(aim.heading, NORTH - turns * quarter, `after ${degrees}° to the right`);
  }
  const spins = new Aim(settings);
  turnAndRelease(spins, 3 * 360 + 100); // three whole turns and a bit
  close(spins.heading, NORTH - quarter, 'any number of turns counts only by where the view stopped');
});

test('the next aim and release start from the camera as it is, and the camera follows its new directions', () => {
  const aim = new Aim(settings);
  turnAndRelease(aim, 180); // the camera looks south now
  run(aim, 0.1, true, 0, null);
  close(aim.heading, aim.yaw, 'the aim starts from where the character looks');
  turnAndRelease(aim, 100); // from where the character looked, which was not the camera's
  close(Math.abs(wrapAngle(aim.heading - NORTH)) % (Math.PI / 2), 0, 'always one of the four directions');
});

test('the quarter nearest to an angle', () => {
  const quarter = Math.PI / 2;
  close(nearestQuarter(NORTH + 0.1), NORTH, 'a little aside');
  close(nearestQuarter(NORTH + quarter * 0.6), NORTH + quarter, 'more than 45°');
  close(nearestQuarter(NORTH + quarter * 1.6), NORTH + 2 * quarter, 'next quarter');
  close(nearestQuarter(0.3, 0), 0, 'another origin');
});
