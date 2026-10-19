import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DoorBeacon } from './door-beacon.js';
import { doorHint } from './door-hint.js';
import {
  Block, BlockColor, FRAME_COLOR, FRAME_WIDTH, STAIR_STEPS, STOREY_H, Top, TopColor, WALL_COLOR, WALL_SIDES, WALL_THICKNESS, WallSide,
  frameHasHeader, frameHasSill, frameSide, isStairs, storeyAt,
} from './blocks.js';

// Mesh types of the slabs and frames, next to the block ids. The south wall is the one between the camera and the player,
// so its parts are meshes of their own that can fade; the parts of all other walls are plain opaque ones.
// A wall part is the slab itself or one of the bars of a frame.
const WallPart = { Slab: 'slab', Posts: 'posts', Header: 'header', Sill: 'sill' };
const wallType = (part, south) => `${south ? 'south-' : ''}wall-${part}`;
const isSouthType = (type) => typeof type === 'string' && type.startsWith('south-');
const isWallType = (type) => typeof type === 'string' && type.startsWith('wall-');
const topType = (kind) => `top-${kind}`; // floors and roofs, one type per Top kind
const isTopType = (type) => typeof type === 'string' && type.startsWith('top-');
const FRAME_DEPTH = WALL_THICKNESS + 0.04; // a frame is a little deeper than the wall, so it stands out of it
const wallColors = Object.fromEntries([false, true].flatMap((south) => Object.values(WallPart)
  .map((part) => [wallType(part, south), part === WallPart.Slab ? WALL_COLOR : FRAME_COLOR])));
const COLORS = {
  ...BlockColor,
  ...wallColors,
  ...Object.fromEntries(Object.entries(TopColor).map(([kind, color]) => [topType(kind), color])),
};
const WALL_FADED_OPACITY = 0.2; // the south wall fades to this opacity while the player is inside
const WALL_FADE_SPEED = 10;

// A building that hides the player from the camera, wholly or partly, disappears at once. Only a marker of its
// footprint and outline stays, so the player and everything behind the building are visible.
// The player counts as hidden when a line from the camera to any of these points of its body hits the building first,
// unless a part of the body is already over the building's footprint: then it is entering or leaving, and the building
// stays (the lines would hit the building around a point inside it, which would hide it for a few frames in a doorway).
const BODY_RADIUS = 0.3; // half the footprint of the body: a wall keeps it farther away, so standing flush outside never touches
const BODY_HEIGHTS = [0.15, 0.9, 1.65]; // feet, chest, head
const BODY_HALF_WIDTH_ENTER = BODY_RADIUS; // standing flush against a side wall is not hidden
const BODY_HALF_WIDTH_LEAVE = 0.45; // wider while hidden, so that the building does not flicker back and forth at the edge
// The beacon of a door that is out of sight (see doorHint) is dimmed as the player gets close to it: there is nothing to
// hint at any more, and the mat would tint the player standing on it.
const BEACON_NEAR_START = 1.5; // the beacon is gone this close to the door,
const BEACON_NEAR_END = 3.5; // and fully there this far from it
const MARKER_PLATE_TINT = 0.3; // how much of the roof's color the footprint plate has
const MARKER_EDGE_OPACITY = 0.6;
const MARKER_EDGE_COLOR = 0xf2e6d0;

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _unit = new THREE.Vector3(1, 1, 1);
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();
const _axisY = new THREE.Vector3(0, 1, 0);
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

// The parts of a wall cell, built on its north side; the other sides are this one rotated around the cell center.
// width/height/x/y place a bar of the frame in the cell, from its center.
function createWallPartGeometry(part) {
  const bar = (width, height, x, y) => new THREE.BoxGeometry(width, height, FRAME_DEPTH).translate(x, y, -0.5 + FRAME_DEPTH / 2);
  const edge = 0.5 - FRAME_WIDTH / 2;
  if (part === WallPart.Posts) return mergeGeometries([bar(FRAME_WIDTH, 1, -edge, 0), bar(FRAME_WIDTH, 1, edge, 0)]);
  if (part === WallPart.Header) return bar(1, FRAME_WIDTH, 0, edge);
  if (part === WallPart.Sill) return bar(1, FRAME_WIDTH, 0, -edge);
  return new THREE.BoxGeometry(1, 1, WALL_THICKNESS).translate(0, 0, -0.5 + WALL_THICKNESS / 2);
}

// The south wall is drawn in two passes: the first writes only depth, the second blends the color. So just the nearest
// surface of the wall shows through when it is faded, not the faces between its stacked blocks. The first pass is
// pushed back, so that the second one (pulled forward) always passes its own depth.
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

// One instance per slab of a wall cell.
function wallInstances(sides, x, y, z) {
  return WALL_SIDES.filter((side) => (sides & side.bit) !== 0).map((side) => ({ x, y, z, rotY: side.rotY }));
}

// The parts of the frame in a cell as [type, instances]: posts, and a header and a sill if it has them.
function frameParts(frame, x, y, z) {
  const side = WALL_SIDES.find((s) => s.bit === frameSide(frame));
  const south = side.bit === WallSide.South;
  const instances = [{ x, y, z, rotY: side.rotY }];
  return [
    [wallType(WallPart.Posts, south), instances],
    ...(frameHasHeader(frame) ? [[wallType(WallPart.Header, south), instances]] : []),
    ...(frameHasSill(frame) ? [[wallType(WallPart.Sill, south), instances]] : []),
  ];
}

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
      if (!buildings.has(id)) buildings.set(id, { id, x0: x, x1: x, z0: z, z1: z, top: 1, hidden: false, marker: null });
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
    for (const part of Object.values(WallPart)) {
      geometries[wallType(part, false)] = createWallPartGeometry(part);
      geometries[wallType(part, true)] = withTwoPasses(createWallPartGeometry(part));
    }
    // What a layer that is out of view is drawn with: nothing. A mesh that is not `visible` would also be left out of the
    // shadow map, and the roof must keep shading the rooms below it with the roof taken off the view.
    const hiddenMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const depthPassMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    // A wall can share its cell with a block (stairs docked to it); the pull towards the camera
    // settles the coplanar outer faces in favor of the wall instead of letting them flicker.
    const wallMaterial = (type, extra) => new THREE.MeshStandardMaterial({ color: COLORS[type], roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, ...extra });
    const materials = new Map();
    const groups = new Map();

    const addInstances = (type, storey, x, z, instances) => {
      const building = world.buildingAt(x, z);
      const key = `${type}|${building}|${storey}`;
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { type, building, storey, cells: [] }));
      group.cells.push(...instances);
    };

    for (let y = 0; y < world.sizeY; y++) {
      const storey = storeyOfBlock(y);
      for (let z = 0; z < world.sizeZ; z++) {
        for (let x = 0; x < world.sizeX; x++) {
          const id = world.get(x, y, z);
          if (isStairs(id)) addInstances(Block.Stairs, storey, x, z, [{ x, y, z, rotY: -(id - Block.Stairs) * Math.PI / 2 }]);
          else if (id !== Block.Air) addInstances(id, storey, x, z, [{ x, y, z, rotY: 0 }]);

          const sides = world.getWalls(x, y, z);
          const others = sides & ~WallSide.South;
          if (others) addInstances(wallType(WallPart.Slab, false), storey, x, z, wallInstances(others, x, y, z));
          if (sides & WallSide.South) addInstances(wallType(WallPart.Slab, true), storey, x, z, wallInstances(WallSide.South, x, y, z));

          const frame = world.getFrame(x, y, z);
          if (frame) for (const [type, instances] of frameParts(frame, x, y, z)) addInstances(type, storey, x, z, instances);

          const top = world.getTop(x, y, z);
          if (top !== Top.None) addInstances(topType(top), storeyOfTop(y), x, z, [{ x, y, z, rotY: 0 }]);
        }
      }
    }

    for (const { type, building, storey, cells } of groups.values()) {
      const isSouthWall = isSouthType(type);
      if (!isSouthWall && !materials.has(type)) {
        materials.set(type, isWallType(type) ? wallMaterial(type) : new THREE.MeshStandardMaterial({ color: COLORS[type], roughness: 0.95 }));
      }
      // Every south wall fades on its own, so it has its own material.
      const material = isSouthWall ? wallMaterial(type, { transparent: true, depthWrite: false }) : materials.get(type);
      // The south wall has a material per pass, see its geometry groups.
      const shownMaterial = isSouthWall ? [depthPassMaterial, material] : material;
      const invisibleMaterial = isSouthWall ? [hiddenMaterial, hiddenMaterial] : hiddenMaterial;
      const mesh = new THREE.InstancedMesh(geometries[type] ?? boxGeometry, shownMaterial, cells.length);
      mesh.castShadow = !(isTopType(type) && storey === 0); // the ground level needs no shadow, nothing is below it
      mesh.receiveShadow = true;
      cells.forEach((cell, i) => {
        setInstance(mesh, i, cell);
        mesh.setColorAt(i, _color.setScalar(0.86 + 0.14 * noise(cell.x, cell.y, cell.z)));
      });
      scene.add(mesh);
      this.layers.push({ type, owner: this.buildings.get(building), building, storey, mesh, material, shownMaterial, invisibleMaterial, opacity: 1 });
    }
  }

  // Called every frame with the player's position and the camera's.
  update(x, y, z, cameraPosition, dt) {
    const building = this.world.buildingAt(Math.floor(x), Math.floor(z));
    const storey = storeyAt(y);
    const k = 1 - Math.exp(-WALL_FADE_SPEED * dt);

    for (const b of this.buildings.values()) {
      b.hidden = !this.bodyTouches(b, x, z) && this.hidesPlayer(b, x, y, z, cameraPosition, b.hidden ? BODY_HALF_WIDTH_LEAVE : BODY_HALF_WIDTH_ENTER);
      b.marker.visible = b.hidden;
    }

    this.time += dt;
    for (const beacon of this.beacons) {
      const { door } = beacon;
      const near = THREE.MathUtils.clamp((Math.hypot(x - (door.x + 0.5), z - (door.z + 0.5)) - BEACON_NEAR_START) / (BEACON_NEAR_END - BEACON_NEAR_START), 0, 1);
      const inside = this.bodyTouches(this.buildings.get(door.building), x, z);
      beacon.update(inside ? 0 : doorHint(door, cameraPosition.x, cameraPosition.z) * near, k, this.time);
    }

    for (const layer of this.layers) {
      const inside = building !== 0 && layer.building === building;
      const inView = !(inside && layer.storey > storey) && !layer.owner?.hidden;
      layer.mesh.material = inView ? layer.shownMaterial : layer.invisibleMaterial;
      if (isSouthType(layer.type)) this.fadeSouthWall(layer, inside && layer.storey === storey, k);
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
        _sample.set(x + side, y + height, z); // the camera looks along z, so the screen's horizontal is x
        const length = _direction.subVectors(_sample, cameraPosition).length();
        _ray.set(cameraPosition, _direction.divideScalar(length));
        if (_ray.intersectBox(_box, _hit) !== null && cameraPosition.distanceTo(_hit) < length) return true;
      }
    }
    return false;
  }

  // The south wall, between the camera and the player, fades so the player stays visible indoors.
  // The other walls are seen edge-on or behind the player and never get in the way.
  fadeSouthWall(layer, active, k) {
    const target = active ? WALL_FADED_OPACITY : 1;
    if (layer.opacity === target) return;
    layer.opacity = Math.abs(target - layer.opacity) < 0.002 ? target : layer.opacity + (target - layer.opacity) * k;
    layer.material.opacity = layer.opacity; // only the picture fades: the wall still shades the room
  }
}
