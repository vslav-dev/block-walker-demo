import { FRAME_COLOR, WALL_COLOR } from '@game/world/blocks';
import { generateDepot } from '@game/world/depot/depot-generator';
import * as THREE from 'three';
import { WorldView } from './world-view';

const DT = 1 / 60;

function slabMeshes(scene: THREE.Scene): THREE.InstancedMesh[] {
  const found: THREE.InstancedMesh[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && o.castShadow) found.push(o);
  });
  return found;
}

describe('WorldView', () => {
  const { world, spawn } = generateDepot(7);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(spawn.x, 20, spawn.z + 15);
  camera.lookAt(spawn.x, 1, spawn.z);
  camera.updateMatrixWorld();

  it('a thin slab, a wall, a floor or a roof, casts its shadow with both faces, whether it is seen or hidden: no seams of light and no teeth of shade along its joints', () => {
    const scene = new THREE.Scene();
    const view = new WorldView(world, scene, { wallFade: { opacity: 0, speed: 30 }, sight: null });
    const meshes = slabMeshes(scene);
    expect(meshes.length, 'something casts shadows').toBeGreaterThan(10);

    const check = (when: string): void => {
      for (const mesh of meshes) {
        for (const material of [mesh.material].flat()) expect(material.shadowSide, `${when}: a layer of ${mesh.count}`).toBe(THREE.DoubleSide);
      }
    };
    check('before the first frame');
    view.update(spawn.x, 1, spawn.z, camera, DT); // the player is in the hall: the roof is out of view
    const hidden = meshes.filter((mesh) => [mesh.material].flat().every((material) => material.colorWrite === false));
    expect(hidden.length, 'the roof is taken off the view, and so are the walls that fade away').toBeGreaterThan(0);
    check('with the roof off');
  });

  it('the wall of a doorway the player stands in begins to go at once, with the edge of his body across it, and is gone in a quarter of a second', () => {
    // The depot of seed 7: the spawn room is x 25..30, z 19..24 with a doorway in its north wall at x 28..29. The camera is south of the player.
    const vanished = (x: number, z: number, seconds: number): number => {
      const scene = new THREE.Scene();
      const view = new WorldView(world, scene, { wallFade: { opacity: 0, speed: 30 }, sight: null });
      const south = new THREE.PerspectiveCamera();
      south.position.set(x, 20, z + 15);
      south.lookAt(x, 1, z);
      south.updateMatrixWorld();
      for (let t = 0; t < seconds; t += DT) view.update(x, 1, z, south, DT);
      return slabMeshes(scene).filter((mesh) => [mesh.material].flat().every((material) => material.colorWrite === false)).length;
    };
    const inTheRoom = vanished(28.5, 21.5, 1);
    expect(vanished(28.5, 19.3, 1), 'in the doorway, the north wall goes too: more is gone than in the room').toBeGreaterThan(inTheRoom);
    expect(vanished(28.5, 19.3, 0.25), 'and it is as gone as ever it gets in a quarter of a second').toBe(vanished(28.5, 19.3, 1));
    expect(vanished(28.5, 19.3, 0.05), 'and not yet in a twentieth of it').toBeLessThan(vanished(28.5, 19.3, 1));
  });

  it('the walls cast shadows, the trim of the doorways does not: it is no obstacle for light, and its shadow on the wall is a smear of texels', () => {
    const scene = new THREE.Scene();
    new WorldView(world, scene, { wallFade: { opacity: 0, speed: 30 }, sight: null });
    const casting = (color: number): boolean[] => {
      const found: boolean[] = [];
      scene.traverse((o) => {
        if (o instanceof THREE.InstancedMesh && (o.material as THREE.MeshLambertMaterial).color.getHex() === color) found.push(o.castShadow);
      });
      return found;
    };
    const trim = casting(FRAME_COLOR);
    const walls = casting(WALL_COLOR);
    expect(trim.length, 'the depot has doorways').toBeGreaterThan(0);
    expect(trim.some(Boolean), 'no frame casts a shadow').toBe(false);
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every(Boolean), 'every wall does').toBe(true);
  });

  it('the walls are pulled towards the camera by a constant, not by the slope of the face: the slope shows the ends of the slabs inside the wall through its joints', () => {
    const scene = new THREE.Scene();
    new WorldView(world, scene, { wallFade: { opacity: 0, speed: 30 }, sight: null });
    const walls = slabMeshes(scene).filter((mesh) => (mesh.material as THREE.Material).polygonOffset);
    expect(walls.length).toBeGreaterThan(0);
    for (const mesh of walls) expect((mesh.material as THREE.Material).polygonOffsetFactor).toBe(0);
  });
});
