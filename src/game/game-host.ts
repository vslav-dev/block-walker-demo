import type { GameSettings } from '@game/settings';
import type { GameTuning } from '@game/tuning';

// What the game gets from the outside (the app that hosts it). The game only reads it, on every use, so a change made
// outside shows at once; the time of day in `tuning` is the one value the game moves itself.
export interface GameHost {
  readonly settings: GameSettings;
  readonly tuning: GameTuning;
}
