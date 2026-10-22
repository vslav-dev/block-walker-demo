import { DAY_SECONDS, DAY_TUNABLES, advanceHour, formatHour, skyAt, type Direction, type SkyState } from './day-cycle';

const tuning = () => Object.fromEntries(DAY_TUNABLES.map((spec) => [spec.key, spec.value])) as { [key: string]: number };
const sky = (hour: number, changes: Record<string, number> = {}) => skyAt(hour, { ...tuning(), ...changes } as Parameters<typeof skyAt>[1]);
const hours = Array.from({ length: 24 * 20 + 1 }, (_, i) => i / 20);
const elevation = (direction: Direction) => Math.asin(direction.y);
const horizontal = (direction: Direction) => Math.hypot(direction.x, direction.z);
const DEG = Math.PI / 180;

describe('day cycle', () => {
  it('the hour goes round the day at the pace of time, and stops when time is stopped', () => {
    expect(advanceHour(10, DAY_SECONDS / 24, 1), 'a day is DAY_SECONDS').toBe(11);
    expect(advanceHour(10, DAY_SECONDS / 24, 2), 'twice as fast').toBe(12);
    expect(advanceHour(23.5, DAY_SECONDS / 24, 1), 'wraps past midnight').toBe(0.5);
    expect(advanceHour(10, 5, 0), 'stopped').toBe(10);
    expect(formatHour(9.5)).toBe('09:30');
    expect(formatHour(23.999)).toBe('23:59');
  });

  it('the light is a unit vector above the horizon, by day the sun and by night the moon, and it goes down to the horizon', () => {
    for (const hour of hours) {
      const { direction, sun } = sky(hour);
      expect(Math.abs(Math.hypot(direction.x, direction.y, direction.z) - 1), `unit at ${hour}`).toBeLessThan(1e-9);
      expect(elevation(direction), `above the horizon at ${hour}`).toBeGreaterThanOrEqual(-1e-9);
      expect(sun, `sun by day at ${hour}`).toBe(hour > 6 && hour < 18);
    }
    expect(elevation(sky(6.2).direction) < 5 * DEG && elevation(sky(17.8).direction) < 5 * DEG, 'not held at some angle: it is nearly level at the end of the day').toBe(true);
    expect(elevation(sky(6.2).direction) < elevation(sky(6.4).direction), 'and keeps rising after sunrise').toBe(true);
  });

  it('the moon is opposite the sun, and dawn is dusk the other way round', () => {
    const noon = sky(12).direction;
    const midnight = sky(0).direction;
    expect(Math.abs(noon.x + midnight.x) < 1e-9 && Math.abs(noon.z + midnight.z) < 1e-9, 'opposite over the ground').toBe(true);
    expect(Math.abs(elevation(noon) - elevation(midnight)), 'as high as the sun').toBeLessThan(1e-9);

    for (const offset of [1, 3.3, 5.9, 7.2, 10]) {
      const morning = sky(12 - offset);
      const evening = sky(12 + offset);
      for (const field of ['keyColor', 'hemiSky', 'hemiGround', 'background'] as const) {
        expect(morning[field], `${field} mirrored at ±${offset}`).toBe(evening[field]);
      }
      for (const field of ['keyIntensity', 'shadow', 'hemiIntensity'] as const) {
        expect(Math.abs(morning[field] - evening[field]), `${field} mirrored at ±${offset}`).toBeLessThan(1e-9);
      }
    }
  });

  it('the sun rises in the east and sets in the west, and at noon the light comes from the south-west', () => {
    expect(sky(7.5).direction.x > sky(12).direction.x && sky(12).direction.x > sky(16.5).direction.x, 'east to west').toBe(true);
    const noon = sky(12).direction;
    expect(noon.x < 0 && noon.z > 0, 'from the south-west').toBe(true);
    expect(elevation(noon), 'high at noon: short shadows').toBeGreaterThan(45 * DEG);
  });

  it('shadows are strong by day, light by night, and gone in the twilight', () => {
    expect(sky(12).shadow, 'full by the sun').toBe(1);
    expect(sky(0).shadow > 0 && sky(0).shadow < 0.5, 'light by the moon').toBe(true);
    expect(sky(6).shadow, 'no shadow at dawn').toBe(0);
    expect(sky(18).shadow, 'no shadow at dusk').toBe(0);
    expect(sky(6).keyIntensity, 'no key light at dawn').toBe(0);
    expect(sky(18).keyIntensity, 'no key light at dusk').toBe(0);
    expect(sky(12).keyIntensity, 'the sun is much brighter than the moon').toBeGreaterThan(4 * sky(0).keyIntensity);
    expect(sky(0, { nightShadow: 0.9 }).shadow, 'the strength is tuned apart for the night').toBeGreaterThan(sky(0).shadow);
    expect(sky(12, { dayShadow: 0.5 }).shadow, 'and for the day').toBeLessThan(sky(12).shadow);
  });

  it('the shadows fade out smoothly over a few degrees of the light, while it keeps moving; the moon brings its own later', () => {
    const fade = { shadowFadeAngle: 20, shadowFadeRange: 8 };
    const evening: SkyState[] = Array.from({ length: 200 }, (_, i) => sky(14 + i * 0.02, fade));
    for (let i = 1; i < evening.length; i++) {
      expect(evening[i].shadow, 'the shadow only weakens through the evening').toBeLessThanOrEqual(evening[i - 1].shadow + 1e-9);
      expect(Math.abs(evening[i].shadow - evening[i - 1].shadow), 'and without a jump').toBeLessThan(0.08);
      if (elevation(evening[i].direction) >= 20 * DEG) expect(evening[i].shadow, 'full above the fade angle').toBe(1);
      if (elevation(evening[i].direction) <= 12 * DEG) expect(evening[i].shadow, 'none below the end of the fade').toBe(0);
    }
    const strong = evening.find((state) => elevation(state.direction) < 20 * DEG)!;
    expect(strong.shadow, 'it starts to fade at the set angle').toBeGreaterThan(0.9);
    expect(elevation(strong.direction) > 12 * DEG && evening.some((state) => elevation(state.direction) < 12 * DEG), 'the light goes on moving after it').toBe(true);

    expect(sky(16, fade).shadow === 1 && sky(16, fade).shadow >= sky(16.8, fade).shadow, 'long afternoon shadows are still there').toBe(true);
    expect(sky(21, fade).shadow > 0 && sky(19, fade).shadow < sky(21, fade).shadow, 'the moon casts them again as it climbs').toBe(true);
    expect(sky(17, { ...fade, shadowFadeAngle: 40 }).shadow, 'a higher angle fades them earlier').toBeLessThan(sky(17, fade).shadow);
    expect(sky(17, { ...fade, shadowFadeRange: 20 }).shadow, 'a longer range keeps them lower, fading more slowly').toBeGreaterThan(sky(17, fade).shadow);
  });

  it('the sky changes smoothly: only where the light is nil may its direction jump', () => {
    const step = 0.01;
    for (let hour = 0; hour < 24; hour += step) {
      const a = sky(hour);
      const b = sky(hour + step);
      expect(Math.abs(a.keyIntensity - b.keyIntensity), `light does not jump at ${hour}`).toBeLessThan(0.05);
      expect(Math.abs(a.shadow - b.shadow), `shadow does not jump at ${hour}`).toBeLessThan(0.05);
      expect(Math.abs(a.hemiIntensity - b.hemiIntensity), `sky light does not jump at ${hour}`).toBeLessThan(0.05);
      const turn = Math.hypot(a.direction.x - b.direction.x, a.direction.y - b.direction.y, a.direction.z - b.direction.z);
      if (turn > 0.05) {
        expect(a.keyIntensity < 0.05 && b.keyIntensity < 0.05 && a.shadow < 0.05 && b.shadow < 0.05, `the light jumps at ${hour} unseen`).toBe(true);
      }
    }
  });

  it('it is brighter by day than by night, and the colours are warm by day, blue by night', () => {
    const day = sky(12);
    const night = sky(0);
    expect(day.hemiIntensity > night.hemiIntensity && day.keyIntensity > night.keyIntensity).toBe(true);
    const channels = (color: number) => ({ r: color >> 16, g: (color >> 8) & 255, b: color & 255 });
    const warm = channels(day.keyColor);
    const cold = channels(night.keyColor);
    expect(warm.r > warm.b, 'the sun is warm').toBe(true);
    expect(cold.b > cold.r, 'the moon is blue').toBe(true);
    const dusk = channels(sky(17.2).keyColor);
    expect(dusk.r - dusk.b > warm.r - warm.b, 'and the low sun is more orange still').toBe(true);
  });

  it('hours outside the day are the same hours', () => {
    for (const [outside, inside] of [[25, 1], [-1, 23], [24, 0]]) {
      const a = sky(outside);
      const b = sky(inside);
      expect(a.sun).toBe(b.sun);
      expect(a.keyColor).toBe(b.keyColor);
      expect(Math.abs(a.keyIntensity - b.keyIntensity)).toBeLessThan(1e-9);
      expect(Math.abs(a.direction.x - b.direction.x) < 1e-9 && Math.abs(a.direction.z - b.direction.z) < 1e-9).toBe(true);
    }
    expect(horizontal(sky(3).direction)).toBeGreaterThan(0);
  });
});
