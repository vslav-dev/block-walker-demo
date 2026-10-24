import { plainfieldSim } from '@game/testing/sim';
import * as THREE from 'three';
import { NodesView } from './nodes-view';

// How big the instance is drawn: the cube root of the determinant of its matrix.
function sizeOf(mesh: THREE.InstancedMesh, i: number): number {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(i, matrix);
  return Math.cbrt(Math.abs(matrix.determinant()));
}

describe('NodesView', () => {
  it('shows the berries of the bushes that are full and nothing of the others, and follows them as they change', () => {
    const sim = plainfieldSim(1);
    const scene = new THREE.Scene();
    const view = new NodesView(sim, scene);
    const berries = scene.children.find((child) => child instanceof THREE.InstancedMesh && child.count > sim.nodes.length) as THREE.InstancedMesh;
    const perBush = berries.count / sim.nodes.length;
    const berriesShown = (bush: number) => sizeOf(berries, bush * perBush) > 0;

    sim.nodes.forEach((node, i) => expect(berriesShown(i), `bush ${i}`).toBe(node.ready));

    const full = sim.nodes.findIndex((node) => node.ready);
    sim.nodes[full].harvest();
    view.update();
    expect(berriesShown(full)).toBe(false);

    const empty = sim.nodes.findIndex((node) => !node.ready);
    sim.nodes[empty].fullness = 1;
    view.update();
    expect(berriesShown(empty)).toBe(true);
  });
});
