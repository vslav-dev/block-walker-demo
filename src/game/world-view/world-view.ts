import { Block, Top, sidesFacing, storeyAt } from '@game/world/blocks';
import type { World } from '@game/world/world';
import { BuildingVisibility, type Building } from './building-visibility';
import { DoorBeacon } from './door-beacon';
import { beaconProximity, doorHint, footprintDistance } from './door-hint';
import { collectLayerGroups, type LayerCell, type LayerGroup } from './layer-groups';
import { createStairsGeometry, createTopGeometry, createWallPartGeometry, withTwoPasses } from './layer-geometry';
import { LAYER_COLORS, blockType, isTopType, isWallType, topType, wallType, type LayerType } from './layer-types';
import { WALL_PARTS, type WallPart } from './wall-parts';
import * as THREE from 'three';

const WALL_FADED_OPACITY = 0.2; // the walls facing the camera fade to this opacity while the player is inside
const WALL_FADE_SPEED = 10;
const WALL_FACING = 0.15; // a side faces the camera when its normal points this much (cosine) at it: a wall seen edge-on does not

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _unit = new THREE.Vector3(1, 1, 1);
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();
const _axisY = new THREE.Vector3(0, 1, 0);
const _toCamera = new THREE.Vector3();

// A wall fades on its own, so it has its own material, drawn in the two passes of its geometry while it is not opaque.
// It is opaque most of the time: a fading wall would hide what is behind it from the walls drawn after it.
interface Fade {
  material: THREE.MeshStandardMaterial;
  passes: THREE.Material[];
}

interface Layer {
  side: number;
  owner: Building | undefined; // the layers of the ground and the rocks have no owner
  storey: number;
  mesh: THREE.InstancedMesh;
  shownMaterial: THREE.Material;
  fade: Fade | null;
  opacity: number;
}

// Stable per-block brightness noise in 0..1.
function noise(x: number, y: number, z: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function setInstance(mesh: THREE.InstancedMesh, i: number, cell: LayerCell): void {
  _pos.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
  _quat.setFromAxisAngle(_axisY, cell.rotY);
  mesh.setMatrixAt(i, _matrix.compose(_pos, _quat, _unit));
}

// Renders the voxel world as one InstancedMesh per (block type, building, storey) "layer".
// Layers make "hide the roof when the player is inside" and "hide the building" plain visibility toggles.
export class WorldView {
  private readonly visibility: BuildingVisibility;
  private readonly beacons: DoorBeacon[];
  private readonly layers: Layer[] = [];
  private time = 0; // seconds, for the pulse of the beacons
  // What a layer that is out of view is drawn with: nothing. A mesh that is not `visible` would also be left out of the
  // shadow map, and the roof must keep shading the rooms below it with the roof taken off the view.
  private readonly invisibleMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

  constructor(world: World, scene: THREE.Scene) {
    this.visibility = new BuildingVisibility(world, scene);
    this.beacons = world.doors.map((door) => new DoorBeacon(door));
    for (const beacon of this.beacons) scene.add(beacon.root);
    this.createLayers(collectLayerGroups(world), scene);
  }

  // Called every frame with the player's position and the camera, whose matrices are up to date.
  update(x: number, y: number, z: number, camera: THREE.PerspectiveCamera, dt: number): void {
    const storey = storeyAt(y);
    const k = 1 - Math.exp(-WALL_FADE_SPEED * dt);
    const toCamera = _toCamera.set(camera.position.x - x, 0, camera.position.z - z).normalize();
    const facing = sidesFacing(toCamera.x, toCamera.z, WALL_FACING);

    this.visibility.update(x, y, z, camera);
    this.updateBeacons(x, z, camera.position, k, dt);
    this.updateLayers(storey, facing, k);
  }

  private updateBeacons(x: number, z: number, cameraPosition: THREE.Vector3, k: number, dt: number): void {
    this.time += dt;
    for (const beacon of this.beacons) {
      const { door } = beacon;
      const house = this.visibility.buildings.get(door.building)!;
      const near = beaconProximity(footprintDistance(house, x, z), Math.hypot(x - (door.x + 0.5), z - (door.z + 0.5)));
      beacon.update(house.touched ? 0 : doorHint(door, cameraPosition.x, cameraPosition.z) * near, k, this.time);
    }
  }

  private updateLayers(storey: number, facing: number, k: number): void {
    for (const layer of this.layers) {
      const inside = layer.owner?.touched === true;
      const inView = !(inside && layer.storey > storey) && !layer.owner?.hidden;
      if (layer.fade) this.fadeWall(layer, layer.fade, inside && layer.storey === storey && (layer.side & facing) !== 0, k);
      if (!inView) layer.mesh.material = this.invisibleMaterial;
      else layer.mesh.material = layer.fade && layer.opacity < 1 ? layer.fade.passes : layer.shownMaterial;
    }
  }

  // The walls between the camera and the player, those facing the camera, fade so the player stays visible indoors.
  // The other walls are seen edge-on or behind the player and never get in the way.
  private fadeWall(layer: Layer, fade: Fade, active: boolean, k: number): void {
    const target = active ? WALL_FADED_OPACITY : 1;
    if (layer.opacity === target) return;
    layer.opacity = Math.abs(target - layer.opacity) < 0.002 ? target : layer.opacity + (target - layer.opacity) * k;
    fade.material.opacity = layer.opacity; // only the picture fades: the wall still shades the room
  }

  private createLayers(groups: LayerGroup[], scene: THREE.Scene): void {
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const topGeometry = createTopGeometry();
    const geometries: Record<LayerType, THREE.BufferGeometry> = { [blockType(Block.Stairs)]: createStairsGeometry() };
    for (const kind of Object.values(Top)) geometries[topType(kind)] = topGeometry;
    for (const part of Object.keys(WALL_PARTS) as WallPart[]) geometries[wallType(part)] = withTwoPasses(createWallPartGeometry(part));

    const depthPassMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    // A wall can share its cell with a block (stairs docked to it); the pull towards the camera
    // settles the coplanar outer faces in favor of the wall instead of letting them flicker.
    const wallMaterial = (type: LayerType, extra?: THREE.MeshStandardMaterialParameters) =>
      new THREE.MeshStandardMaterial({
        color: LAYER_COLORS[type],
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        ...extra,
      });
    const materials = new Map<LayerType, THREE.Material>();

    for (const { type, side, building, storey, cells } of groups) {
      const isWall = isWallType(type);
      if (!materials.has(type)) {
        materials.set(type, isWall ? wallMaterial(type) : new THREE.MeshStandardMaterial({ color: LAYER_COLORS[type], roughness: 0.95 }));
      }
      const fadeMaterial = isWall ? wallMaterial(type, { transparent: true, depthWrite: false }) : null;
      const mesh = new THREE.InstancedMesh(geometries[type] ?? boxGeometry, materials.get(type), cells.length);
      mesh.castShadow = !(isTopType(type) && storey === 0); // the ground level needs no shadow, nothing is below it
      mesh.receiveShadow = true;
      cells.forEach((cell, i) => {
        setInstance(mesh, i, cell);
        mesh.setColorAt(i, _color.setScalar(0.86 + 0.14 * noise(cell.x, cell.y, cell.z)));
      });
      scene.add(mesh);
      this.layers.push({
        side,
        owner: this.visibility.buildings.get(building),
        storey,
        mesh,
        shownMaterial: materials.get(type)!,
        fade: fadeMaterial && { material: fadeMaterial, passes: [depthPassMaterial, fadeMaterial] },
        opacity: 1,
      });
    }
  }
}
