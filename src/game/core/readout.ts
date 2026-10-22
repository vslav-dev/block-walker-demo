// A line of the game's state for the debug panel: `read` says what to show now. A line with a group is shown in that group's
// section next to its tunables, a line without one is shown in the header of the panel.
export interface Readout {
  label: string;
  group: string | null;
  read: () => string;
}

export const formatDegrees = (radians: number): string => `${((radians * 180) / Math.PI).toFixed(1)}°`;
