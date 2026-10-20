// The day and the night as pure numbers: for an hour of the day, where the light comes from and what the sky and the light
// look like. No rendering here, see sky.js for that.
//
// One light casts the shadows, the sun by day and the moon by night: one shadow map is drawn per frame, and the two take turns
// at dusk and dawn, at the moment when the light and its shadow are zero, so that nobody sees the jump of its direction.
// The moon is always opposite the sun. The light goes down to the horizon, and its shadows would grow endless, so they fade:
// from a set angle of the light over a few degrees, they weaken to nothing while the light keeps moving. The twilight has none.
// The same happens when the moon rises.
export const DAY_SECONDS = 24 * 60; // a whole day at the normal speed of time: a minute of the game is a second of real time

export const DAY_TUNABLES = [
  { key: 'hour', group: 'Day and night', label: 'Time of day (h)', min: 0, max: 24, step: 0.05, value: 10, live: true },
  { key: 'timeFlow', group: 'Day and night', label: 'Speed of time (0 = stopped)', min: 0, max: 300, step: 0.5, value: 1 },
  { key: 'shadowFadeAngle', group: 'Day and night', label: 'Shadows start to fade at light angle (°)', min: 5, max: 60, step: 1, value: 15 },
  { key: 'shadowFadeRange', group: 'Day and night', label: 'Shadows fade out over (°)', min: 1, max: 30, step: 1, value: 8 },
  { key: 'dayShadow', group: 'Day and night', label: 'Shadow strength by the sun', min: 0, max: 1, step: 0.05, value: 1 },
  { key: 'nightShadow', group: 'Day and night', label: 'Shadow strength by the moon', min: 0, max: 1, step: 0.05, value: 0.4 },
];

const HOURS = 24;
const NOON = 12;
const TWILIGHT = 6; // hours from noon (and midnight) to the sunrise and the sunset
const ARC_LEAN = 0.7; // the path of the sun leans to the south, so that it is never straight overhead
const ARC_TURN = -0.6; // radians; the whole sky is turned so that the noon light comes from the south-west, and the shadows are seen

// How the light and the sky look at some distance in hours from noon; in between, linear. The day is the same before and after
// noon, and the night before and after midnight: dawn is dusk the other way round, and everything is mirrored.
// The twilight (6) has no light of its own: it is where the sun hands over to the moon. Its colour is neutral.
const KEYS = [
  { u: 0, keyColor: 0xffe8c8, keyIntensity: 2.6, hemiSky: 0xdfefff, hemiGround: 0x6b5a45, hemiIntensity: 1.3, background: 0x9ec9e8 }, // noon
  { u: 3, keyColor: 0xffdcae, keyIntensity: 2.5, hemiSky: 0xdfefff, hemiGround: 0x6b5a45, hemiIntensity: 1.25, background: 0x9ec9e8 },
  { u: 4.6, keyColor: 0xffa860, keyIntensity: 2.0, hemiSky: 0xf2d8c0, hemiGround: 0x6b5040, hemiIntensity: 1.0, background: 0xd8b090 }, // golden hour
  { u: 5.4, keyColor: 0xff7a3a, keyIntensity: 0.9, hemiSky: 0xb890a8, hemiGround: 0x4a3a46, hemiIntensity: 0.7, background: 0x8a6478 },
  { u: 6, keyColor: 0xb090c0, keyIntensity: 0, hemiSky: 0x6a68a0, hemiGround: 0x2c2a40, hemiIntensity: 0.55, background: 0x40406c }, // sun and moon swap
  { u: 6.8, keyColor: 0x8fa6ff, keyIntensity: 0.1, hemiSky: 0x3c4a88, hemiGround: 0x181b30, hemiIntensity: 0.42, background: 0x1c2650 }, // the darkest moment
  { u: 8.5, keyColor: 0x8aa2ff, keyIntensity: 0.45, hemiSky: 0x34468a, hemiGround: 0x12152a, hemiIntensity: 0.42, background: 0x111a42 },
  { u: 12, keyColor: 0x829cff, keyIntensity: 0.6, hemiSky: 0x2f4486, hemiGround: 0x0e1020, hemiIntensity: 0.42, background: 0x0b1236 }, // midnight
];
const NUMBER_FIELDS = ['keyIntensity', 'hemiIntensity'];
const COLOR_FIELDS = ['keyColor', 'hemiSky', 'hemiGround', 'background'];

const mix = (a, b, t) => a + (b - a) * t;

function mixColor(a, b, t) {
  let color = 0;
  for (const shift of [16, 8, 0]) color = (color << 8) | Math.round(mix((a >> shift) & 255, (b >> shift) & 255, t));
  return color;
}

function sampleKeys(u) {
  const next = KEYS.findIndex((key) => key.u > u);
  const from = KEYS[next === -1 ? KEYS.length - 2 : next - 1];
  const to = KEYS[next === -1 ? KEYS.length - 1 : next];
  const t = (u - from.u) / (to.u - from.u);
  const sample = {};
  for (const field of NUMBER_FIELDS) sample[field] = mix(from[field], to[field], t);
  for (const field of COLOR_FIELDS) sample[field] = mixColor(from[field], to[field], t);
  return sample;
}

// Unit vector from the ground to the light: the sun, or the moon opposite it.
function lightDirection(hour, sun) {
  const angle = ((hour - 6) / HOURS) * 2 * Math.PI; // 0 at the sunrise, a quarter turn at noon
  const side = sun ? 1 : -1; // the moon is the sun turned over the centre of the sky
  const length = Math.hypot(Math.cos(angle), Math.sin(angle), ARC_LEAN);
  const x = (side * Math.cos(angle)) / length;
  const z = (side * ARC_LEAN) / length;
  return {
    x: x * Math.cos(ARC_TURN) + z * Math.sin(ARC_TURN),
    y: (side * Math.sin(angle)) / length,
    z: z * Math.cos(ARC_TURN) - x * Math.sin(ARC_TURN),
  };
}

// 0 below `from - range` degrees of the light's height, 1 above `from`, smooth in between.
function shadowFade(direction, from, range) {
  const t = Math.min(1, Math.max(0, (Math.asin(direction.y) * (180 / Math.PI) - (from - range)) / range));
  return t * t * (3 - 2 * t);
}

// The hour after dt seconds, wrapped round the day. flow = how fast time goes, 1 = normal, 0 = stopped.
export const advanceHour = (hour, dt, flow) => (hour + (dt * flow * HOURS) / DAY_SECONDS) % HOURS;

export const formatHour = (hour) => {
  const minutes = Math.floor(hour * 60) % (HOURS * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

// The sky at an hour (0..24; 12 = noon, 0 = midnight), tuning = the values of DAY_TUNABLES.
// { sun, direction, keyColor, keyIntensity, shadow, hemiSky, hemiGround, hemiIntensity, background }:
// sun = the key light is the sun (else the moon), shadow = how dark its shadows are, 0..1; colours are 0xrrggbb.
export function skyAt(hour, { shadowFadeAngle, shadowFadeRange, dayShadow, nightShadow }) {
  const u = Math.abs((((hour % HOURS) + HOURS) % HOURS) - NOON);
  const sun = u < TWILIGHT;
  const direction = lightDirection(hour, sun);
  return {
    ...sampleKeys(u),
    sun,
    direction,
    shadow: shadowFade(direction, shadowFadeAngle, shadowFadeRange) * (sun ? dayShadow : nightShadow),
  };
}
