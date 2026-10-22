import type { GameSettings } from '@game/settings';
import { wheelPixels } from './wheel';

// Keyboard (physical key codes, so it works on any layout), the mouse position in normalized device coordinates
// and the aim mode: the right button toggles it or, by the settings, holds it. While aiming the pointer is captured
// and only its movement is read; if the browser takes the pointer back, the mode stays on and a click takes it again.
// The wheel (or a swipe on a Magic Mouse or a trackpad, a pinch too) is read in pixels.
export class Input {
  readonly mouse = { x: 0, y: 0 };
  aiming = false; // the aim mode is on; it ends only by the aim button, never by itself
  private readonly keys = new Set<string>();
  private lookX = 0; // mouse movement to the right in pixels since takeLookX()
  private wheelY = 0; // scrolling in pixels since takeWheelY(), positive = away from the screen
  private readonly listeners = new AbortController();

  constructor(
    private readonly element: HTMLElement,
    private readonly settings: Pick<GameSettings, 'aimToggle'>,
  ) {
    const { signal } = this.listeners;
    addEventListener('keydown', (e) => this.keys.add(e.code), { signal });
    addEventListener('keyup', (e) => this.keys.delete(e.code), { signal });
    addEventListener('blur', () => this.keys.clear(), { signal });
    // The right button belongs to the game, not to the browser menu.
    addEventListener('contextmenu', (e) => e.preventDefault(), { signal });

    element.addEventListener(
      'pointerdown',
      (e) => {
        if (this.aiming && !this.captured) this.resume(); // the aim mode is still on: any click takes the pointer again
        else if (e.button === 2) this.setAiming(this.settings.aimToggle ? !this.aiming : true);
      },
      { signal },
    );
    addEventListener(
      'pointerup',
      (e) => {
        if (e.button === 2 && !this.settings.aimToggle) this.setAiming(false);
      },
      { signal },
    );
    // The browser takes the pointer back on Escape and when the window loses focus. That does not end the aim mode, a click
    // takes the pointer again. A pointer that arrives after the aim mode has ended is given back.
    document.addEventListener(
      'pointerlockchange',
      () => {
        if (this.captured && !this.aiming) document.exitPointerLock();
      },
      { signal },
    );

    // Not passive: the page itself must not scroll or, with a pinch, zoom.
    element.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.wheelY += wheelPixels(e.deltaY, e.deltaMode, innerHeight);
      },
      { passive: false, signal },
    );

    addEventListener(
      'pointermove',
      (e) => {
        if (document.pointerLockElement) {
          this.lookX += e.movementX;
          return;
        }
        this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
      },
      { signal },
    );
  }

  // x: -1 = left, +1 = right. z: -1 = up the screen, +1 = down the screen.
  moveAxis(): { x: number; z: number } {
    return {
      x: this.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']),
      z: this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    };
  }

  get running(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  get captured(): boolean {
    return document.pointerLockElement === this.element;
  }

  // Takes the pointer for the aim mode if it is on and the pointer is free. The browser grants it only on a click or a key,
  // so call it from one, and a refusal is no harm: the next click does it.
  resume(): void {
    if (!this.aiming || this.captured) return;
    Promise.resolve(this.element.requestPointerLock()).catch(() => {});
  }

  // Forgets the pressed keys and the motion not yet read; the aim mode stays.
  reset(): void {
    this.keys.clear();
    this.lookX = 0;
    this.wheelY = 0;
  }

  takeLookX(): number {
    const x = this.lookX;
    this.lookX = 0;
    return x;
  }

  takeWheelY(): number {
    const y = this.wheelY;
    this.wheelY = 0;
    return y;
  }

  // Stops listening and gives the pointer back.
  dispose(): void {
    this.listeners.abort();
    if (this.captured) document.exitPointerLock();
  }

  private setAiming(on: boolean): void {
    this.aiming = on;
    if (on) this.resume();
    else document.exitPointerLock();
  }

  private axis(negative: readonly string[], positive: readonly string[]): number {
    const pressed = (codes: readonly string[]) => codes.some((code) => this.keys.has(code));
    return (pressed(positive) ? 1 : 0) - (pressed(negative) ? 1 : 0);
  }
}
