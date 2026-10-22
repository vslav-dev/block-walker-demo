import { Block, Top, TopColor } from '@game/world/blocks';
import type { World } from '@game/world/world';
import type { Footprint } from './door-hint';
import * as THREE from 'three';

// A building that hides the player from the camera, wholly or partly, disappears at once. Only a marker of its
// footprint and outline stays, so the player and everything behind the building are visible.
// The player counts as hidden when a line from the camera to any of these points of its body hits the building first,
// unless a part of the body is already over the building's footprint: then it is entering or leaving, and the building
// stays (the lines would hit the building around a point inside it, which would hide it for a few frames in a doorway).
const BODY_RADIUS = 0.3; // half the footprint of the body: a wall keeps it farther away, so standing flush outside never touches
const BODY_HEIGHTS = [0.15, 0.9, 1.65]; // feet, chest, head
const BODY_HALF_WIDTH_ENTER = BODY_RADIUS; // standing flush against a side wall is not hidden
const BODY_HALF_WIDTH_LEAVE = 0.45; // wider while hidden, so that the building does not flicker back and forth at the edge
const MARKER_PLATE_TINT = 0.3; // how much of the roof's color the footprint plate has
const MARKER_EDGE_OPACITY = 0.6;
const MARKER_EDGE_COLOR = 0xf2e6d0;

const _right = new THREE.Vector3();
const _sample = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _ray = new THREE.Ray();
const _box = new THREE.Box3();

// The bounds of a building: footprint in cells and the height of its highest block, wall or slab.
interface Bounds extends Footprint {
  id: number;
  top: number;
}

// Every building is in one of three states for the player, from the same test, so the picture changes once at the door:
// touched (a part of the body is over its footprint: it is shown cut to the player's storey), hidden (the body is
// clear of it and it is in the way of the camera: only its marker stays) or whole.
export interface Building extends Bounds {
  touched: boolean;
  hidden: boolean;
  marker: THREE.Group;
}

function collectBounds(world: World): Map<number, Bounds> {
  const buildings = new Map<number, Bounds>();
  for (let z = 0; z < world.sizeZ; z++) {
    for (let x = 0; x < world.sizeX; x++) {
      const id = world.buildingAt(x, z);
      if (id === 0) continue;
      let b = buildings.get(id);
      if (!b) buildings.set(id, (b = { id, x0: x, x1: x, z0: z, z1: z, top: 1 }));
      b.x0 = Math.min(b.x0, x);
      b.x1 = Math.max(b.x1, x);
      b.z0 = Math.min(b.z0, z);
      b.z1 = Math.max(b.z1, z);
      for (let y = world.sizeY - 1; y >= 0; y--) {
        if (world.get(x, y, z) !== Block.Air || world.getWalls(x, y, z) !== 0 || world.getTop(x, y, z) !== Top.None) {
          b.top = Math.max(b.top, y + 1);
          break;
        }
      }
    }
  }
  return buildings;
}

// What stays of a hidden building: its footprint as a ground patch with a hint of the roof's color (the ground
// under the building is gone with it) and its outline as a box of lines.
function createMarker(b: Bounds): THREE.Group {
  const width = b.x1 - b.x0 + 1;
  const depth = b.z1 - b.z0 + 1;
  const height = b.top - 1;
  const center = new THREE.Vector3(b.x0 + width / 2, 1 + height / 2, b.z0 + depth / 2);

  const plateColor = new THREE.Color(TopColor[Top.Grass]).lerp(new THREE.Color(TopColor[Top.Roof]), MARKER_PLATE_TINT);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: plateColor }));
  plate.position.set(center.x, 1, center.z);

  const edgeMaterial = new THREE.LineBasicMaterial({ color: MARKER_EDGE_COLOR, transparent: true, opacity: MARKER_EDGE_OPACITY, depthWrite: false });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)), edgeMaterial);
  edges.position.copy(center);

  const marker = new THREE.Group();
  marker.add(plate, edges);
  marker.visible = false;
  return marker;
}

// Which buildings are in the way of the camera or around the player: their state is kept here, the view reads it.
export class BuildingVisibility {
  readonly buildings = new Map<number, Building>();

  constructor(world: World, scene: THREE.Scene) {
    for (const bounds of collectBounds(world).values()) {
      const building = { ...bounds, touched: false, hidden: false, marker: createMarker(bounds) };
      this.buildings.set(building.id, building);
      scene.add(building.marker);
    }
  }

  // Called every frame with the player's position (feet at x, y, z) and the camera, whose matrices are up to date.
  update(x: number, y: number, z: number, camera: THREE.Camera): void {
    _right.setFromMatrixColumn(camera.matrixWorld, 0); // horizontal: the camera does not roll, only pitches and turns
    for (const b of this.buildings.values()) {
      b.touched = this.bodyTouches(b, x, z);
      b.hidden = !b.touched && this.hidesPlayer(b, x, y, z, camera.position, b.hidden ? BODY_HALF_WIDTH_LEAVE : BODY_HALF_WIDTH_ENTER);
      b.marker.visible = b.hidden;
    }
  }

  // Is any part of the player's body over the building's footprint, that is, is it inside, entering or leaving?
  private bodyTouches(b: Building, x: number, z: number): boolean {
    return x + BODY_RADIUS > b.x0 && x - BODY_RADIUS < b.x1 + 1 && z + BODY_RADIUS > b.z0 && z - BODY_RADIUS < b.z1 + 1;
  }

  // Does the building hide the player from the camera, even partly? True when a line from the camera to any of the points
  // of the player's body (a grid of heights and widths) enters the building before it reaches the point.
  private hidesPlayer(b: Building, x: number, y: number, z: number, cameraPosition: THREE.Vector3, halfWidth: number): boolean {
    _box.min.set(b.x0, 0, b.z0);
    _box.max.set(b.x1 + 1, b.top, b.z1 + 1);
    for (const height of BODY_HEIGHTS) {
      for (const side of [-halfWidth, 0, halfWidth]) {
        _sample.set(x + side * _right.x, y + height, z + side * _right.z); // across the body, as the camera sees it
        const length = _direction.subVectors(_sample, cameraPosition).length();
        _ray.set(cameraPosition, _direction.divideScalar(length));
        if (_ray.intersectBox(_box, _hit) !== null && cameraPosition.distanceTo(_hit) < length) return true;
      }
    }
    return false;
  }
}
