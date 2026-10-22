import type { SeenArea } from '@game/sight/seen-area';
import * as THREE from 'three';
import type { WallFaces } from './wall-samples';

// The cells of the walls that the player has no use for are not drawn at all. A wall that is out of his sight is black anyway
// (see Sight), but black is not nothing: it stands in the way of the camera and hides what is behind it that he does see,
// such as the floor of his own room behind the top of a wall of the room next door, when the wall between them goes off
// the screen. The camera sees one face of a wall, the one on its side, and it is that face that a wall is drawn for: a cell is
// left out unless the player sees what stands before that face. The wall of his room is seen by the camera from inside, so it
// stays whole, whatever the doorway beside it shows; the wall of the room next door is seen from outside, from where
// he sees nothing, so it goes, and its neighbours with it.
//
// A layer of walls has an attribute of its own for every instance, `seen`, 1 or 0, and its materials move a vertex that is 0 out
// of the picture. Only the picture: the shadow is cast with the instance matrices by other materials, and a wall that is
// left out still shades, as the light is not the player's sight.
const ATTRIBUTE = 'seen';

// The material does not draw the instances whose attribute `seen` is 0.
export function cullUnseen(material: THREE.Material): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float ${ATTRIBUTE};`)
      .replace('#include <project_vertex>', `#include <project_vertex>\nif (${ATTRIBUTE} < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`); // outside of what is drawn
  };
  material.customProgramCacheKey = () => `cull-${ATTRIBUTE}`;
}

// A layer of walls whose cells that are not wanted are left out of the picture.
export class UnseenCull {
  private readonly seen: THREE.InstancedBufferAttribute;
  private area: SeenArea | null = null; // what it was told by the last time, and from where the camera was
  private readonly camera = new THREE.Vector3(NaN, NaN, NaN);

  constructor(
    geometry: THREE.BufferGeometry,
    private readonly cells: readonly WallFaces[],
  ) {
    this.seen = new THREE.InstancedBufferAttribute(new Float32Array(cells.length).fill(1), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(ATTRIBUTE, this.seen);
  }

  // A cell is drawn if the area has any point before the face of it that the camera sees.
  update(area: SeenArea, camera: THREE.Vector3): void {
    if (area === this.area && camera.equals(this.camera)) return; // nothing has moved
    this.area = area;
    this.camera.copy(camera);
    let changed = false;
    this.cells.forEach(({ axis, middle, low, high }, i) => {
      const faceSeen = camera[axis] < middle ? low : high;
      let wanted = false;
      for (let k = 0; k < faceSeen.length && !wanted; k += 2) wanted = area.contains(faceSeen[k], faceSeen[k + 1]);
      const value = wanted ? 1 : 0;
      if (this.seen.array[i] !== value) {
        this.seen.array[i] = value;
        changed = true;
      }
    });
    if (changed) this.seen.needsUpdate = true;
  }
}
