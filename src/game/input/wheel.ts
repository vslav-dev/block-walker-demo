const LINE_PX = 18; // a wheel that scrolls by lines: one line in pixels
const WHEEL_MAX_PX = 60; // one wheel event counts at most this much, so a flick of a notched wheel is not a leap

// How far a wheel event scrolled, in pixels, whatever its unit (pixels for smooth devices, lines or pages for notched ones).
export function wheelPixels(deltaY: number, deltaMode: number, pageHeight: number): number {
  const px = deltaMode === 1 ? deltaY * LINE_PX : deltaMode === 2 ? deltaY * pageHeight : deltaY;
  return Math.min(WHEEL_MAX_PX, Math.max(-WHEEL_MAX_PX, px));
}
