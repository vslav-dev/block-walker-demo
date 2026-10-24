import { AIM_TUNABLES, type AimTuning } from '@game/aim/aim';
import { ZOOM_TUNABLES, type ZoomTuning } from '@game/camera/zoom';
import type { TunableSpec } from '@game/core/tunables';
import { DAY_TUNABLES, type DayTuning } from '@game/daylight/day-cycle';
import { LIGHT_TUNABLES, type LightTuning } from '@game/lighting/light-tuning';
import { SIM_TUNABLES, type SimTuning } from '@game/sim/sim-tuning';

// Everything the game lets the debug panel tune: every module lists its own numbers, this is the one list of all of them.
// The values are one object that the game reads on every use, so a change shows at once.
export const GAME_TUNABLES: readonly TunableSpec[] = [...DAY_TUNABLES, ...LIGHT_TUNABLES, ...ZOOM_TUNABLES, ...AIM_TUNABLES, ...SIM_TUNABLES];

export type GameTuning = DayTuning & LightTuning & ZoomTuning & AimTuning & SimTuning;
