const STORAGE_KEY = 'block-walker-settings';
export const SENSITIVITY_RANGE = { min: 0.25, max: 3 };

// The player's choices, kept in the browser between visits. Unknown or broken stored values fall back to the defaults.
export class Settings {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.aimToggle = true; // the aim button switches the mode on and off; off = the mode lasts while the button is held
    this.mouseSensitivity = 1; // times the base turning speed of the aim mode
    this.load();
  }

  load() {
    let stored;
    try {
      stored = JSON.parse(this.storage.getItem(STORAGE_KEY));
    } catch {
      return; // nothing stored, unreadable, or no storage at all
    }
    if (typeof stored?.aimToggle === 'boolean') this.aimToggle = stored.aimToggle;
    if (Number.isFinite(stored?.mouseSensitivity)) {
      this.mouseSensitivity = Math.min(SENSITIVITY_RANGE.max, Math.max(SENSITIVITY_RANGE.min, stored.mouseSensitivity));
    }
  }

  save() {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify({ aimToggle: this.aimToggle, mouseSensitivity: this.mouseSensitivity }));
    } catch {
      // the settings then last until the page is closed
    }
  }
}
