// v2: the unit of the mouse sensitivity changed (1 is now the usual one, the range is around it), old numbers would be read wrong.
const STORAGE_KEY = 'block-walker-settings-v2';
export const SENSITIVITY_RANGE = { min: 0.5, max: 1.5 }; // as far below the usual 1 as above it

// The player's choices, kept in the browser between visits. Unknown or broken stored values fall back to the defaults.
export class Settings {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.aimToggle = true; // the aim button switches the mode on and off; off = the mode lasts while the button is held
    this.mouseSensitivity = 1; // times the usual turning speed of the aim mode
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
