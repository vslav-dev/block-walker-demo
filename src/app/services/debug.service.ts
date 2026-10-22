import { Injectable, signal } from '@angular/core';
import { readStorage, writeStorage } from '@app/services/browser-storage';

// The modes of the debug panel, in the order F3 goes through them: fps = only the readouts of the header, a tiny box.
export const DebugMode = {
  Off: 'off',
  Full: 'full',
  Fps: 'fps',
} as const;

export type DebugMode = (typeof DebugMode)[keyof typeof DebugMode];

const MODES: readonly DebugMode[] = Object.values(DebugMode);
const STORAGE_KEY = 'block-walker-debug-mode';

// The mode of the debug panel, kept in the browser, so that the next load starts in it.
@Injectable({
  providedIn: 'root',
})
export class DebugService {
  readonly mode$$ = signal(this.loadMode());

  cycleMode(): void {
    const next = MODES[(MODES.indexOf(this.mode$$()) + 1) % MODES.length];
    this.mode$$.set(next);
    writeStorage(STORAGE_KEY, next);
  }

  private loadMode(): DebugMode {
    const stored = readStorage(STORAGE_KEY);
    return MODES.find((mode) => mode === stored) ?? DebugMode.Off;
  }
}
