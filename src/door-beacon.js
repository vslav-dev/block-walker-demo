import * as THREE from 'three';
import { DOOR_H, WALL_SIDES } from './blocks.js';

const COLOR = 0xffd54a;
const FRAME_OPACITY = 0.9;
const MAT_OPACITY = 0.35;
const BAR = 0.1; // thickness of the frame's bars
const MAT_DEPTH = 1.2; // how far the mat reaches out from the wall
const PULSE_SPEED = 4;
const RENDER_ORDER = 10; // after everything else: the beacon is drawn over walls, so that it shows through them

// A glowing frame in the doorway and a mat on the ground in front of it, drawn over everything. It marks a door that the
// camera cannot see, so the player always knows on which side of a building the entrance is.
export class DoorBeacon {
  constructor(door) {
    this.door = door;
    this.hint = 0; // 0..1, how much of the beacon is shown
    this.frameMaterial = this.createMaterial();
    this.matMaterial = this.createMaterial();

    // Built on the north wall of the cell, where outward is -z; the group is then turned onto the wall the door is in.
    const outward = -0.5 - 0.03;
    const frame = [
      [BAR, DOOR_H, -0.5 + BAR / 2, 1 + DOOR_H / 2], // posts
      [BAR, DOOR_H, 0.5 - BAR / 2, 1 + DOOR_H / 2],
      [1, BAR, 0, 1 + DOOR_H - BAR / 2], // lintel
      [1, BAR, 0, 1 + BAR / 2], // sill
    ].map(([width, height, x, y]) => this.createMesh(new THREE.BoxGeometry(width, height, 0.06), this.frameMaterial, x, y, outward));
    const mat = this.createMesh(new THREE.PlaneGeometry(1, MAT_DEPTH).rotateX(-Math.PI / 2), this.matMaterial, 0, 1.03, -0.5 - MAT_DEPTH / 2);

    this.root = new THREE.Group();
    this.root.position.set(door.x + 0.5, 0, door.z + 0.5);
    this.root.rotation.y = WALL_SIDES.find((side) => side.bit === door.side).rotY;
    this.root.add(...frame, mat);
    this.root.visible = false;
  }

  createMaterial() {
    return new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  }

  createMesh(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.renderOrder = RENDER_ORDER;
    return mesh;
  }

  // target = the wanted hint, k = how far to move towards it this frame, time = seconds, for the pulse.
  update(target, k, time) {
    this.hint += (target - this.hint) * k;
    const pulse = 0.8 + 0.2 * Math.sin(time * PULSE_SPEED);
    this.frameMaterial.opacity = this.hint * FRAME_OPACITY * pulse;
    this.matMaterial.opacity = this.hint * MAT_OPACITY * pulse;
    this.root.visible = this.hint > 0.01;
  }
}
