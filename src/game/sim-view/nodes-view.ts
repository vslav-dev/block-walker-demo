import type { ResourceNode } from '@game/sim/nodes';
import type { Simulation } from '@game/sim/simulation';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BUSH_COLOR = 0x2f6b34;
const BERRY_COLOR = 0xc8283c;
const BERRY_SIZE = 0.14;
// Where the berries are on a bush, in blocks from the middle of its foot: on the sides of the low block, on its top and on the top of the crown.
const BERRY_SPOTS: readonly (readonly [number, number, number])[] = [
  [0.47, 0.3, 0.15],
  [-0.47, 0.25, -0.2],
  [0.2, 0.28, 0.47],
  [-0.25, 0.32, -0.47],
  [-0.25, 0.52, 0.25],
  [0.3, 0.52, -0.28],
  [0.1, 0.81, 0.1],
];
const GOLDEN_ANGLE = 2.399963; // radians: the bushes are turned each its own way

const _local = new THREE.Matrix4();
const _berry = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _unit = new THREE.Vector3(1, 1, 1);
const _nothing = new THREE.Vector3(0, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);

// A bush of blocks: a low block and a smaller one on it.
function bushGeometry(): THREE.BufferGeometry {
  const low = new THREE.BoxGeometry(0.9, 0.5, 0.9).translate(0, 0.25, 0);
  const crown = new THREE.BoxGeometry(0.6, 0.3, 0.6).translate(0.08, 0.65, -0.05);
  return mergeGeometries([low, crown]);
}

// The nodes of the simulation on the screen. All bushes are one draw and all berries another; a bush that is empty has its berries
// scaled to nothing.
export class NodesView {
  private readonly nodes: readonly ResourceNode[];
  private readonly berries: THREE.InstancedMesh;
  private readonly bushes: THREE.Matrix4[] = [];
  private readonly shown: boolean[]; // whether the berries of a bush are in the picture

  constructor(sim: Simulation, scene: THREE.Scene) {
    this.nodes = sim.nodes;
    const bodies = new THREE.InstancedMesh(bushGeometry(), new THREE.MeshLambertMaterial({ color: BUSH_COLOR }), this.nodes.length);
    this.berries = new THREE.InstancedMesh(
      new THREE.BoxGeometry(BERRY_SIZE, BERRY_SIZE, BERRY_SIZE),
      new THREE.MeshLambertMaterial({ color: BERRY_COLOR }),
      this.nodes.length * BERRY_SPOTS.length,
    );
    for (const mesh of [bodies, this.berries]) {
      mesh.frustumCulled = false; // few and spread over the field; the bounds of instances that come and go would not be right
      mesh.receiveShadow = true;
    }
    bodies.castShadow = true;

    this.nodes.forEach((node, i) => {
      const ground = sim.world.groundAt(node.x, node.z, 1) ?? 1;
      _quat.setFromAxisAngle(_axisY, node.id * GOLDEN_ANGLE);
      this.bushes.push(new THREE.Matrix4().compose(_pos.set(node.x, ground, node.z), _quat, _unit));
      bodies.setMatrixAt(i, this.bushes[i]);
    });
    this.shown = this.nodes.map((node) => node.ready);
    this.nodes.forEach((_node, i) => this.placeBerries(i));

    scene.add(bodies, this.berries);
  }

  // Called every frame; changes the picture only where a node has become ready or empty.
  update(): void {
    let changed = false;
    this.nodes.forEach((node, i) => {
      if (node.ready === this.shown[i]) return;
      this.shown[i] = node.ready;
      this.placeBerries(i);
      changed = true;
    });
    if (changed) this.berries.instanceMatrix.needsUpdate = true;
  }

  private placeBerries(bush: number): void {
    BERRY_SPOTS.forEach(([x, y, z], k) => {
      _berry.multiplyMatrices(this.bushes[bush], _local.makeTranslation(x, y, z));
      if (!this.shown[bush]) _berry.scale(_nothing); // not there: nothing of it is drawn
      this.berries.setMatrixAt(bush * BERRY_SPOTS.length + k, _berry);
    });
  }
}
