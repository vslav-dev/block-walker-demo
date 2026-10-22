import type { Readout } from '@game/core/readout';
import * as THREE from 'three';
import type { LightTuning } from './light-tuning';

// The light that comes from the place itself and the colour behind the world: the sky of the open (see daylight/sky.ts),
// or nothing at all. A game has exactly one, chosen by the biome of its world; the lights that stand in the world are
// another matter (see lighting.ts).
export interface Atmosphere {
  readonly readouts: Readout[]; // what it has to say for the debug panel
  // Called every frame; target = the point the camera looks at.
  update(dt: number, target: THREE.Vector3): void;
}

const AMBIENT_COLOR = 0x8890b0;

// No sky: black behind the world and no light, so that only what a lamp or a candle reaches is seen. The one light is a
// faint glow from nowhere, off unless it is asked for in the panel, to see the layout in the dark.
export class Darkness implements Atmosphere {
  readonly readouts: Readout[] = [];
  private readonly ambient = new THREE.AmbientLight(AMBIENT_COLOR, 0);

  constructor(
    scene: THREE.Scene,
    private readonly tuning: Pick<LightTuning, 'ambient'>,
  ) {
    scene.background = new THREE.Color(0x000000);
    scene.add(this.ambient);
  }

  update(): void {
    this.ambient.intensity = this.tuning.ambient;
  }
}
