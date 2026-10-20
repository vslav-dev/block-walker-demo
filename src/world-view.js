import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DoorBeacon } from './door-beacon.js';
import { beaconProximity, doorHint, footprintDistance } from './door-hint.js';
import {
  Block, BlockColor, DOOR_H, FRAME_COLOR, FRAME_WIDTH, Opening, STAIR_STEPS, STOREY_H, Top, TopColor, WALL_COLOR, WALL_SIDES,
  WALL_THICKNESS, WINDOW_BOTTOM, WINDOW_TOP, frameOpening, frameSide, isStairs, sidesFacing, storeyAt,
} from './blocks.js';

// Mesh types of the slabs and frames, next to the block ids. A wall of a storey is one tall slab, or, with an opening, the
// wall around it and the frame in it. The walls between the camera and the player fade, so every side of the walls of
// a storey is a layer of its own.
const FRAME_DEPTH = WALL_THICKNESS + 0.04; // a frame is a little deeper than the wall, so it stands out of it
const slab = (x0, y0, x1, y1) => ({ x0, y0, x1, y1, depth: WALL_THICKNESS });
const bar = (x0, y0, x1, y1) => ({ x0, y0, x1, y1, depth: FRAME_DEPTH });
const DOOR_TOP = DOOR_H + FRAME_WIDTH; // the top of the header
// The boxes of every part on the north side of a cell: x across it from 0 to 1, y up from the floor of the storey.
// Nothing overlaps: the posts stand between the bars.
const WALL_PARTS = {
  plain: { color: WALL_COLOR, boxes: [slab(0, 0, 1, STOREY_H)] },
  doorWall: { color: WALL_COLOR, boxes: [slab(0, DOOR_TOP, 1, STOREY_H)] },
  doorFrame: { color: FRAME_COLOR, boxes: [bar(0, 0, FRAME_WIDTH, DOOR_H), bar(1 - FRAME_WIDTH, 0, 1, DOOR_H), bar(0, DOOR_H, 1, DOOR_TOP)] },
  windowWall: { color: WALL_COLOR, boxes: [slab(0, 0, 1, WINDOW_BOTTOM), slab(0, WINDOW_TOP, 1, STOREY_H)] },
  windowFrame: {
    color: FRAME_COLOR,
    boxes: [
      bar(0, WINDOW_BOTTOM, 1, WINDOW_BOTTOM + FRAME_WIDTH), // sill
      bar(0, WINDOW_TOP - FRAME_WIDTH, 1, WINDOW_TOP), // header
      bar(0, WINDOW_BOTTOM + FRAME_WIDTH, FRAME_WIDTH, WINDOW_TOP - FRAME_WIDTH), // posts
      bar(1 - FRAME_WIDTH, WINDOW_BOTTOM + FRAME_WIDTH, 1, WINDOW_TOP - FRAME_WIDTH),
    ],
  },
};
const OPENING_PARTS = { [Opening.Door]: ['doorWall', 'doorFrame'], [Opening.Window]: ['windowWall', 'windowFrame'] };
const wallType = (part) => `wall-${part}`;
const isWallType = (type) => typeof type === 'string' && type.startsWith('wall-');
const topType = (kind) => `top-${kind}`; // floors and roofs, one type per Top kind
const isTopType = (type) => typeof type === 'string' && type.startsWith('top-');
const wallColors = Object.fromEntries(Object.entries(WALL_PARTS).map(([part, { color }]) => [wallType(part), color]));
const COLORS = {
  ...BlockColor,
  ...wallColors,
  ...Object.fromEntries(Object.entries(TopColor).map(([kind, color]) => [topType(kind), color])),
};
const WALL_FADED_OPACITY = 0.2; // the walls facing the camera fade to this opacity while the player is inside
const WALL_FADE_SPEED = 10;
const WALL_FACING = 0.15; // a side faces the camera when its normal points this much (cosine) at it: a wall seen edge-on does not

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

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _unit = new THREE.Vector3(1, 1, 1);
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();
const _axisY = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();
const _sample = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _ray = new THREE.Ray();
const _box = new THREE.Box3();

function createStairsGeometry() {
  const steps = [];
  for (let i = 0; i < STAIR_STEPS; i++) {
    const h = (i + 1) / STAIR_STEPS;
    const step = new THREE.BoxGeometry(1 / STAIR_STEPS, h, 1);
    step.translate(-0.5 + (i + 0.5) / STAIR_STEPS, -0.5 + h / 2, 0); // rises towards +x
    steps.push(step);
  }
  return mergeGeometries(steps);
}

// A wall part of a storey, built on the north side of the cell in its lowest row; the other sides are this one rotated
// around the cell center. The boxes are placed in the cell as in WALL_PARTS, from the floor of the storey (the row's bottom).
function createWallPartGeometry(part) {
  const boxes = WALL_PARTS[part].boxes.map(({ x0, y0, x1, y1, depth }) => (
    new THREE.BoxGeometry(x1 - x0, y1 - y0, depth).translate((x0 + x1) / 2 - 0.5, (y0 + y1) / 2 - 0.5, -0.5 + depth / 2)
  ));
  return mergeGeometries(boxes);
}

// A faded wall is drawn in two passes: the first writes only depth, the second blends the color. So just the nearest
// surface of the wall shows through, not the faces between its stacked blocks. The first pass is pushed back, so that
// the second one (pulled forward) always passes its own depth. A material that is not an array draws the whole geometry once.
function withTwoPasses(geometry) {
  geometry.clearGroups();
  geometry.addGroup(0, geometry.index.count, 0); // depth pass
  geometry.addGroup(0, geometry.index.count, 1); // color pass
  return geometry;
}

// The slab of a floor or roof: the top face of the cell.
function createTopGeometry() {
  const slab = new THREE.BoxGeometry(1, WALL_THICKNESS, 1);
  slab.translate(0, 0.5 - WALL_THICKNESS / 2, 0);
  return slab;
}

// Blocks and walls belong to the storey whose floor plane is at their bottom; a top slab, to the storey above its plane.
const storeyOfBlock = (y) => Math.max(0, Math.floor((y - 1) / STOREY_H));
const storeyOfTop = (y) => Math.floor(y / STOREY_H);

// The walls of a storey, whole, are set in its lowest row, which is where this is true (see blocks.js).
const isStoreyBase = (y) => y >= 1 && (y - 1) % STOREY_H === 0;

// Stable per-block brightness noise in 0..1.
function noise(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function setInstance(mesh, i, cell) {
  _pos.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
  _quat.setFromAxisAngle(_axisY, cell.rotY);
  mesh.setMatrixAt(i, _matrix.compose(_pos, _quat, _unit));
}

// Bounds of every building: footprint in cells and the height of its highest block, wall or slab.
function collectBuildings(world) {
  const buildings = new Map();
  for (let z = 0; z < world.sizeZ; z++) {
    for (let x = 0; x < world.sizeX; x++) {
      const id = world.buildingAt(x, z);
      if (id === 0) continue;
      if (!buildings.has(id)) buildings.set(id, { id, x0: x, x1: x, z0: z, z1: z, top: 1, touched: false, hidden: false, marker: null });
      const b = buildings.get(id);
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
function createMarker(b) {
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

// Renders the voxel world as one InstancedMesh per (block type, building, storey) "layer".
// Layers make "hide the roof when the player is inside" and "hide the building" plain visibility toggles.
export class WorldView {
  constructor(world, scene) {
    this.world = world;
    this.layers = [];
    this.buildings = collectBuildings(world);

    for (const b of this.buildings.values()) {
      b.marker = createMarker(b);
      scene.add(b.marker);
    }

    this.time = 0; // seconds, for the pulse of the beacons
    this.beacons = world.doors.map((door) => new DoorBeacon(door));
    for (const beacon of this.beacons) scene.add(beacon.root);

    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const stairsGeometry = createStairsGeometry();
    const topGeometry = createTopGeometry();
    const geometries = { [Block.Stairs]: stairsGeometry };
    for (const kind of Object.values(Top)) geometries[topType(kind)] = topGeometry;
    for (const part of Object.keys(WALL_PARTS)) geometries[wallType(part)] = withTwoPasses(createWallPartGeometry(part));
    // What a layer that is out of view is drawn with: nothing. A mesh that is not `visible` would also be left out of the
    // shadow map, and the roof must keep shading the rooms below it with the roof taken off the view.
    const hiddenMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const depthPassMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    // A wall can share its cell with a block (stairs docked to it); the pull towards the camera
    // settles the coplanar outer faces in favor of the wall instead of letting them flicker.
    const wallMaterial = (type, extra) => new THREE.MeshStandardMaterial({ color: COLORS[type], roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, ...extra });
    const materials = new Map();
    const groups = new Map();

    // side = the WallSide of a wall part, 0 for everything else.
    const addInstances = (type, storey, x, z, instances, side = 0) => {
      const building = world.buildingAt(x, z);
      const key = `${type}|${building}|${storey}|${side}`;
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { type, side, building, storey, cells: [] }));
      group.cells.push(...instances);
    };

    for (let y = 0; y < world.sizeY; y++) {
      const storey = storeyOfBlock(y);
      for (let z = 0; z < world.sizeZ; z++) {
        for (let x = 0; x < world.sizeX; x++) {
          const id = world.get(x, y, z);
          if (isStairs(id)) addInstances(Block.Stairs, storey, x, z, [{ x, y, z, rotY: -(id - Block.Stairs) * Math.PI / 2 }]);
          else if (id !== Block.Air) addInstances(id, storey, x, z, [{ x, y, z, rotY: 0 }]);

          // A wall of the storey is one tall slab per side, except where there is an opening: its frame brings the wall around it.
          if (isStoreyBase(y)) {
            const frame = world.getFrame(x, y, z);
            const opened = frame ? frameSide(frame) : 0;
            for (const side of WALL_SIDES) {
              const instances = [{ x, y, z, rotY: side.rotY }];
              if (opened & side.bit) for (const part of OPENING_PARTS[frameOpening(frame)]) addInstances(wallType(part), storey, x, z, instances, side.bit);
              else if (world.getWalls(x, y, z) & side.bit) addInstances(wallType('plain'), storey, x, z, instances, side.bit);
            }
          }

          const top = world.getTop(x, y, z);
          if (top !== Top.None) addInstances(topType(top), storeyOfTop(y), x, z, [{ x, y, z, rotY: 0 }]);
        }
      }
    }

    for (const { type, side, building, storey, cells } of groups.values()) {
      const isWall = isWallType(type);
      if (!materials.has(type)) {
        materials.set(type, isWall ? wallMaterial(type) : new THREE.MeshStandardMaterial({ color: COLORS[type], roughness: 0.95 }));
      }
      const shownMaterial = materials.get(type);
      // A wall fades on its own, so it has its own material, drawn in the two passes of its geometry while it is not opaque.
      // It is opaque most of the time: a fading wall would hide what is behind it from the walls drawn after it.
      const fadeMaterial = isWall ? wallMaterial(type, { transparent: true, depthWrite: false }) : null;
      const fadingMaterial = isWall ? [depthPassMaterial, fadeMaterial] : null;
      const mesh = new THREE.InstancedMesh(geometries[type] ?? boxGeometry, shownMaterial, cells.length);
      mesh.castShadow = !(isTopType(type) && storey === 0); // the ground level needs no shadow, nothing is below it
      mesh.receiveShadow = true;
      cells.forEach((cell, i) => {
        setInstance(mesh, i, cell);
        mesh.setColorAt(i, _color.setScalar(0.86 + 0.14 * noise(cell.x, cell.y, cell.z)));
      });
      scene.add(mesh);
      this.layers.push({
        side, owner: this.buildings.get(building), building, storey, mesh, shownMaterial, fadeMaterial, fadingMaterial, invisibleMaterial: hiddenMaterial, opacity: 1,
      });
    }
  }

  // Called every frame with the player's position and the camera, whose matrices are up to date.
  update(x, y, z, camera, dt) {
    const cameraPosition = camera.position;
    const storey = storeyAt(y);
    const k = 1 - Math.exp(-WALL_FADE_SPEED * dt);
    _right.setFromMatrixColumn(camera.matrixWorld, 0); // horizontal: the camera does not roll, only pitches and turns
    const toCamera = _direction.set(cameraPosition.x - x, 0, cameraPosition.z - z).normalize();
    const facing = sidesFacing(toCamera.x, toCamera.z, WALL_FACING);

    // Every building is in one of three states for the player, from the same test, so the picture changes once at the door:
    // touched (a part of the body is over its footprint: it is shown cut to the player's storey), hidden (the body is
    // clear of it and it is in the way of the camera: only its marker stays) or whole.
    for (const b of this.buildings.values()) {
      b.touched = this.bodyTouches(b, x, z);
      b.hidden = !b.touched && this.hidesPlayer(b, x, y, z, cameraPosition, b.hidden ? BODY_HALF_WIDTH_LEAVE : BODY_HALF_WIDTH_ENTER);
      b.marker.visible = b.hidden;
    }

    this.time += dt;
    for (const beacon of this.beacons) {
      const { door } = beacon;
      const house = this.buildings.get(door.building);
      const near = beaconProximity(footprintDistance(house, x, z), Math.hypot(x - (door.x + 0.5), z - (door.z + 0.5)));
      beacon.update(house.touched ? 0 : doorHint(door, cameraPosition.x, cameraPosition.z) * near, k, this.time);
    }

    for (const layer of this.layers) {
      const inside = layer.owner?.touched === true; // the layers of the ground and the rocks have no owner
      const inView = !(inside && layer.storey > storey) && !layer.owner?.hidden;
      if (layer.fadeMaterial) this.fadeWall(layer, inside && layer.storey === storey && (layer.side & facing) !== 0, k);
      if (!inView) layer.mesh.material = layer.invisibleMaterial;
      else layer.mesh.material = layer.opacity < 1 ? layer.fadingMaterial : layer.shownMaterial;
    }
  }

  // Is any part of the player's body over the building's footprint, that is, is it inside, entering or leaving?
  bodyTouches(b, x, z) {
    return x + BODY_RADIUS > b.x0 && x - BODY_RADIUS < b.x1 + 1 && z + BODY_RADIUS > b.z0 && z - BODY_RADIUS < b.z1 + 1;
  }

  // Does the building hide the player from the camera, even partly? True when a line from the camera to any of the points
  // of the player's body (a grid of heights and widths) enters the building before it reaches the point.
  hidesPlayer(b, x, y, z, cameraPosition, halfWidth) {
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

  // The walls between the camera and the player, those facing the camera, fade so the player stays visible indoors.
  // The other walls are seen edge-on or behind the player and never get in the way.
  fadeWall(layer, active, k) {
    const target = active ? WALL_FADED_OPACITY : 1;
    if (layer.opacity === target) return;
    layer.opacity = Math.abs(target - layer.opacity) < 0.002 ? target : layer.opacity + (target - layer.opacity) * k;
    layer.fadeMaterial.opacity = layer.opacity; // only the picture fades: the wall still shades the room
  }
}
