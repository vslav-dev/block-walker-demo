import * as THREE from 'three';
import { EYE_H } from './world.js';

const COLOR = 0xff5252;
const OPACITY = 0.85;
const WIDTH = 0.04;
const END_RADIUS = 0.08;
// The line in the world is drawn before everything translucent, so that a fading wall is drawn over it (and does not hide it
// with the depth it writes); the line over everything is drawn after the beacons.
const WORLD_RENDER_ORDER = -1;
const OVERLAY_RENDER_ORDER = 11;

// The line of sight from the player's eyes to the first thing in the way: a cube over the knee, stairs, a wall or the edge of
// the world. It goes through a doorway or a window. It is shown in two ways, each on its own:
// - in the world: a flat ribbon at eye height that the walls, floors and everything else hide where they are in front of it,
//   so it is seen only where the eye could see it, for example through a window and no further than the window lets you see;
// - over everything: the same ribbon drawn flat over the whole picture, for debugging, to follow it behind a wall.
export class AimLine {
  constructor(world) {
    this.world = world;
    this.range = Math.hypot(world.sizeX, world.sizeZ); // far enough to cross the world from anywhere in it
    // A ribbon of unit length along +z, stretched to the length of the line.
    this.ribbonGeometry = new THREE.PlaneGeometry(WIDTH, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    this.endGeometry = new THREE.SphereGeometry(END_RADIUS);
    this.world3d = this.createLine({ depthTest: true }, WORLD_RENDER_ORDER);
    this.overlay = this.createLine({ depthTest: false }, OVERLAY_RENDER_ORDER);
    this.root = new THREE.Group();
    this.root.add(this.world3d.root, this.overlay.root);
  }

  createLine(materialProps, renderOrder) {
    const material = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: OPACITY, depthWrite: false, ...materialProps });
    const ribbon = new THREE.Mesh(this.ribbonGeometry, material);
    const end = new THREE.Mesh(this.endGeometry, material);
    const root = new THREE.Group();
    root.add(ribbon, end);
    root.visible = false;
    for (const mesh of [ribbon, end]) mesh.renderOrder = renderOrder;
    return { root, ribbon, end };
  }

  // The line shown from a character with feet at (x, y, z) looking along yaw: in the world, over everything, both or neither.
  update(inWorld, overEverything, x, y, z, yaw) {
    this.world3d.root.visible = inWorld;
    this.overlay.root.visible = overEverything;
    if (!inWorld && !overEverything) return;
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    const length = this.world.castRay(x, y + EYE_H, z, dx, dz, this.range);
    for (const { root, ribbon, end } of [this.world3d, this.overlay]) {
      root.position.set(x, y + EYE_H, z);
      ribbon.rotation.y = yaw;
      ribbon.scale.z = length;
      end.position.set(dx * length, 0, dz * length);
    }
  }
}
