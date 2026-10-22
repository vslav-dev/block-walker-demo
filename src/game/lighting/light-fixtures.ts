import { LIGHT_HEIGHT, LightKind, type WorldLight } from '@game/world/light';
import * as THREE from 'three';
import { LIGHT_LOOKS, type SourceKind } from './light-looks';

const FLAME_RADIUS = 0.05;
const BULB_RADIUS = 0.09;
const STAND_RADIUS = 0.02;
const STAND_COLOR = 0x4a3524;
const WAX_COLOR = 0xe8dcc0;
const WAX_HEIGHT = 0.2;
const WAX_RADIUS = 0.04;
const CORD_LENGTH = 0.15;

// What a light looks like where it stands: the flame or the bulb, and what holds it. They shine by themselves (their material
// ignores the light), so a lamp is seen from afar in the dark. Nothing here casts a shadow, so nothing blocks its own light.
export class LightFixtures {
  private readonly flameGeometry = new THREE.SphereGeometry(FLAME_RADIUS);
  private readonly bulbGeometry = new THREE.SphereGeometry(BULB_RADIUS);
  private readonly standMaterial = new THREE.MeshLambertMaterial({ color: STAND_COLOR });
  private readonly waxMaterial = new THREE.MeshLambertMaterial({ color: WAX_COLOR });

  // A flame of a source of light, to put where the light is.
  createFlame(kind: SourceKind): THREE.Mesh {
    const geometry = kind === LightKind.Lamp ? this.bulbGeometry : this.flameGeometry;
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: LIGHT_LOOKS[kind].color }));
  }

  // The flame and its stand at the place of a light of the world: a candle on a thin stand from the floor, a lamp on a cord from the ceiling.
  create(light: WorldLight): THREE.Group {
    const group = new THREE.Group();
    group.position.set(light.x, light.y, light.z);
    group.add(this.createFlame(light.kind));
    if (light.kind === LightKind.Lamp) {
      group.add(this.cylinder(this.standMaterial, STAND_RADIUS / 2, CORD_LENGTH, BULB_RADIUS + CORD_LENGTH / 2));
    } else {
      const stand = LIGHT_HEIGHT[light.kind] - WAX_HEIGHT - FLAME_RADIUS;
      group.add(
        this.cylinder(this.waxMaterial, WAX_RADIUS, WAX_HEIGHT, -FLAME_RADIUS - WAX_HEIGHT / 2),
        this.cylinder(this.standMaterial, STAND_RADIUS, stand, -FLAME_RADIUS - WAX_HEIGHT - stand / 2),
      );
    }
    return group;
  }

  private cylinder(material: THREE.Material, radius: number, height: number, y: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 8), material);
    mesh.position.y = y;
    return mesh;
  }
}
