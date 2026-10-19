import * as THREE from 'three';
import { NORTH, turnToward } from './angles.js';

const PITCH = THREE.MathUtils.degToRad(52); // fixed
const DISTANCE = 26;
const FOLLOW_SPEED = 8;
const HEADING_SPEED = 12; // how fast the camera turns round the player
const CURSOR_HEIGHT = 1; // the cursor is projected onto a horizontal plane this high above the feet
const CURSOR_DEAD_ZONE = 0.2; // closer to the player than this the cursor gives no direction

// The camera hangs behind and above the player, at a fixed pitch, and looks along its heading: north in the overview,
// the player's aim in the aim mode. It follows the player with a lag and turns round it smoothly.
export class CameraRig {
  constructor(camera, x, y, z) {
    this.camera = camera;
    this.heading = NORTH;
    this.target = new THREE.Vector3(x, y, z); // the point the camera looks at, follows the player
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
    this.point = new THREE.Vector3();
  }

  update(dt, player, heading) {
    this.target.lerp(player, 1 - Math.exp(-FOLLOW_SPEED * dt));
    this.heading = turnToward(this.heading, heading, HEADING_SPEED, dt);
    const horizontal = Math.cos(PITCH) * DISTANCE;
    this.camera.position.set(
      this.target.x - Math.sin(this.heading) * horizontal,
      this.target.y + Math.sin(PITCH) * DISTANCE,
      this.target.z - Math.cos(this.heading) * horizontal,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  // The yaw of the cursor (normalized device coordinates) as seen from the player at (x, y, z), or null if it is right over it.
  cursorYaw(cursor, x, y, z) {
    this.plane.constant = -(y + CURSOR_HEIGHT);
    this.raycaster.setFromCamera(cursor, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.point)) return null;
    const dx = this.point.x - x;
    const dz = this.point.z - z;
    return Math.hypot(dx, dz) > CURSOR_DEAD_ZONE ? Math.atan2(dx, dz) : null;
  }
}
