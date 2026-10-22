import { generateDepot } from '@game/world/depot/depot-generator';
import * as THREE from 'three';
import { Sight } from './sight';
import { VOLUME_CORNERS_PER_POINT, writeSightVolume } from './sight-volume';
import { visibilityPolygon } from './visibility-polygon';

const triangleNormal = (positions: Float32Array, i: number): THREE.Vector3 => {
  const [a, b, c] = [0, 3, 6].map((k) => new THREE.Vector3().fromArray(positions, 3 * i + k));
  return b.sub(a).cross(c.sub(a));
};

describe('writeSightVolume', () => {
  it('writes a lid, a base and a side to every corner, all of them facing out of the prism', () => {
    const corners = visibilityPolygon([{ ax: 3, az: -9, bx: 3, bz: 9 }], 0, 0, 5); // a few corners, not round
    const positions = new Float32Array(corners.length * VOLUME_CORNERS_PER_POINT * 3);
    const count = writeSightVolume(positions, corners, 0, 0, 0, 4);
    expect(count).toBe((corners.length / 2) * VOLUME_CORNERS_PER_POINT);

    const centre = new THREE.Vector3(0, 2, 0);
    for (let i = 0; i < count; i += 3) {
      const triangle = [0, 1, 2].map((k) => new THREE.Vector3().fromArray(positions, 3 * (i + k)));
      const middle = triangle[0].clone().add(triangle[1]).add(triangle[2]).divideScalar(3);
      const normal = triangleNormal(positions, i);
      if (normal.lengthSq() < 1e-12) continue; // a sliver between two rays that are at the same place
      // From a point that is in the middle of the prism, as the prism is star-shaped round it, every face looks away.
      expect(normal.dot(middle.sub(centre)), `triangle ${i / 3}`).toBeGreaterThan(0);
    }
  });
});

describe('Sight', () => {
  it('puts a prism and a sheet into the scene and draws a prism of what is seen from where the character stands', () => {
    const scene = new THREE.Scene();
    const { world, spawn } = generateDepot(1);
    const sight = new Sight(world, scene);
    expect(scene.children, 'the front faces, the back faces, the sheet').toHaveLength(3);

    sight.update(spawn.x, 1, spawn.z);
    const [front, back] = scene.children as THREE.Mesh[];
    const drawn = front.geometry.drawRange.count;
    expect(drawn).toBeGreaterThan(0);
    expect(drawn % VOLUME_CORNERS_PER_POINT).toBe(0);
    expect(back.geometry, 'the same prism').toBe(front.geometry);

    // The prism follows the character: its lid starts at the point he stands at.
    const position = front.geometry.attributes['position'];
    expect([position.getX(0), position.getZ(0)]).toEqual([spawn.x, spawn.z]);
    sight.update(1.5, 1, 1.5);
    expect([position.getX(0), position.getZ(0)]).toEqual([1.5, 1.5]);
  });

  it('counts the prism in the stencil buffer: +1 for a front face, -1 for a back one, and blacks out where the count is not 1', () => {
    const scene = new THREE.Scene();
    new Sight(generateDepot(1).world, scene);
    const [front, back, shroud] = (scene.children as THREE.Mesh[]).map((mesh) => mesh.material as THREE.Material);
    expect([front.stencilZPass, back.stencilZPass]).toEqual([THREE.IncrementWrapStencilOp, THREE.DecrementWrapStencilOp]);
    expect([front.side, back.side]).toEqual([THREE.FrontSide, THREE.BackSide]);
    expect([front.colorWrite, back.colorWrite, front.depthWrite, back.depthWrite], 'the prism is not seen itself').toEqual([false, false, false, false]);
    expect([shroud.stencilFunc, shroud.stencilRef, shroud.depthTest]).toEqual([THREE.NotEqualStencilFunc, 1, false]);
  });

  it('what fades is drawn only where the count is 1', () => {
    const sight = new Sight(generateDepot(1).world, new THREE.Scene());
    const material = new THREE.MeshBasicMaterial();
    sight.restrict(material);
    expect([material.stencilWrite, material.stencilFunc, material.stencilRef]).toEqual([true, THREE.EqualStencilFunc, 1]);
    expect(material.stencilZPass, 'and writes nothing').toBe(THREE.KeepStencilOp);
  });
});
