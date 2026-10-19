import test from 'node:test';
import assert from 'node:assert/strict';
import { SENSITIVITY_RANGE, Settings } from '../src/settings.js';

const storageWith = (value) => ({ items: { 'block-walker-settings-v2': value }, getItem(key) { return this.items[key] ?? null; }, setItem(key, v) { this.items[key] = v; } });

test('without stored settings the defaults apply: toggle on, sensitivity 1', () => {
  const settings = new Settings(storageWith(undefined));
  assert.equal(settings.aimToggle, true);
  assert.equal(settings.mouseSensitivity, 1);
});

test('settings survive a reload', () => {
  const storage = storageWith(undefined);
  const settings = new Settings(storage);
  settings.aimToggle = false;
  settings.mouseSensitivity = 1.5;
  settings.save();

  const reloaded = new Settings(storage);
  assert.equal(reloaded.aimToggle, false);
  assert.equal(reloaded.mouseSensitivity, 1.5);
});

test('broken or out-of-range stored values are ignored or clamped', () => {
  assert.equal(new Settings(storageWith('not json')).mouseSensitivity, 1);
  assert.equal(new Settings(storageWith(JSON.stringify({ aimToggle: 'yes', mouseSensitivity: 'fast' }))).aimToggle, true);
  assert.equal(new Settings(storageWith(JSON.stringify({ mouseSensitivity: 100 }))).mouseSensitivity, SENSITIVITY_RANGE.max);
  assert.equal(new Settings(storageWith(JSON.stringify({ mouseSensitivity: 0 }))).mouseSensitivity, SENSITIVITY_RANGE.min);
});

test('no storage at all is no problem', () => {
  const settings = new Settings(null);
  settings.save();
  assert.equal(settings.mouseSensitivity, 1);
});
