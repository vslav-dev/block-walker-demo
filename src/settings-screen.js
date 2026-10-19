import { SENSITIVITY_RANGE } from './settings.js';

// The settings page over the game: the gear button opens it, the game stands still while it is open.
// The markup is in index.html; this only wires it to the settings.
export class SettingsScreen {
  // onOpen is called when the page opens, to drop what the game holds on to (pressed keys),
  // onResume when it is closed, to take back what it let go of (the pointer in the aim mode).
  constructor(settings, { onOpen, onResume }) {
    this.settings = settings;
    this.onOpen = onOpen;
    this.onResume = onResume;
    this.root = document.querySelector('#settings');
    const aimToggle = document.querySelector('#aim-toggle');
    const sensitivity = document.querySelector('#sensitivity');
    const sensitivityValue = document.querySelector('#sensitivity-value');

    const showSensitivity = () => (sensitivityValue.textContent = `${settings.mouseSensitivity.toFixed(2)}×`);
    Object.assign(sensitivity, { min: SENSITIVITY_RANGE.min, max: SENSITIVITY_RANGE.max, step: 0.05, value: settings.mouseSensitivity });
    aimToggle.checked = settings.aimToggle;
    showSensitivity();

    aimToggle.addEventListener('change', () => {
      settings.aimToggle = aimToggle.checked;
      settings.save();
    });
    sensitivity.addEventListener('input', () => {
      settings.mouseSensitivity = Number(sensitivity.value);
      showSensitivity();
      settings.save();
    });
    document.querySelector('#settings-open').addEventListener('click', () => this.show());
    document.querySelector('#settings-close').addEventListener('click', () => this.hide());
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.hide(); // a click beside the panel
    });
  }

  get open() {
    return !this.root.hidden;
  }

  show() {
    this.onOpen();
    this.root.hidden = false;
    document.activeElement?.blur(); // Space or Enter must not press the gear again
  }

  hide() {
    this.root.hidden = true;
    document.activeElement?.blur(); // Space or Enter must not press the focused control again
    this.onResume();
  }
}
