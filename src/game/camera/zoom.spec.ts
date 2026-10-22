import { ZOOM_TUNABLES, Zoom, type ZoomTuning } from './zoom';

const tuning = (): ZoomTuning => Object.fromEntries(ZOOM_TUNABLES.map((spec) => [spec.key, spec.value])) as unknown as ZoomTuning;
const DEG = Math.PI / 180;

function run(zoom: Zoom, seconds: number, pixelsPerFrame = 0) {
  for (let t = 0; t < seconds; t += 1 / 60) zoom.update(1 / 60, pixelsPerFrame);
}

describe('Zoom', () => {
  it('scrolling away zooms out, towards zooms in, and the zoom stays within 0..1', () => {
    const zoom = new Zoom(tuning());
    zoom.update(1 / 60, 50);
    expect(zoom.target, 'away = farther').toBeGreaterThan(0.5);
    zoom.update(1 / 60, -100);
    expect(zoom.target, 'towards = closer').toBeLessThan(0.5);

    run(zoom, 5, 60);
    expect(zoom.target).toBe(1);
    run(zoom, 5, -60);
    expect(zoom.target).toBe(0);
  });

  it('the ends of the zoom are exactly the tuned distances and pitches', () => {
    const t = tuning();
    const zoom = new Zoom(t);
    run(zoom, 5, -60);
    expect(Math.abs(zoom.distance - t.distanceNear)).toBeLessThan(0.01);
    expect(Math.abs(zoom.pitch - t.pitchNear * DEG)).toBeLessThan(0.001);
    run(zoom, 10, 60);
    expect(Math.abs(zoom.distance - t.distanceFar)).toBeLessThan(0.01);
    expect(Math.abs(zoom.pitch - t.pitchFar * DEG)).toBeLessThan(0.001);
  });

  it('closer is flatter and nearer, and a change of the tuning shows at once', () => {
    const t = tuning();
    const zoom = new Zoom(t);
    const before = { distance: zoom.distance, pitch: zoom.pitch };
    run(zoom, 5, -60);
    expect(zoom.distance < before.distance && zoom.pitch < before.pitch).toBe(true);

    t.pitchNear = 20;
    expect(Math.abs(zoom.pitch - 20 * DEG), 'read live, not copied').toBeLessThan(0.001);
  });

  it('a pixel of scrolling changes the distance by the same percent anywhere', () => {
    const zoom = new Zoom(tuning());
    const ratio = () => {
      const from = zoom.distance;
      zoom.target += 0.01;
      zoom.value = zoom.target;
      return zoom.distance / from;
    };
    const first = ratio();
    zoom.target = zoom.value = 0.8;
    expect(Math.abs(ratio() - first)).toBeLessThan(1e-9);
  });

  it('the shown zoom eases towards the target without overshooting and at the same pace at any frame rate', () => {
    const smooth = new Zoom(tuning());
    smooth.update(1 / 60, 100);
    const target = smooth.target;
    let previous = smooth.value;
    for (let i = 0; i < 120; i++) {
      smooth.update(1 / 60, 0);
      expect(smooth.value >= previous && smooth.value <= target, 'monotone, never past the target').toBe(true);
      previous = smooth.value;
    }
    expect(Math.abs(smooth.value - target), 'arrived').toBeLessThan(1e-3);

    const fast = new Zoom(tuning());
    const slow = new Zoom(tuning());
    fast.update(1 / 120, 100);
    slow.update(1 / 30, 100);
    for (let i = 0; i < 11; i++) fast.update(1 / 120, 0);
    for (let i = 0; i < 2; i++) slow.update(1 / 30, 0);
    expect(Math.abs(fast.value - slow.value), 'a tenth of a second is a tenth of a second').toBeLessThan(0.02);
  });
});
