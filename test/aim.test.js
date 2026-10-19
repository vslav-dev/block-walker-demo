import test from 'node:test';
import assert from 'node:assert/strict';
import { Aim } from '../src/aim.js';
import { NORTH, screenToWorld, turnToward, wrapAngle } from '../src/angles.js';

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
  close(aim.heading, NORTH - 0.2, 'turning right lowers the yaw');
  close(aim.yaw, aim.heading, 'the character looks where the camera looks');
});

test('the mouse sensitivity of the settings scales the turn', () => {
  const aim = new Aim({ mouseSensitivity: 2 });
  run(aim, 1, false, 0, NORTH);
  run(aim, 1, true, 100, null);
  close(aim.heading, NORTH - 0.4, 'twice the turn');
});

test('releasing the aim sends the camera back north', () => {
  const aim = new Aim(settings);
  run(aim, 1, false, 0, EAST);
  run(aim, 1, true, 500, null);
  run(aim, 0.1, false, 0, null);
  close(aim.heading, NORTH, 'heading');
});
