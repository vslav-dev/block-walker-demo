// Keyboard (physical key codes, so it works on any layout), the mouse position in normalized device coordinates
// and the aim mode: the right button toggles it or, by the settings, holds it. While aiming the pointer is captured
// and only its movement is read.
export class Input {
  constructor(element, settings) {
    this.element = element;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0 };
    this.aiming = false;
    this.lookX = 0; // mouse movement to the right in pixels since takeLookX()

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    // The right button belongs to the game, not to the browser menu.
    addEventListener('contextmenu', (e) => e.preventDefault());

    element.addEventListener('pointerdown', (e) => {
      if (e.button === 2) this.setAiming(settings.aimToggle ? !this.aiming : true);
    });
    addEventListener('pointerup', (e) => {
      if (e.button === 2 && !settings.aimToggle) this.setAiming(false);
    });
    // The lock is lost on Escape or when the window loses focus; it may also arrive after the button was released.
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== element) this.aiming = false;
      else if (!this.aiming) document.exitPointerLock();
    });
    document.addEventListener('pointerlockerror', () => (this.aiming = false));

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

  setAiming(on) {
    this.aiming = on;
    if (on) Promise.resolve(this.element.requestPointerLock()).catch(() => {}); // a refusal is reported by pointerlockerror
    else document.exitPointerLock();
  }

  // Lets go of everything held: pressed keys and the aim mode.
  reset() {
    this.keys.clear();
    this.lookX = 0;
    this.setAiming(false);
  }

  takeLookX() {
    const x = this.lookX;
    this.lookX = 0;
    return x;
  }

  axis(negative, positive) {
    const pressed = (codes) => codes.some((code) => this.keys.has(code));
    return (pressed(positive) ? 1 : 0) - (pressed(negative) ? 1 : 0);
  }
}
