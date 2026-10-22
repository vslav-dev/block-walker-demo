import { DEFAULT_SETTINGS, SENSITIVITY_RANGE, parseSettings } from './settings';

describe('parseSettings', () => {
  it('without stored settings the defaults apply: toggle on, sensitivity 1', () => {
    expect(parseSettings(null)).toEqual({ aimToggle: true, mouseSensitivity: 1 });
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('settings survive a reload', () => {
    const stored = JSON.stringify({ aimToggle: false, mouseSensitivity: 1.5 });
    expect(parseSettings(stored)).toEqual({ aimToggle: false, mouseSensitivity: 1.5 });
  });

  it('broken or out-of-range stored values are ignored or clamped', () => {
    expect(parseSettings('not json').mouseSensitivity).toBe(1);
    expect(parseSettings(JSON.stringify({ aimToggle: 'yes', mouseSensitivity: 'fast' })).aimToggle).toBe(true);
    expect(parseSettings(JSON.stringify({ mouseSensitivity: 100 })).mouseSensitivity).toBe(SENSITIVITY_RANGE.max);
    expect(parseSettings(JSON.stringify({ mouseSensitivity: 0 })).mouseSensitivity).toBe(SENSITIVITY_RANGE.min);
  });
});
