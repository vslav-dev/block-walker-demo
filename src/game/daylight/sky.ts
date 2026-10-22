import type { SkyState } from '@game/daylight/day-cycle';
import * as THREE from 'three';

const LIGHT_DISTANCE = 30; // from the target of the camera; the shadow camera reaches well past it

// The lights and the colour behind the world: what the day and the night (see day-cycle.ts) look like on the screen.
// One light casts the shadows, the sun by day and the moon by night, and a hemisphere light stands for the sky.
// Only numbers change from frame to frame, never the set of lights, so nothing is recompiled.
export class Sky {
  private readonly background = new THREE.Color();
  private readonly hemisphere = new THREE.HemisphereLight();
  private readonly light = new THREE.DirectionalLight();

  constructor(scene: THREE.Scene) {
    scene.background = this.background;

    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    Object.assign(this.light.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
    this.light.shadow.bias = -0.0004;
    this.light.shadow.normalBias = 0.03;

    scene.add(this.hemisphere, this.light, this.light.target);
  }

  // state = skyAt(...); target = the point the camera looks at, which the light follows, so that the shadows are drawn around it.
  update(state: SkyState, target: THREE.Vector3): void {
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
