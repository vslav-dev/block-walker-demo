const LINE_PX = 18; // a wheel that scrolls by lines: one line in pixels
const WHEEL_MAX_PX = 60; // one wheel event counts at most this much, so a flick of a notched wheel is not a leap

// How far a wheel event scrolled, in pixels, whatever its unit (pixels for smooth devices, lines or pages for notched ones).
export function wheelPixels(deltaY, deltaMode, pageHeight) {
  const px = deltaMode === 1 ? deltaY * LINE_PX : deltaMode === 2 ? deltaY * pageHeight : deltaY;
  return Math.min(WHEEL_MAX_PX, Math.max(-WHEEL_MAX_PX, px));
}

// Keyboard (physical key codes, so it works on any layout), the mouse position in normalized device coordinates
// and the aim mode: the right button toggles it or, by the settings, holds it. While aiming the pointer is captured
// and only its movement is read; if the browser takes the pointer back, the mode stays on and a click takes it again.
// The wheel (or a swipe on a Magic Mouse or a trackpad, a pinch too) is read in pixels.
export class Input {
  constructor(element, settings) {
    this.element = element;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0 };
    this.aiming = false; // the aim mode is on; it ends only by the aim button, never by itself
    this.lookX = 0; // mouse movement to the right in pixels since takeLookX()
    this.wheelY = 0; // scrolling in pixels since takeWheelY(), positive = away from the screen

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    // The right button belongs to the game, not to the browser menu.
    addEventListener('contextmenu', (e) => e.preventDefault());

    element.addEventListener('pointerdown', (e) => {
      if (this.aiming && !this.captured) this.resume(); // the aim mode is still on: any click takes the pointer again
      else if (e.button === 2) this.setAiming(settings.aimToggle ? !this.aiming : true);
    });
    addEventListener('pointerup', (e) => {
      if (e.button === 2 && !settings.aimToggle) this.setAiming(false);
    });
    // The browser takes the pointer back on Escape and when the window loses focus. That does not end the aim mode, a click
    // takes the pointer again. A pointer that arrives after the aim mode has ended is given back.
    document.addEventListener('pointerlockchange', () => {
      if (this.captured && !this.aiming) document.exitPointerLock();
    });

    // Not passive: the page itself must not scroll or, with a pinch, zoom.
    element.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheelY += wheelPixels(e.deltaY, e.deltaMode, innerHeight);
    }, { passive: false });

    addEventListener('pointermove', (e) => {
      if (document.pointerLockElement) {
        this.lookX += e.movementX;
        return;
      }
      this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    });
  }

  // x: -1 = left, +1 = right. z: -1 = up the screen, +1 = down the screen.
  moveAxis() {
    return {
      x: this.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']),
      z: this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    };
  }

  get running() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  get captured() {
    return document.pointerLockElement === this.element;
  }

  setAiming(on) {
    this.aiming = on;
    if (on) this.resume();
    else document.exitPointerLock();
  }

  // Takes the pointer for the aim mode if it is on and the pointer is free. The browser grants it only on a click or a key,
  // so call it from one, and a refusal is no harm: the next click does it.
  resume() {
    if (!this.aiming || this.captured) return;
    Promise.resolve(this.element.requestPointerLock()).catch(() => {});
  }

  // Forgets the pressed keys and the motion not yet read; the aim mode stays.
  reset() {
    this.keys.clear();
    this.lookX = 0;
    this.wheelY = 0;
  }

  takeLookX() {
    const x = this.lookX;
    this.lookX = 0;
    return x;
  }

  takeWheelY() {
    const y = this.wheelY;
    this.wheelY = 0;
    return y;
  }

  axis(negative, positive) {
    const pressed = (codes) => codes.some((code) => this.keys.has(code));
    return (pressed(positive) ? 1 : 0) - (pressed(negative) ? 1 : 0);
  }
}
