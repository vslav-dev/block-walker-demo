import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_SECONDS, DAY_TUNABLES, advanceHour, formatHour, skyAt } from '../src/day-cycle.js';

const tuning = () => Object.fromEntries(DAY_TUNABLES.map((spec) => [spec.key, spec.value]));
const sky = (hour, changes = {}) => skyAt(hour, { ...tuning(), ...changes });
const hours = Array.from({ length: 24 * 20 + 1 }, (_, i) => i / 20);
const elevation = (direction) => Math.asin(direction.y);
const horizontal = (direction) => Math.hypot(direction.x, direction.z);
const DEG = Math.PI / 180;

test('the hour goes round the day at the pace of time, and stops when time is stopped', () => {
  assert.equal(advanceHour(10, DAY_SECONDS / 24, 1), 11, 'a day is DAY_SECONDS');
  assert.equal(advanceHour(10, DAY_SECONDS / 24, 2), 12, 'twice as fast');
  assert.equal(advanceHour(23.5, DAY_SECONDS / 24, 1), 0.5, 'wraps past midnight');
  assert.equal(advanceHour(10, 5, 0), 10, 'stopped');
  assert.equal(formatHour(9.5), '09:30');
  assert.equal(formatHour(23.999), '23:59');
});

test('the light is a unit vector above the horizon, by day the sun and by night the moon, and it goes down to the horizon', () => {
  for (const hour of hours) {
    const { direction, sun } = sky(hour);
    assert.ok(Math.abs(Math.hypot(direction.x, direction.y, direction.z) - 1) < 1e-9, `unit at ${hour}`);
    assert.ok(elevation(direction) >= -1e-9, `above the horizon at ${hour}`);
    assert.equal(sun, hour > 6 && hour < 18, `sun by day at ${hour}`);
  }
  assert.ok(elevation(sky(6.2).direction) < 5 * DEG && elevation(sky(17.8).direction) < 5 * DEG, 'not held at some angle: it is nearly level at the end of the day');
  assert.ok(elevation(sky(6.2).direction) < elevation(sky(6.4).direction), 'and keeps rising after sunrise');
});

test('the moon is opposite the sun, and dawn is dusk the other way round', () => {
  const noon = sky(12).direction;
  const midnight = sky(0).direction;
  assert.ok(Math.abs(noon.x + midnight.x) < 1e-9 && Math.abs(noon.z + midnight.z) < 1e-9, 'opposite over the ground');
  assert.ok(Math.abs(elevation(noon) - elevation(midnight)) < 1e-9, 'as high as the sun');

  for (const offset of [1, 3.3, 5.9, 7.2, 10]) {
    const morning = sky(12 - offset);
    const evening = sky(12 + offset);
    for (const field of ['keyColor', 'hemiSky', 'hemiGround', 'background']) assert.equal(morning[field], evening[field], `${field} mirrored at ±${offset}`);
    for (const field of ['keyIntensity', 'shadow', 'hemiIntensity']) assert.ok(Math.abs(morning[field] - evening[field]) < 1e-9, `${field} mirrored at ±${offset}`);
  }
});

test('the sun rises in the east and sets in the west, and at noon the light comes from the south-west', () => {
  assert.ok(sky(7.5).direction.x > sky(12).direction.x && sky(12).direction.x > sky(16.5).direction.x, 'east to west');
  const noon = sky(12).direction;
  assert.ok(noon.x < 0 && noon.z > 0, 'from the south-west');
  assert.ok(elevation(noon) > 45 * DEG, 'high at noon: short shadows');
});

test('shadows are strong by day, light by night, and gone in the twilight', () => {
  assert.equal(sky(12).shadow, 1, 'full by the sun');
  assert.ok(sky(0).shadow > 0 && sky(0).shadow < 0.5, 'light by the moon');
  assert.equal(sky(6).shadow, 0, 'no shadow at dawn');
  assert.equal(sky(18).shadow, 0, 'no shadow at dusk');
  assert.equal(sky(6).keyIntensity, 0, 'no key light at dawn');
  assert.equal(sky(18).keyIntensity, 0, 'no key light at dusk');
  assert.ok(sky(12).keyIntensity > 4 * sky(0).keyIntensity, 'the sun is much brighter than the moon');
  assert.ok(sky(0, { nightShadow: 0.9 }).shadow > sky(0).shadow, 'the strength is tuned apart for the night');
  assert.ok(sky(12, { dayShadow: 0.5 }).shadow < sky(12).shadow, 'and for the day');
});

test('the shadows fade out smoothly over a few degrees of the light, while it keeps moving; the moon brings its own later', () => {
  const fade = { shadowFadeAngle: 20, shadowFadeRange: 8 };
  const evening = Array.from({ length: 200 }, (_, i) => sky(14 + i * 0.02, fade));
  for (let i = 1; i < evening.length; i++) {
    assert.ok(evening[i].shadow <= evening[i - 1].shadow + 1e-9, 'the shadow only weakens through the evening');
    assert.ok(Math.abs(evening[i].shadow - evening[i - 1].shadow) < 0.08, 'and without a jump');
    if (elevation(evening[i].direction) >= 20 * DEG) assert.equal(evening[i].shadow, 1, 'full above the fade angle');
    if (elevation(evening[i].direction) <= 12 * DEG) assert.equal(evening[i].shadow, 0, 'none below the end of the fade');
  }
  const strong = evening.find((state) => elevation(state.direction) < 20 * DEG);
  assert.ok(strong.shadow > 0.9, 'it starts to fade at the set angle');
  assert.ok(elevation(strong.direction) > 12 * DEG && evening.some((state) => elevation(state.direction) < 12 * DEG), 'the light goes on moving after it');

  assert.ok(sky(16, fade).shadow === 1 && sky(16, fade).shadow >= sky(16.8, fade).shadow, 'long afternoon shadows are still there');
  assert.ok(sky(21, fade).shadow > 0 && sky(19, fade).shadow < sky(21, fade).shadow, 'the moon casts them again as it climbs');
  assert.ok(sky(17, { ...fade, shadowFadeAngle: 40 }).shadow < sky(17, fade).shadow, 'a higher angle fades them earlier');
  assert.ok(sky(17, { ...fade, shadowFadeRange: 20 }).shadow > sky(17, fade).shadow, 'a longer range keeps them lower, fading more slowly');
});

test('the sky changes smoothly: only where the light is nil may its direction jump', () => {
  const step = 0.01;
  for (let hour = 0; hour < 24; hour += step) {
    const a = sky(hour);
    const b = sky(hour + step);
    assert.ok(Math.abs(a.keyIntensity - b.keyIntensity) < 0.05, `light does not jump at ${hour}`);
    assert.ok(Math.abs(a.shadow - b.shadow) < 0.05, `shadow does not jump at ${hour}`);
    assert.ok(Math.abs(a.hemiIntensity - b.hemiIntensity) < 0.05, `sky light does not jump at ${hour}`);
    const turn = Math.hypot(a.direction.x - b.direction.x, a.direction.y - b.direction.y, a.direction.z - b.direction.z);
    if (turn > 0.05) assert.ok(a.keyIntensity < 0.05 && b.keyIntensity < 0.05 && a.shadow < 0.05 && b.shadow < 0.05, `the light jumps at ${hour} unseen`);
  }
});

test('it is brighter by day than by night, and the colours are warm by day, blue by night', () => {
  const day = sky(12);
  const night = sky(0);
  assert.ok(day.hemiIntensity > night.hemiIntensity && day.keyIntensity > night.keyIntensity);
  const channels = (color) => ({ r: color >> 16, g: (color >> 8) & 255, b: color & 255 });
  const warm = channels(day.keyColor);
  const cold = channels(night.keyColor);
  assert.ok(warm.r > warm.b, 'the sun is warm');
  assert.ok(cold.b > cold.r, 'the moon is blue');
  const dusk = channels(sky(17.2).keyColor);
  assert.ok(dusk.r - dusk.b > warm.r - warm.b, 'and the low sun is more orange still');
});

test('hours outside the day are the same hours', () => {
  for (const [outside, inside] of [[25, 1], [-1, 23], [24, 0]]) {
    const a = sky(outside);
    const b = sky(inside);
    assert.equal(a.sun, b.sun);
    assert.equal(a.keyColor, b.keyColor);
    assert.ok(Math.abs(a.keyIntensity - b.keyIntensity) < 1e-9);
    assert.ok(Math.abs(a.direction.x - b.direction.x) < 1e-9 && Math.abs(a.direction.z - b.direction.z) < 1e-9);
  }
  assert.ok(horizontal(sky(3).direction) > 0);
});
