import { Robot } from '@game/character/robot';
import type { Simulation } from '@game/sim/simulation';
import type { SimTuning } from '@game/sim/sim-tuning';
import { CreatureView } from '@game/sim-view/creature-view';
import type * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

const CREATURE_TINT = 0xffb878; // the creatures are of another colour than the player's robot

// The creatures of the simulation on the screen. They appear when the model of the robot is loaded; until then they live unseen.
export class CreaturesView {
  private readonly views: CreatureView[] = [];

  constructor(
    private readonly sim: Simulation,
    private readonly scene: THREE.Scene,
    private readonly tuning: SimTuning,
    private readonly castsShadow: boolean,
  ) {}

  show(model: GLTF): void {
    for (const creature of this.sim.creatures) {
      const robot = new Robot(model, CREATURE_TINT);
      robot.setCastsShadow(this.castsShadow);
      this.scene.add(robot.root);
      this.views.push(new CreatureView(creature, robot));
    }
  }

  update(dt: number): void {
    for (const view of this.views) view.update(dt, this.tuning.creatureLabels);
  }
}
