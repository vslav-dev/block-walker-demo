import test from 'node:test';
import assert from 'node:assert/strict';
import { ZOOM_TUNABLES, Zoom } from '../src/zoom.js';
import { wheelPixels } from '../src/input.js';

const tuning = () => Object.fromEntries(ZOOM_TUNABLES.map((spec) => [spec.key, spec.value]));
const DEG = Math.PI / 180;

function run(zoom, seconds, pixelsPerFrame = 0) {
  for (let t = 0; t < seconds; t += 1 / 60) zoom.update(1 / 60, pixelsPerFrame);
}

test('scrolling away zooms out, towards zooms in, and the zoom stays within 0..1', () => {
  const zoom = new Zoom(tuning());
  zoom.update(1 / 60, 50);
  assert.ok(zoom.target > 0.5, 'away = farther');
  zoom.update(1 / 60, -100);
  assert.ok(zoom.target < 0.5, 'towards = closer');

  run(zoom, 5, 60);
  assert.equal(zoom.target, 1);
  run(zoom, 5, -60);
  assert.equal(zoom.target, 0);
});

test('the ends of the zoom are exactly the tuned distances and pitches', () => {
  const t = tuning();
  const zoom = new Zoom(t);
  run(zoom, 5, -60);
  assert.ok(Math.abs(zoom.distance - t.distanceNear) < 0.01);
  assert.ok(Math.abs(zoom.pitch - t.pitchNear * DEG) < 0.001);
  run(zoom, 10, 60);
  assert.ok(Math.abs(zoom.distance - t.distanceFar) < 0.01);
  assert.ok(Math.abs(zoom.pitch - t.pitchFar * DEG) < 0.001);
});

test('closer is flatter and nearer, and a change of the tuning shows at once', () => {
  const t = tuning();
  const zoom = new Zoom(t);
  const before = { distance: zoom.distance, pitch: zoom.pitch };
  run(zoom, 5, -60);
  assert.ok(zoom.distance < before.distance && zoom.pitch < before.pitch);

  t.pitchNear = 20;
  assert.ok(Math.abs(zoom.pitch - 20 * DEG) < 0.001, 'read live, not copied');
});

test('a pixel of scrolling changes the distance by the same percent anywhere', () => {
  const zoom = new Zoom(tuning());
  const ratio = () => {
    const from = zoom.distance;
    zoom.target += 0.01;
    zoom.value = zoom.target;
    return zoom.distance / from;
  };
  const first = ratio();
  zoom.target = zoom.value = 0.8;
  assert.ok(Math.abs(ratio() - first) < 1e-9);
});

test('the shown zoom eases towards the target without overshooting and at the same pace at any frame rate', () => {
  const smooth = new Zoom(tuning());
  smooth.update(1 / 60, 100);
  const target = smooth.target;
  let previous = smooth.value;
  for (let i = 0; i < 120; i++) {
    smooth.update(1 / 60, 0);
    assert.ok(smooth.value >= previous && smooth.value <= target, 'monotone, never past the target');
    previous = smooth.value;
  }
  assert.ok(Math.abs(smooth.value - target) < 1e-3, 'arrived');

  const fast = new Zoom(tuning());
  const slow = new Zoom(tuning());
  fast.update(1 / 120, 100);
  slow.update(1 / 30, 100);
  for (let i = 0; i < 11; i++) fast.update(1 / 120, 0);
  for (let i = 0; i < 2; i++) slow.update(1 / 30, 0);
  assert.ok(Math.abs(fast.value - slow.value) < 0.02, 'a tenth of a second is a tenth of a second');
});

test('wheel events are brought to pixels, whatever their unit, and one event is limited', () => {
  assert.equal(wheelPixels(3, 0, 800), 3, 'pixels as they are: a smooth swipe');
  assert.equal(wheelPixels(1, 1, 800), 18, 'a line');
  assert.equal(wheelPixels(-1, 2, 40), -40, 'a page');
  assert.equal(wheelPixels(500, 0, 800), 60, 'limited');
  assert.equal(wheelPixels(-500, 0, 800), -60, 'limited the other way');
});
