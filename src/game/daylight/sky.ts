import type { Atmosphere } from '@game/lighting/atmosphere';
import { formatDegrees, type Readout } from '@game/core/readout';
import { DAY_GROUP, advanceHour, formatHour, skyAt, type DayTuning, type SkyState } from '@game/daylight/day-cycle';
import * as THREE from 'three';

const LIGHT_DISTANCE = 30; // from the target of the camera; the shadow camera reaches well past it

// The sky of the open: the days and the nights (see day-cycle.ts) on the screen. It moves the time of day, holds the lights
// and the colour behind the world. One light casts the shadows, the sun by day and the moon by night, and a hemisphere light
// stands for the sky. Only numbers change from frame to frame, never the set of lights, so nothing is recompiled.
export class Sky implements Atmosphere {
  readonly readouts: Readout[];
  private state: SkyState;
  private readonly background = new THREE.Color();
  private readonly hemisphere = new THREE.HemisphereLight();
  private readonly light = new THREE.DirectionalLight();

  // tuning = the values of DAY_TUNABLES; the time of day in it is moved by the sky.
  constructor(
    scene: THREE.Scene,
    private readonly tuning: DayTuning,
  ) {
    scene.background = this.background;

    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    Object.assign(this.light.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
    this.light.shadow.bias = -0.0004;
    this.light.shadow.normalBias = 0.03;

    scene.add(this.hemisphere, this.light, this.light.target);

    this.state = skyAt(tuning.hour, tuning);
    this.readouts = [
      { label: 'Time', group: DAY_GROUP, read: () => formatHour(tuning.hour) },
      { label: 'Key light', group: DAY_GROUP, read: () => (this.state.sun ? 'sun' : 'moon') },
      { label: 'Light angle', group: DAY_GROUP, read: () => formatDegrees(Math.asin(this.state.direction.y)) },
      { label: 'Light strength', group: DAY_GROUP, read: () => this.state.keyIntensity.toFixed(2) },
      { label: 'Shadow strength', group: DAY_GROUP, read: () => this.state.shadow.toFixed(2) },
    ];
  }

  // The light follows the target of the camera, so that the shadows are drawn around it.
  update(dt: number, target: THREE.Vector3): void {
    const { tuning } = this;
    tuning.hour = advanceHour(tuning.hour, dt, tuning.timeFlow);
    const state = (this.state = skyAt(tuning.hour, tuning));

    this.background.setHex(state.background);
    this.hemisphere.color.setHex(state.hemiSky);
    this.hemisphere.groundColor.setHex(state.hemiGround);
    this.hemisphere.intensity = state.hemiIntensity;

    this.light.color.setHex(state.keyColor);
    this.light.intensity = state.keyIntensity;
    this.light.shadow.intensity = state.shadow;
    this.light.position.set(state.direction.x, state.direction.y, state.direction.z).multiplyScalar(LIGHT_DISTANCE).add(target);
    this.light.target.position.copy(target);
  }
}
