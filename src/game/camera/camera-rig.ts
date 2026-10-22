import { NORTH, turnToward } from '@game/core/angles';
import * as THREE from 'three';
import { Zoom, type ZoomTuning } from './zoom';

const FOLLOW_SPEED = 8;
const HEADING_SPEED = 12; // how fast the camera turns round the player
const CURSOR_HEIGHT = 1; // the cursor is projected onto a horizontal plane this high above the feet
const CURSOR_DEAD_ZONE = 0.2; // closer to the player than this the cursor gives no direction

// The camera hangs behind and above the player, its distance and pitch set by the zoom alone, and looks along its heading: north in the overview,
// the player's aim in the aim mode. It follows the player with a lag and turns round it smoothly.
export class CameraRig {
  heading = NORTH;
  readonly zoom: Zoom; // independent of the heading, so it stays when the aim mode is switched
  readonly target: THREE.Vector3; // the point the camera looks at, follows the player
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  private readonly point = new THREE.Vector3();
  private readonly cursor = new THREE.Vector2();

  // tuning = the values of ZOOM_TUNABLES.
  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    x: number,
    y: number,
    z: number,
    tuning: ZoomTuning,
  ) {
    this.zoom = new Zoom(tuning);
    this.target = new THREE.Vector3(x, y, z);
  }

  // zoomPixels = how far the wheel scrolled since the last frame.
  update(dt: number, player: THREE.Vector3, heading: number, zoomPixels: number): void {
    this.target.lerp(player, 1 - Math.exp(-FOLLOW_SPEED * dt));
    this.heading = turnToward(this.heading, heading, HEADING_SPEED, dt);
    this.zoom.update(dt, zoomPixels);
    const { distance, pitch } = this.zoom;
    const horizontal = Math.cos(pitch) * distance;
    this.camera.position.set(
      this.target.x - Math.sin(this.heading) * horizontal,
      this.target.y + Math.sin(pitch) * distance,
      this.target.z - Math.cos(this.heading) * horizontal,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  // The yaw of the cursor (normalized device coordinates) as seen from the player at (x, y, z), or null if it is right over it.
  cursorYaw(cursor: { x: number; y: number }, x: number, y: number, z: number): number | null {
    this.plane.constant = -(y + CURSOR_HEIGHT);
    this.raycaster.setFromCamera(this.cursor.set(cursor.x, cursor.y), this.camera);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.point)) return null;
    const dx = this.point.x - x;
    const dz = this.point.z - z;
    return Math.hypot(dx, dz) > CURSOR_DEAD_ZONE ? Math.atan2(dx, dz) : null;
  }
}
