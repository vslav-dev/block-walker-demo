import { AIM_TUNABLES, type AimTuning } from '@game/aim/aim';
import { ZOOM_TUNABLES, type ZoomTuning } from '@game/camera/zoom';
import type { TunableSpec } from '@game/core/tunables';
import { DAY_TUNABLES, type DayTuning } from '@game/daylight/day-cycle';

// Everything the game lets the debug panel tune: every module lists its own numbers, this is the one list of all of them.
// The values are one object that the game reads on every use, so a change shows at once.
export const GAME_TUNABLES: readonly TunableSpec[] = [...DAY_TUNABLES, ...ZOOM_TUNABLES, ...AIM_TUNABLES];

export type GameTuning = DayTuning & ZoomTuning & AimTuning;
