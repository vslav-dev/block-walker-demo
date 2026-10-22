import { formatHour } from '@game/daylight/day-cycle';
import type { Game } from '@game/game';

// A line of the game's state for the debug panel: `read` says what to show now. A line with a group is shown in that group's
// section next to its tunables, a line without one is shown in the header of the panel.
export interface Readout {
  label: string;
  group: string | null;
  read: () => string;
}

const degrees = (radians: number): string => `${((radians * 180) / Math.PI).toFixed(1)}°`;

export function createReadouts(game: Game): Readout[] {
  const { tuning, rig, aim, body } = game;
  return [
    { label: 'FPS', group: null, read: () => game.fps.toFixed(0) },
    { label: 'Time', group: 'Day and night', read: () => formatHour(tuning.hour) },
    { label: 'Key light', group: 'Day and night', read: () => (game.skyState.sun ? 'sun' : 'moon') },
    { label: 'Light angle', group: 'Day and night', read: () => degrees(Math.asin(game.skyState.direction.y)) },
    { label: 'Light strength', group: 'Day and night', read: () => game.skyState.keyIntensity.toFixed(2) },
    { label: 'Shadow strength', group: 'Day and night', read: () => game.skyState.shadow.toFixed(2) },
    { label: 'Zoom (0 close … 1 far)', group: 'Camera', read: () => rig.zoom.value.toFixed(3) },
    { label: 'Camera distance', group: 'Camera', read: () => rig.zoom.distance.toFixed(2) },
    { label: 'Camera pitch', group: 'Camera', read: () => degrees(rig.zoom.pitch) },
    { label: 'Camera heading', group: 'Camera', read: () => degrees(rig.heading) },
    { label: 'Aim mode', group: 'Aim', read: () => (aim.aiming ? 'on' : 'off') },
    { label: 'Aim yaw', group: 'Aim', read: () => degrees(aim.yaw) },
    { label: 'Player x / y / z', group: 'Camera', read: () => [body.x, body.y, body.z].map((v) => v.toFixed(2)).join(' / ') },
  ];
}
