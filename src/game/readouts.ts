import { formatDegrees, type Readout } from '@game/core/readout';
import type { Game } from '@game/game';
import { createSimReadouts } from '@game/sim/readouts';

// The state of the game for the debug panel: what is the same in every game, then what the place has to say (the sky, the lights,
// the creatures that live there).
export function createReadouts(game: Game): Readout[] {
  const { rig, aim, body } = game;
  return [
    { label: 'FPS', group: null, read: () => game.fps.toFixed(0) },
    ...game.atmosphere.readouts,
    ...game.lighting.readouts,
    ...createSimReadouts(game.sim),
    { label: 'Zoom (0 close … 1 far)', group: 'Camera', read: () => rig.zoom.value.toFixed(3) },
    { label: 'Camera distance', group: 'Camera', read: () => rig.zoom.distance.toFixed(2) },
    { label: 'Camera pitch', group: 'Camera', read: () => formatDegrees(rig.zoom.pitch) },
    { label: 'Camera heading', group: 'Camera', read: () => formatDegrees(rig.heading) },
    { label: 'Aim mode', group: 'Aim', read: () => (aim.aiming ? 'on' : 'off') },
    { label: 'Aim yaw', group: 'Aim', read: () => formatDegrees(aim.yaw) },
    { label: 'Player x / y / z', group: 'Camera', read: () => [body.x, body.y, body.z].map((v) => v.toFixed(2)).join(' / ') },
  ];
}
