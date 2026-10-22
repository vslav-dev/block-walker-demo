import type { TunableSpec } from '@game/core/tunables';

// How far and how steeply the camera looks at the player, as a function of the zoom. Pure logic, no rendering.
// The zoom is a position from 0 (closest) to 1 (farthest). Each end is described by two plain numbers, a distance and
// a pitch (the angle of the view down from the horizon), and everything between is blended from them: so a view that
// looks good at the ends is exactly what these four numbers say, and they are what the debug panel tunes.
// The wheel part is taken from the other projects (coldseed, hex-planet-demo), where it was tuned for the Magic Mouse
// and trackpads: the wheel moves the target by the pixels it scrolled, and the shown zoom eases towards the target.
// A smooth swipe is a stream of small events and zooms smoothly; a notched wheel gives steps that the easing blends.
export interface ZoomTuning {
  distanceNear: number;
  distanceFar: number;
  pitchNear: number;
  pitchFar: number;
  wheelPixels: number;
}

export const ZOOM_TUNABLES: readonly TunableSpec[] = [
  { key: 'distanceNear', group: 'Camera', label: 'Distance, closest', min: 5, max: 60, step: 0.5, value: 20 },
  { key: 'distanceFar', group: 'Camera', label: 'Distance, farthest', min: 5, max: 60, step: 0.5, value: 30 },
  { key: 'pitchNear', group: 'Camera', label: 'Pitch, closest (°)', min: 10, max: 89, step: 1, value: 25 },
  { key: 'pitchFar', group: 'Camera', label: 'Pitch, farthest (°)', min: 10, max: 89, step: 1, value: 60 },
  { key: 'wheelPixels', group: 'Camera', label: 'Scroll for the whole range (px)', min: 100, max: 1500, step: 10, value: 300 },
];

const START = 0.5;
const SPEED = 7.7; // per second; the other projects ease 12 % per frame, which at 60 fps is this

export class Zoom {
  target = START;
  value = START; // what the camera shows, eases towards the target

  // tuning = the values of ZOOM_TUNABLES, read on every use, so a change shows at once.
  constructor(private readonly tuning: ZoomTuning) {}

  // pixels = scrolled since the last call; positive = away from the screen = farther.
  update(dt: number, pixels: number): void {
    this.target = Math.min(1, Math.max(0, this.target + pixels / this.tuning.wheelPixels));
    this.value += (this.target - this.value) * (1 - Math.exp(-SPEED * dt));
  }

  // Blended in proportion, so that a pixel of scrolling changes the distance by the same percent anywhere.
  get distance(): number {
    const { distanceNear, distanceFar } = this.tuning;
    return distanceNear * (distanceFar / distanceNear) ** this.value;
  }

  // In radians. Closer is flatter, so that zooming in opens the view ahead of the character instead of narrowing it.
  get pitch(): number {
    const { pitchNear, pitchFar } = this.tuning;
    return ((pitchNear + (pitchFar - pitchNear) * this.value) * Math.PI) / 180;
  }
}
