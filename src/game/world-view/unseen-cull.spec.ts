import { Occluders } from '@game/sight/visibility-polygon';
import { SeenArea } from '@game/sight/seen-area';
import { WallSide, wallSideByBit } from '@game/world/blocks';
import { generateDepot } from '@game/world/depot/depot-generator';
import { Sight } from '@game/sight/sight';
import * as THREE from 'three';
import { UnseenCull } from './unseen-cull';
import { wallFaces } from './wall-samples';
import { WorldView } from './world-view';

describe('wallFaces', () => {
  it('are the points before each face of the slab: a little off the border on the side the slab does not stand on, and a little past the slab', () => {
    const north = { x: 5, y: 1, z: 7, rotY: wallSideByBit(WallSide.North).rotY }; // the border z = 7, the slab stands south of it
    const faces = wallFaces({ axis: 'z', at: 7 }, north);
    expect(faces.axis).toBe('z');
    expect(faces.middle).toBeCloseTo(7.05);
    expect(faces.low).toHaveLength(2 * 5);
    expect(faces.high).toHaveLength(2 * 5);
    for (let i = 0; i < faces.low.length; i += 2) {
      expect(faces.low[i] > 5 && faces.low[i] < 6, 'along the cell').toBe(true);
      expect(faces.low[i + 1], 'off the border to the north').toBeCloseTo(6.94);
      expect(faces.high[i + 1], 'past the slab to the south').toBeCloseTo(7.16);
    }
    const east = { x: 5, y: 1, z: 7, rotY: wallSideByBit(WallSide.East).rotY }; // the border x = 6, the slab stands west of it
    const eastFaces = wallFaces({ axis: 'x', at: 6 }, east);
    expect(eastFaces.middle).toBeCloseTo(5.95);
    for (let i = 0; i < eastFaces.low.length; i += 2) {
      expect(eastFaces.low[i], 'past the slab to the west').toBeCloseTo(5.84);
      expect(eastFaces.high[i], 'off the border to the east').toBeCloseTo(6.06);
      expect(eastFaces.low[i + 1] > 7 && eastFaces.low[i + 1] < 8).toBe(true);
    }
  });
});

describe('UnseenCull', () => {
  // A room 10 across (x 0..10, z 0..10), seen from its middle; the camera is far to the south and high.
  const area = new SeenArea(5, 5, new Occluders([
    { ax: 0, az: 0, bx: 10, bz: 0 },
    { ax: 10, az: 0, bx: 10, bz: 10 },
    { ax: 10, az: 10, bx: 0, bz: 10 },
    { ax: 0, az: 10, bx: 0, bz: 0 },
  ]).polygonFrom(5, 5, 40));
  const camera = new THREE.Vector3(5, 20, 35);
  // A wall along x at z = at, with the slab towards the room (north of the south border, south of the north one): `low` is the face
  // to the north of the slab, `high` the one to the south.
  const wall = (at: number, slabSouth: boolean) => {
    const [low, high] = slabSouth ? [at - 0.06, at + 0.16] : [at - 0.16, at + 0.06];
    return { axis: 'z' as const, middle: at + (slabSouth ? 0.05 : -0.05), low: [4, low, 5, low], high: [4, high, 5, high] };
  };
  const drawn = (cells: ReturnType<typeof wall>[]) => {
    const cull = new UnseenCull(new THREE.BufferGeometry(), cells);
    cull.update(area, camera);
    return Array.from((cull as unknown as { seen: THREE.InstancedBufferAttribute }).seen.array);
  };

  it('a wall of the room is drawn if the camera sees it from inside, a wall of another room, seen from outside, is not', () => {
    expect(drawn([wall(0, true), wall(10, false), wall(20, false)])).toEqual([1, 0, 0]);
  });

  it('is not worked out again while the area and the camera are the same', () => {
    const cells = [wall(0, true)];
    const cull = new UnseenCull(new THREE.BufferGeometry(), cells);
    const array = (cull as unknown as { seen: THREE.InstancedBufferAttribute }).seen.array;
    cull.update(area, camera);
    expect(array[0]).toBe(1);
    cells[0] = wall(10, true); // what it was told is changed: if it looked again it would find the cell not wanted
    cull.update(area, camera);
    expect(array[0], 'did not look').toBe(1);
    cull.update(area, new THREE.Vector3(5, 20, 36));
    expect(array[0], 'the camera has moved: it looks').toBe(0);
  });

  it('the camera sees the face on its side whatever the slab, and it is the one the player must see', () => {
    // The north wall of the room, with the slab to the north of its border, outside the room: from the south it is seen from inside.
    expect(drawn([wall(0, false)])).toEqual([1]);
    // The far side of a wall that the camera is on the outside of, whose other face looks at a seen place, is not enough.
    expect(drawn([wall(10, true)])).toEqual([0]);
  });
});

describe('the walls of a depot as the character sees them', () => {
  it('those of the room he is in are all drawn, those of the rooms that he does not see are left out', () => {
    const { world, spawn } = generateDepot(7);
    const scene = new THREE.Scene();
    const sight = new Sight(world, scene);
    const view = new WorldView(world, scene, { wallFade: { opacity: 0, speed: 60 }, sight });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(spawn.x, 25, spawn.z + 20);
    camera.lookAt(spawn.x, 1, spawn.z);
    camera.updateMatrixWorld();
    sight.update(spawn.x, 1, spawn.z);
    view.update(spawn.x, 1, spawn.z, camera, 1 / 60);

    let drawn = 0;
    let left = 0;
    scene.traverse((o) => {
      if (!(o instanceof THREE.InstancedMesh)) return;
      const seen = o.geometry.getAttribute('seen');
      if (!seen) return;
      for (let i = 0; i < seen.count; i++) {
        if (seen.getX(i) === 1) drawn++;
        else left++;
      }
    });
    expect(drawn, 'the walls of the room he is in').toBeGreaterThan(4);
    expect(left, 'and all the others, in the rooms behind the walls').toBeGreaterThan(drawn);
  });
});
