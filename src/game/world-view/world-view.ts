import { WALL_REACH } from '@game/character/body';
import { RenderOrder } from '@game/render-order';
import type { Sight } from '@game/sight/sight';
import { storeyAt } from '@game/world/blocks';
import type { World } from '@game/world/world';
import { BuildingVisibility, type Building } from './building-visibility';
import { DoorBeacon } from './door-beacon';
import { beaconProximity, doorHint, footprintDistance } from './door-hint';
import { collectLayerGroups, type LayerCell, type LayerGroup } from './layer-groups';
import { createLayerGeometry } from './layer-geometry';
import { LAYER_COLORS, isTopType, isWallType, wallPartOf, type LayerType } from './layer-types';
import { WALL_PARTS } from './wall-parts';
import { UnseenCull, cullUnseen } from './unseen-cull';
import { separates, type WallPlane } from './wall-plane';
import { wallFaces } from './wall-samples';
import * as THREE from 'three';

const BEACON_FADE_SPEED = 10;

export interface WorldViewOptions {
  wallFade: { opacity: number; speed: number }; // how the walls between the camera and the player go while the player is inside, see BiomeRules
  sight: Sight | null; // where only what the character sees is shown: what fades is drawn only over that
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _unit = new THREE.Vector3(1, 1, 1);
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();
const _axisY = new THREE.Vector3(0, 1, 0);

// A wall fades on its own, so it has its own material, drawn in the two passes of its geometry while it is not opaque.
// It is opaque most of the time: a fading wall would hide what is behind it from the walls drawn after it.
interface Fade {
  material: THREE.MeshLambertMaterial;
  passes: THREE.Material[];
}

interface Layer {
  plane: WallPlane | null; // of a wall part; the other layers have none
  owner: Building | undefined; // the layers of the ground and the rocks have no owner
  storey: number;
  mesh: THREE.InstancedMesh;
  shownMaterial: THREE.Material;
  hiddenMaterial: THREE.Material;
  fade: Fade | null;
  opacity: number;
  cull: UnseenCull | null; // where only what the character sees is drawn: the walls that are not seen are left out
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
  private readonly hiddenMaterials = new Map<THREE.Material, THREE.Material>();

  constructor(
    world: World,
    scene: THREE.Scene,
    private readonly options: WorldViewOptions,
  ) {
    this.visibility = new BuildingVisibility(world, scene);
    this.beacons = world.doors.map((door) => new DoorBeacon(door));
    for (const beacon of this.beacons) scene.add(beacon.root);
    this.createLayers(collectLayerGroups(world), scene);
  }

  // Called every frame with the player's position and the camera, whose matrices are up to date.
  update(x: number, y: number, z: number, camera: THREE.PerspectiveCamera, dt: number): void {
    const storey = storeyAt(y);

    const seen = this.options.sight?.seen;
    if (seen) for (const layer of this.layers) layer.cull?.update(seen, camera.position);
    this.visibility.update(x, y, z, camera);
    this.updateBeacons(x, z, camera.position, 1 - Math.exp(-BEACON_FADE_SPEED * dt), dt);
    this.updateLayers(x, z, camera.position, storey, 1 - Math.exp(-this.options.wallFade.speed * dt));
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

  private updateLayers(x: number, z: number, cameraPosition: THREE.Vector3, storey: number, k: number): void {
    for (const layer of this.layers) {
      const inside = layer.owner?.touched === true;
      const inView = !(inside && layer.storey > storey) && !layer.owner?.hidden;
      const inTheWay = inside && layer.storey === storey && layer.plane !== null && separates(layer.plane, x, z, cameraPosition.x, cameraPosition.z, WALL_REACH);
      if (layer.fade) this.fadeWall(layer, layer.fade, inTheWay, k);
      if (!inView) layer.mesh.material = layer.hiddenMaterial;
      else layer.mesh.material = layer.fade && layer.opacity < 1 ? (layer.opacity > 0 ? layer.fade.passes : layer.hiddenMaterial) : layer.shownMaterial;
    }
  }

  // What a layer that is out of view is drawn with: nothing. A mesh that is not `visible` would also be left out of the shadow
  // map, and the roof must keep shading the rooms below it with the roof taken off the view. It shades just as the layer
  // does when it is seen, so it is made of the layer's own material: how a material casts its shadow (see solidMaterial) is part of it.
  private hiddenVersionOf(material: THREE.Material): THREE.Material {
    let hidden = this.hiddenMaterials.get(material);
    if (!hidden) this.hiddenMaterials.set(material, (hidden = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, shadowSide: material.shadowSide })));
    return hidden;
  }

  // The walls between the camera and the player fade so the player stays visible indoors: those whose plane has the player
  // on one side and the camera on the other, wherever in the building they are. The other walls are beside the player or
  // behind him and never get in the way, and a wall does not fade because of the side of its cell it was set on.
  private fadeWall(layer: Layer, fade: Fade, active: boolean, k: number): void {
    const target = active ? this.options.wallFade.opacity : 1;
    if (layer.opacity === target) return;
    layer.opacity = Math.abs(target - layer.opacity) < 0.002 ? target : layer.opacity + (target - layer.opacity) * k;
    fade.material.opacity = layer.opacity; // only the picture fades: the wall still shades the room
  }

  // The material of the floors, the roofs and the blocks. The floors and the roofs are slabs as thin as the walls: they cast
  // their shadows with both faces too. Cast with the back face only, the top of a roof is as deep as the wall that ends at it,
  // and the wall is shaded in teeth along its top edge, one at every joint of the slabs.
  // It is a Lambert material, not a standard one: the world is matt (the standard one at the roughness it had was too), and the
  // standard one works out a shine for every light at every pixel, which is a third of a frame where several lights shine.
  private solidMaterial(type: LayerType): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({ color: LAYER_COLORS[type], shadowSide: isTopType(type) ? THREE.DoubleSide : null });
  }

  private createLayers(groups: LayerGroup[], scene: THREE.Scene): void {
    const geometries = new Map<LayerType, THREE.BufferGeometry>();
    const geometryOf = (type: LayerType): THREE.BufferGeometry => {
      if (!geometries.has(type)) geometries.set(type, createLayerGeometry(type));
      return geometries.get(type)!;
    };

    const depthPassMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      transparent: true,
      shadowSide: THREE.DoubleSide, // as the walls it is drawn for
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    // A wall casts a shadow with both its faces: the near one is the occluder, so that the far face, where the wall is
    // lit through a seam or by a bias that is too big, is as deep in the shadow as the whole thickness of the slab.
    // It is not pulled towards the camera: no face of anything else is in the plane of one of its faces (see WALL_SKIN).
    const wallMaterial = (type: LayerType, extra?: THREE.MeshLambertMaterialParameters) => {
      const material = new THREE.MeshLambertMaterial({
        color: LAYER_COLORS[type],
        shadowSide: THREE.DoubleSide,
        ...extra,
      });
      if (this.options.sight) cullUnseen(material);
      return material;
    };
    if (this.options.sight) {
      this.options.sight.restrict(depthPassMaterial);
      cullUnseen(depthPassMaterial);
    }
    const materials = new Map<LayerType, THREE.Material>();

    for (const { type, plane, building, storey, cells } of groups) {
      const isWall = isWallType(type);
      if (!materials.has(type)) {
        materials.set(type, isWall ? wallMaterial(type) : this.solidMaterial(type));
      }
      const fadeMaterial = isWall ? wallMaterial(type, { transparent: true, depthWrite: false }) : null;
      if (fadeMaterial) this.options.sight?.restrict(fadeMaterial);
      // Where the picture is of what the character sees, the cells of the walls that he does not are left out of it.
      const culled = isWall && this.options.sight !== null;
      const geometry = culled ? geometryOf(type).clone() : geometryOf(type); // the instances' attribute is the layer's own
      const cull = culled ? new UnseenCull(geometry, cells.map((cell) => wallFaces(plane!, cell))) : null;
      const mesh = new THREE.InstancedMesh(geometry, materials.get(type), cells.length);
      // The ground level needs no shadow, nothing is below it; and the trim of a doorway or a window is no obstacle for light.
      mesh.castShadow = !(isTopType(type) && storey === 0) && !(isWall && !WALL_PARTS[wallPartOf(type)].castsShadow);
      mesh.receiveShadow = true;
      if (isWall) mesh.renderOrder = RenderOrder.FadedWall; // when it fades, see RenderOrder
      cells.forEach((cell, i) => {
        setInstance(mesh, i, cell);
        mesh.setColorAt(i, _color.setScalar(0.86 + 0.14 * noise(cell.x, cell.y, cell.z)));
      });
      scene.add(mesh);
      this.layers.push({
        plane,
        owner: this.visibility.buildings.get(building),
        storey,
        mesh,
        shownMaterial: materials.get(type)!,
        hiddenMaterial: this.hiddenVersionOf(materials.get(type)!),
        fade: fadeMaterial && { material: fadeMaterial, passes: [depthPassMaterial, fadeMaterial] },
        opacity: 1,
        cull,
      });
    }
  }
}
