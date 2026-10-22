import { Injectable, signal } from '@angular/core';
import { readStorage, writeStorage } from '@app/services/browser-storage';
import { parseSettings, type GameSettings } from '@game/settings';

// v2: the unit of the mouse sensitivity changed (1 is now the usual one, the range is around it), old numbers would be read wrong.
const STORAGE_KEY = 'block-walker-settings-v2';

// The player's choices, kept in the browser between visits. The screens change them through the signals, the game
// reads them as plain values, on every use.
@Injectable({
  providedIn: 'root',
})
export class SettingsService implements GameSettings {
  private readonly stored = parseSettings(readStorage(STORAGE_KEY));

  readonly aimToggle$$ = signal(this.stored.aimToggle);
  readonly mouseSensitivity$$ = signal(this.stored.mouseSensitivity);

  get aimToggle(): boolean {
    return this.aimToggle$$();
  }

  get mouseSensitivity(): number {
    return this.mouseSensitivity$$();
  }

  setAimToggle(value: boolean): void {
    this.aimToggle$$.set(value);
    this.save();
  }

  setMouseSensitivity(value: number): void {
    this.mouseSensitivity$$.set(value);
    this.save();
  }

  private save(): void {
    writeStorage(STORAGE_KEY, JSON.stringify({ aimToggle: this.aimToggle, mouseSensitivity: this.mouseSensitivity }));
  }
}
