export const SENSITIVITY_RANGE = { min: 0.5, max: 1.5 }; // as far below the usual 1 as above it

// The player's choices. The game reads them on every use, so a change takes effect at once.
export interface GameSettings {
  readonly aimToggle: boolean; // the aim button switches the mode on and off; off = the mode lasts while the button is held
  readonly mouseSensitivity: number; // times the usual turning speed of the aim mode
}

export const DEFAULT_SETTINGS: GameSettings = { aimToggle: true, mouseSensitivity: 1 };

// The settings as they were stored (JSON text). Unknown or broken stored values fall back to the defaults.
export function parseSettings(stored: string | null | undefined): GameSettings {
  let raw: Partial<Record<keyof GameSettings, unknown>> | null;
  try {
    raw = JSON.parse(stored ?? 'null');
  } catch {
    return DEFAULT_SETTINGS; // unreadable
  }
  const { aimToggle, mouseSensitivity } = raw ?? {};
  return {
    aimToggle: typeof aimToggle === 'boolean' ? aimToggle : DEFAULT_SETTINGS.aimToggle,
    mouseSensitivity:
      typeof mouseSensitivity === 'number' && Number.isFinite(mouseSensitivity)
        ? Math.min(SENSITIVITY_RANGE.max, Math.max(SENSITIVITY_RANGE.min, mouseSensitivity))
        : DEFAULT_SETTINGS.mouseSensitivity,
  };
}
