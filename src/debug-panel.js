const REFRESH_SECONDS = 0.1; // how often the readouts are redrawn
const TOGGLE_KEY = 'F3';
const MODE_KEY = 'block-walker-debug-mode';
const MODES = ['off', 'full', 'fps']; // the order F3 goes through; fps = only the readouts of the header, a tiny box

function loadMode() {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    return MODES.includes(stored) ? stored : MODES[0];
  } catch {
    return MODES[0]; // no storage, or it is blocked
  }
}

function el(tag, props = {}, ...children) {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

// The debug panel at the side of the screen, F3 goes through off, the whole panel and only the frame rate in a tiny box
// (the mode is kept between reloads). The game keeps running behind it.
// - State: readouts that code registers with watch(), redrawn a few times a second.
// - Tunables: a slider and a number for each, with a reset. They take effect at once and are kept between reloads.
// - Sections: an accordion, one section per group of tunables (and the readouts of that group), only one open at a time.
// - Copy: all numbers and the readouts as text, to pass on.
// The markup shell is in index.html; everything in it is built here, so a new tunable or readout needs no markup.
export class DebugPanel {
  constructor(tunables) {
    this.tunables = tunables;
    this.readouts = [];
    this.controls = new Map(); // tunable key -> { slider, number, reset }
    this.sections = new Map(); // group -> { state, body }
    this.sinceRefresh = 0;
    this.root = document.querySelector('#debug');

    this.header = el('div', { className: 'debug-header' }, el('h2', { textContent: `Debug (${TOGGLE_KEY})` })); // readouts of no group go to its left
    this.accordion = el('div', { className: 'debug-sections' });
    this.createTunables();
    this.report = el('textarea', { readOnly: true, rows: 8, hidden: true });
    const copy = el('button', { textContent: 'Copy all numbers' });
    const resetAll = el('button', { textContent: 'Reset all' });
    copy.addEventListener('click', () => this.copy());
    resetAll.addEventListener('click', () => {
      tunables.resetAll();
      for (const spec of tunables.specs) this.sync(spec);
    });
    this.root.append(this.header, this.accordion, el('div', { className: 'debug-actions' }, copy, resetAll), this.report);

    // The game must neither feel the panel's keys nor take the cursor over it for aiming.
    for (const type of ['keydown', 'keyup', 'pointermove']) this.root.addEventListener(type, (e) => e.stopPropagation());
    // After a change or a press the focus goes back to the game, or its keys would go to the control and stop there.
    this.root.addEventListener('change', (e) => e.target.blur());
    this.root.addEventListener('click', (e) => {
      if (e.target.closest('button, summary')) e.target.blur();
    });
    // Capture phase: the toggle works also while a control of the panel has the focus.
    addEventListener('keydown', (e) => {
      if (e.code !== TOGGLE_KEY || e.repeat) return;
      e.preventDefault();
      this.setMode(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]);
    }, true);
    this.setMode(loadMode());
  }

  get open() {
    return this.mode !== 'off';
  }

  // off, the whole panel or just the header with its readouts. The header stays where it is in the last two, so the readout
  // does not jump. The mode is kept in the browser, the next load starts in it. The whole panel opens with all sections closed.
  setMode(mode) {
    this.mode = mode;
    this.root.hidden = mode === 'off';
    this.root.dataset.mode = mode;
    this.sinceRefresh = REFRESH_SECONDS; // the readouts are drawn at once, not an instant later
    if (mode === 'full') for (const { details } of this.sections.values()) details.open = false;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // the mode then lasts until the page is closed
    }
  }

  // A readout; read returns what to show. With a group it is a line in that section, next to the tunables of the group;
  // without, it is "label: value" in the header, at its left edge, the title is at the right.
  watch(label, read, group = null) {
    const value = el('span');
    if (group) this.section(group).state.append(el('div', {}, el('span', { textContent: label }), value));
    else this.header.append(el('span', {}, `${label}: `, value));
    this.readouts.push({ label, read, value });
  }

  // The section of a group, made when first needed. The sections share a name, so that the browser keeps one of them open
  // at most; all are closed whenever the panel opens.
  section(group) {
    if (!this.sections.has(group)) {
      const state = el('div', { className: 'debug-state' });
      const body = el('div', { className: 'debug-body' }, state);
      const details = el('details', { name: 'debug-sections' }, el('summary', { textContent: group }), body);
      this.sections.set(group, { state, body, details });
      this.accordion.append(details);
    }
    return this.sections.get(group);
  }

  update(dt) {
    this.sinceRefresh += dt;
    if (!this.open || this.sinceRefresh < REFRESH_SECONDS) return;
    this.sinceRefresh = 0;
    for (const { read, value } of this.readouts) value.textContent = read();
    for (const spec of this.tunables.specs) {
      if (spec.live && !this.controls.get(spec.key).isHeld()) this.sync(spec); // the game moves it; not while it is in a hand
    }
  }

  createTunables() {
    for (const spec of this.tunables.specs) this.section(spec.group).body.append(this.createControl(spec));
  }

  createControl(spec) {
    const range = { min: spec.min, max: spec.max, step: spec.step };
    const slider = el('input', { type: 'range', ...range });
    const number = el('input', { type: 'number', ...range });
    const reset = el('button', { textContent: '↺', title: `Default: ${spec.value}` });
    this.controls.set(spec.key, { slider, number, reset, isHeld: () => document.activeElement === slider || document.activeElement === number });

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
