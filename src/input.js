// Keyboard (physical key codes, so it works on any layout) and mouse position in normalized device coordinates.
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0 };

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('pointermove', (e) => {
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

  axis(negative, positive) {
    const pressed = (codes) => codes.some((code) => this.keys.has(code));
    return (pressed(positive) ? 1 : 0) - (pressed(negative) ? 1 : 0);
  }
}
