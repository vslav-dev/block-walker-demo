import test from 'node:test';
import assert from 'node:assert/strict';
import { Steering, wrapAngle } from '../src/steering.js';

const DEG = Math.PI / 180;
const EAST = Math.PI / 2; // yaw of +x

function run(steering, seconds, aimYaw, moveX, moveZ) {
  let twist = 0;
  for (let t = 0; t < seconds; t += 1 / 60) twist = steering.update(1 / 60, aimYaw, moveX, moveZ);
  return twist;
}

test('legs follow the movement, the upper body twists to the cursor', () => {
  const s = new Steering();
  const twist = run(s, 1, 0, 1, 0); // cursor to the south (yaw 0), walking east
  assert.ok(Math.abs(s.legsYaw - EAST) < 0.01);
  assert.ok(Math.abs(twist - -EAST) < 0.01);
  assert.equal(s.backpedal, false);
});

test('moving away from the cursor backpedals with a hysteresis', () => {
  const s = new Steering();
  run(s, 1, Math.PI, 0, 1); // cursor to the north, walking south: 180° away
  assert.equal(s.backpedal, true);
  assert.ok(Math.abs(wrapAngle(s.legsYaw - Math.PI)) < 0.01, 'legs face away from the movement');

  const edge = new Steering();
  run(edge, 0.5, 90 * DEG + EAST, 1, 0); // exactly 90° away
  assert.equal(edge.backpedal, false, 'does not enter backpedal at 90°');
  edge.backpedal = true;
  run(edge, 0.5, 90 * DEG + EAST, 1, 0);
  assert.equal(edge.backpedal, true, 'stays in backpedal at 90°');
});

test('standing still keeps small twists and catches up with large ones', () => {
  const small = new Steering();
  run(small, 1, 30 * DEG, 0, 0);
  assert.ok(Math.abs(small.legsYaw) < 0.01, 'legs stay planted within 40°');

  const large = new Steering();
  const twist = run(large, 2, 120 * DEG, 0, 0);
  assert.ok(Math.abs(twist) <= 40 * DEG + 0.01, 'legs caught up until the twist is 40°');
});
