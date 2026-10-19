import * as THREE from 'three';
import { BODY_H } from './world.js';

const COLOR = 0xff5252;
const OPACITY = 0.85;
const WIDTH = 0.04;
const END_RADIUS = 0.08;
const CHEST = BODY_H / 2; // above the feet: the line starts at the middle of the body, so a one-block rock stops it
const RENDER_ORDER = 11; // after the beacons: the line is drawn over everything

// The line of sight from the player's chest to the first thing in the way: a cube, stairs, a wall or the edge of the world.
// It is drawn flat over everything, so it can be followed even where a wall hides it from the camera.
export class AimLine {
  constructor(world) {
    this.world = world;
    this.range = Math.hypot(world.sizeX, world.sizeZ); // far enough to cross the world from anywhere in it
    const material = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: OPACITY, depthTest: false, depthWrite: false });
    // A ribbon of unit length along +z, stretched to the length of the line.
    this.ribbon = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), material);
    this.end = new THREE.Mesh(new THREE.SphereGeometry(END_RADIUS), material);
    this.root = new THREE.Group();
    this.root.add(this.ribbon, this.end);
    this.root.visible = false;
    for (const mesh of [this.ribbon, this.end]) mesh.renderOrder = RENDER_ORDER;
  }

  // The line shown from a character with feet at (x, y, z) looking along yaw, or hidden.
  update(visible, x, y, z, yaw) {
    this.root.visible = visible;
    if (!visible) return;
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    const length = this.world.castRay(x, y + CHEST, z, dx, dz, this.range);
    this.root.position.set(x, y + CHEST, z);
    this.ribbon.rotation.y = yaw;
    this.ribbon.scale.z = length;
    this.end.position.set(dx * length, 0, dz * length);
  }
}
