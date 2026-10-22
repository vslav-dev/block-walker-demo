export const MAX_PIXEL_RATIO = 2;
export const ANTIALIAS_BELOW_RATIO = 2; // a screen with this many device pixels to a CSS pixel or more is drawn without smoothing the edges
// Frames come no faster than 60 a second: on a screen of 120 or 144 Hz some of them are left out. A frame may come a little
// early (the screens do not keep time to the millisecond), so that the ones on a screen of 60 Hz are never left out.
export const FRAME_MILLISECONDS = 1000 / 60;
export const FRAME_EARLY_MILLISECONDS = 2;

// The camera of the view.
export const CAMERA_FOV = 30;
export const CAMERA_NEAR = 1;
export const CAMERA_FAR = 250;

export const MAX_FRAME_SECONDS = 0.05; // a longer frame (a hidden tab, a stall) is played as this long, so nothing leaps
export const FPS_SMOOTHING = 0.05; // how fast the shown frame rate follows the real one
export const STAIRS_SMOOTHING_SPEED = 25; // how fast the drawn height follows the body's: smooths the steps of stairs
