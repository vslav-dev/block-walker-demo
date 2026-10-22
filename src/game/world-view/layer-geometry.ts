import { STAIR_STEPS, WALL_THICKNESS } from '@game/world/blocks';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WALL_PARTS, type WallPart } from './wall-parts';

// One flight of steps in a block, rising towards +x.
export function createStairsGeometry(): THREE.BufferGeometry {
  const steps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < STAIR_STEPS; i++) {
    const h = (i + 1) / STAIR_STEPS;
    const step = new THREE.BoxGeometry(1 / STAIR_STEPS, h, 1);
    step.translate(-0.5 + (i + 0.5) / STAIR_STEPS, -0.5 + h / 2, 0);
    steps.push(step);
  }
  return mergeGeometries(steps);
}

// A wall part of a storey, built on the north side of the cell in its lowest row; the other sides are this one rotated
// around the cell center. The boxes are placed in the cell as in WALL_PARTS, from the floor of the storey (the row's bottom).
export function createWallPartGeometry(part: WallPart): THREE.BufferGeometry {
  const boxes = WALL_PARTS[part].boxes.map(({ x0, y0, x1, y1, depth }) =>
    new THREE.BoxGeometry(x1 - x0, y1 - y0, depth).translate((x0 + x1) / 2 - 0.5, (y0 + y1) / 2 - 0.5, -0.5 + depth / 2),
  );
  return mergeGeometries(boxes);
}

// The slab of a floor or roof: the top face of the cell.
export function createTopGeometry(): THREE.BufferGeometry {
  const slab = new THREE.BoxGeometry(1, WALL_THICKNESS, 1);
  slab.translate(0, 0.5 - WALL_THICKNESS / 2, 0);
  return slab;
}

// A faded wall is drawn in two passes: the first writes only depth, the second blends the color. So just the nearest
// surface of the wall shows through, not the faces between its stacked blocks. The first pass is pushed back, so that
// the second one (pulled forward) always passes its own depth. A material that is not an array draws the whole geometry once.
export function withTwoPasses(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const count = geometry.index!.count;
  geometry.clearGroups();
  geometry.addGroup(0, count, 0); // depth pass
  geometry.addGroup(0, count, 1); // color pass
  return geometry;
}
