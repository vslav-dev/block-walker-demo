import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxesOf } from './layer-boxes';
import { isWallType, type LayerType } from './layer-types';

// The geometry of a layer: its boxes (see boxesOf) around the center of a cell. A wall part is built on the north side of the
// cell in its lowest row; the other sides are this one rotated around the cell center.
export function createLayerGeometry(type: LayerType): THREE.BufferGeometry {
  const boxes = boxesOf(type).map(({ x0, y0, z0, x1, y1, z1 }) =>
    new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2 - 0.5, (y0 + y1) / 2 - 0.5, (z0 + z1) / 2 - 0.5),
  );
  const geometry = mergeGeometries(boxes);
  return isWallType(type) ? withTwoPasses(geometry) : geometry;
}

// A faded wall is drawn in two passes: the first writes only depth, the second blends the color. So just the nearest
// surface of the wall shows through, not the faces between its stacked blocks. The first pass is pushed back, so that
// the second one always passes its own depth. A material that is not an array draws the whole geometry once.
function withTwoPasses(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const count = geometry.index!.count;
  geometry.clearGroups();
  geometry.addGroup(0, count, 0); // depth pass
  geometry.addGroup(0, count, 1); // color pass
  return geometry;
}
