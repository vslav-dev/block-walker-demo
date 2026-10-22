// How sharp the picture is drawn, kept so that the frames come at the pace of the screen. The cost of a frame is mostly what is
// done for every pixel, so what a computer cannot do is made smaller by drawing fewer pixels: when the frames are late, the
// ratio of the drawn pixels to the pixels of the screen goes down by a step, and when they have been on time for a while, it
// goes up by one, but never back to the level where they were late, until that has been forgotten.
const SLOW_SECONDS = 1 / 50; // the mean length of a frame over a window that is too long: late
const WINDOW_SECONDS = 1;
const WARMUP_SECONDS = 2; // the shaders compile and the card speeds up: the first frames say nothing
const STALL_SECONDS = 0.1; // a frame longer than this (a hidden tab, a stall) counts as this long
const CALM_SECONDS = 5; // on time for this long: try a sharper picture
const FORGET_SECONDS = 30; // after this long a level that was too slow is tried again
const STEP = 0.25;
const MIN_RATIO = 0.5;

export class ResolutionGovernor {
  private warmup = WARMUP_SECONDS;
  private elapsed = 0; // of the window now
  private frames = 0;
  private calm = 0; // seconds on time since the last change
  private sinceSlow = 0;
  private slowAt = Infinity; // the lowest ratio at which the frames were late

  constructor(
    public ratio: number,
    private readonly max: number,
  ) {}

  // Called with the length of every frame in seconds. Returns the new ratio when it has to change, else null.
  update(seconds: number): number | null {
    if (this.warmup > 0) {
      this.warmup -= seconds;
      return null;
    }
    this.elapsed += Math.min(seconds, STALL_SECONDS);
    this.frames++;
    if (this.elapsed < WINDOW_SECONDS) return null;

    const window = this.elapsed;
    const mean = window / this.frames;
    this.elapsed = 0;
    this.frames = 0;
    this.sinceSlow += window;
    if (this.sinceSlow >= FORGET_SECONDS) this.slowAt = Infinity;

    if (mean > SLOW_SECONDS) {
      this.slowAt = this.ratio;
      this.sinceSlow = 0;
      this.calm = 0;
      return this.change(this.ratio - STEP);
    }
    this.calm += window;
    if (this.calm >= CALM_SECONDS && this.ratio + STEP < this.slowAt) {
      this.calm = 0;
      return this.change(this.ratio + STEP);
    }
    return null;
  }

  private change(ratio: number): number | null {
    const next = Math.min(this.max, Math.max(MIN_RATIO, ratio));
    if (next === this.ratio) return null;
    this.ratio = next;
    return next;
  }
}
