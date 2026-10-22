import { RenderOrder } from '@game/render-order';
import { EYE_H, type World } from '@game/world/world';
import * as THREE from 'three';
import { SeenArea } from './seen-area';
import { sightSegments } from './sight-segments';
import { VOLUME_CORNERS_PER_POINT, writeSightVolume } from './sight-volume';
import { Occluders } from './visibility-polygon';

// What the player sees is what the eyes see, not what the camera does: the camera is over the roof and looks into every
// room, the character looks at what is in the line of his sight. All that is out of it (the rooms behind a wall, with what shines in them) is
// blacked out, as if it were not there. What is seen through a doorway is seen, in the shape of the way the sight goes.
//
// It is done in the one picture, with the stencil buffer, so that it is exact to a pixel and costs nothing but a few triangles:
// 1. What the character sees, seen from above, is a polygon (see Occluders). A prism over it, from under the floor
//    to over the roof, is drawn with no colour: the front faces that are in front of the picture count +1 in the stencil buffer
//    and the back faces count -1. A point of the picture is in the prism if the count there is 1 (the ray of the camera has
//    entered the prism and has not left it before it reached the point), and out of it if the count is 0.
// 2. Last of all, a black sheet over the whole screen is drawn where the count is not 1.
// The renderer must be made with a stencil buffer.
export class Sight {
  seen: SeenArea | null = null; // what the character sees now, from the last update; null before it
  private readonly geometry = new THREE.BufferGeometry();
  private readonly occludersByRow = new Map<number, Occluders>(); // what stops the sight, by the row of cells at the height of the eyes
  private readonly range: number;
  private positions = new Float32Array(0);

  constructor(
    private readonly world: World,
    scene: THREE.Scene,
  ) {
    this.range = Math.hypot(world.sizeX, world.sizeZ); // far enough to cross the world from anywhere in it
    const counting = (side: THREE.Side, operation: THREE.StencilOp): THREE.Mesh => {
      const material = new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        transparent: true, // after everything that is opaque, and after what is faded
        side,
        stencilWrite: true,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilZPass: operation,
      });
      return this.overlay(new THREE.Mesh(this.geometry, material), RenderOrder.SightVolume);
    };
    const shroud = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', // the screen, whatever the camera
        fragmentShader: 'void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }',
        depthTest: false,
        depthWrite: false,
        transparent: true,
        stencilWrite: true, // switches the test on; nothing is written, the operations keep it
        stencilFunc: THREE.NotEqualStencilFunc,
        stencilRef: 1,
      }),
    );
    scene.add(counting(THREE.FrontSide, THREE.IncrementWrapStencilOp), counting(THREE.BackSide, THREE.DecrementWrapStencilOp), this.overlay(shroud, RenderOrder.SightShroud));
  }

  // Called every frame with the character's feet at (x, y, z): what he sees is what the eyes see from there.
  update(x: number, y: number, z: number): void {
    const row = Math.floor(y + EYE_H);
    let occluders = this.occludersByRow.get(row);
    if (!occluders) this.occludersByRow.set(row, (occluders = new Occluders(sightSegments(this.world, row))));

    const corners = occluders.polygonFrom(x, z, this.range);
    this.seen = new SeenArea(x, z, corners);
    this.reserve(corners.length / 2);
    const count = writeSightVolume(this.positions, corners, x, z, 0, this.world.sizeY + 1);
    this.geometry.attributes['position'].needsUpdate = true;
    this.geometry.setDrawRange(0, count);
  }

  // Makes a material draw only where what is behind it is seen: the pixels with the count 1. It is for what fades: a wall that
  // fades has to be drawn after the blacking out (see RenderOrder), which then knows nothing of the wall itself, and is
  // not drawn where it would show what is not seen (a wall is lit on its far side by what shines there).
  restrict(material: THREE.Material): void {
    material.stencilWrite = true; // switches the test on; nothing is written, the operations keep it
    material.stencilFunc = THREE.EqualStencilFunc;
    material.stencilRef = 1;
  }

  // Room for a prism over a polygon of this many corners in the geometry, which grows as the polygon does.
  private reserve(points: number): void {
    const length = points * VOLUME_CORNERS_PER_POINT * 3;
    if (this.positions.length >= length) return;
    this.positions = new Float32Array(length * 2);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
  }

  private overlay(mesh: THREE.Mesh, renderOrder: number): THREE.Mesh {
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false; // the geometry changes every frame, and the sheet has no place in the world
    return mesh;
  }
}
