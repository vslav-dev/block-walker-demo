const REFRESH_SECONDS = 0.1; // how often the readouts are redrawn
const TOGGLE_KEY = 'F3';

function el(tag, props = {}, ...children) {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

// The debug panel at the side of the screen, F3 opens and closes it. The game keeps running behind it.
// - State: readouts that code registers with watch(), redrawn a few times a second.
// - Tunables: a slider and a number for each, with a reset. They take effect at once and are kept between reloads.
// - Copy: all numbers and the readouts as text, to pass on.
// The markup shell is in index.html; everything in it is built here, so a new tunable or readout needs no markup.
export class DebugPanel {
  constructor(tunables) {
    this.tunables = tunables;
    this.readouts = [];
    this.controls = new Map(); // tunable key -> { slider, number, reset }
    this.sinceRefresh = 0;
    this.root = document.querySelector('#debug');

    this.state = el('div', { className: 'debug-state' });
    this.report = el('textarea', { readOnly: true, rows: 8, hidden: true });
    const copy = el('button', { textContent: 'Copy all numbers' });
    const resetAll = el('button', { textContent: 'Reset all' });
    copy.addEventListener('click', () => this.copy());
    resetAll.addEventListener('click', () => {
      tunables.resetAll();
      for (const spec of tunables.specs) this.sync(spec);
    });
    this.root.append(el('h2', { textContent: `Debug (${TOGGLE_KEY})` }), this.state, ...this.createTunables(), el('div', { className: 'debug-actions' }, copy, resetAll), this.report);

    // The game must neither feel the panel's keys nor take the cursor over it for aiming.
    for (const type of ['keydown', 'keyup', 'pointermove']) this.root.addEventListener(type, (e) => e.stopPropagation());
    // After a change or a press the focus goes back to the game, or its keys would go to the control and stop there.
    this.root.addEventListener('change', (e) => e.target.blur());
    this.root.addEventListener('click', (e) => {
      if (e.target instanceof HTMLButtonElement) e.target.blur();
    });
    // Capture phase: the toggle works also while a control of the panel has the focus.
    addEventListener('keydown', (e) => {
      if (e.code !== TOGGLE_KEY || e.repeat) return;
      e.preventDefault();
      this.root.hidden = !this.root.hidden;
    }, true);
  }

  get open() {
    return !this.root.hidden;
  }

  // A line in the state section; read returns what to show.
  watch(label, read) {
    const value = el('span');
    this.state.append(el('div', {}, el('span', { textContent: label }), value));
    this.readouts.push({ label, read, value });
  }

  update(dt) {
    this.sinceRefresh += dt;
    if (!this.open || this.sinceRefresh < REFRESH_SECONDS) return;
    this.sinceRefresh = 0;
    for (const { read, value } of this.readouts) value.textContent = read();
  }

  createTunables() {
    const groups = new Map();
    for (const spec of this.tunables.specs) {
      if (!groups.has(spec.group)) groups.set(spec.group, el('div', { className: 'debug-group' }, el('h3', { textContent: spec.group })));
      groups.get(spec.group).append(this.createControl(spec));
    }
    return [...groups.values()];
  }

  createControl(spec) {
    const range = { min: spec.min, max: spec.max, step: spec.step };
    const slider = el('input', { type: 'range', ...range });
    const number = el('input', { type: 'number', ...range });
    const reset = el('button', { textContent: '↺', title: `Default: ${spec.value}` });
    this.controls.set(spec.key, { slider, number, reset });

    const change = (value) => {
      this.tunables.set(spec.key, value);
      this.sync(spec);
    };
    slider.addEventListener('input', () => change(Number(slider.value)));
    number.addEventListener('change', () => change(Number(number.value)));
    reset.addEventListener('click', () => {
      this.tunables.reset(spec.key);
      this.sync(spec);
    });
    this.sync(spec);
    return el('div', { className: 'debug-row' }, el('label', { textContent: spec.label }), el('div', {}, slider, number, reset));
  }

  // Shows the current value of a tunable in its controls.
  sync(spec) {
    const { slider, number, reset } = this.controls.get(spec.key);
    slider.value = number.value = this.tunables.values[spec.key];
    reset.disabled = !this.tunables.isChanged(spec.key);
  }

  // The numbers and the state as text, in the clipboard and in the box below, where it can be selected by hand.
  copy() {
    const state = this.readouts.map(({ label, read }) => `${label} = ${read()}`).join('\n');
    const text = `${this.tunables.report()}\n\n# State\n${state}`;
    this.report.value = text;
    this.report.hidden = false;
    this.report.select();
    navigator.clipboard?.writeText(text).catch(() => {}); // without the permission the box is still there
  }
}
