import * as THREE from 'three';
import { generateWorld } from './generator.js';
import { WorldView } from './world-view.js';
import { PlayerBody, WALK_SPEED, RUN_SPEED } from './player.js';
import { loadRobot } from './robot.js';
import { Input } from './input.js';

const CAMERA_PITCH = THREE.MathUtils.degToRad(52); // fixed, looking north from above
const CAMERA_DISTANCE = 26;
const SUN_OFFSET = new THREE.Vector3(-10, 24, 14);
const SKY_COLOR = 0x9ec9e8;

const status = document.querySelector('#status');
const seed = Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e6);
document.querySelector('#seed').textContent = seed;

addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') location.search = `?seed=${Math.floor(Math.random() * 1e6)}`;
});

// --- scene ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.add(new THREE.HemisphereLight(0xdfefff, 0x6b5a45, 1.3));

const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 1, 250);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- game objects ---
const { world, spawn } = generateWorld(seed);
const worldView = new WorldView(world, scene);
const body = new PlayerBody(world, spawn.x, spawn.z);
const input = new Input();

// --- robot ---
let robot = null; // stays null if the model fails to load
try {
  robot = await loadRobot();
  scene.add(robot.root);
  status.hidden = true;
} catch (error) {
  status.textContent = `Failed to load the robot: ${error.message}`;
  setTimeout(() => (status.hidden = true), 4000);
}

// --- loop ---
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
const aimPoint = new THREE.Vector3();
const playerPosition = new THREE.Vector3();
const cameraTarget = new THREE.Vector3(body.x, body.y, body.z);
let visualY = body.y;
let yaw = 0;
let last = performance.now();

renderer.setAnimationLoop((time) => {
  const dt = Math.min((time - last) / 1000, 0.05);
  last = time;

  // Movement: screen-relative because the camera never rotates (W = up the screen).
  const axis = input.moveAxis();
  const length = Math.hypot(axis.x, axis.z);
  const moveX = length ? axis.x / length : 0;
  const moveZ = length ? axis.z / length : 0;
  const running = input.running && !robot?.steering.backpedal; // no running backwards
  const speed = running ? RUN_SPEED : WALK_SPEED;
  body.update(dt, moveX * speed, moveZ * speed);
  visualY += (body.y - visualY) * (1 - Math.exp(-25 * dt)); // smooths stair steps

  // Camera and sun follow the player.
  playerPosition.set(body.x, visualY, body.z);
  cameraTarget.lerp(playerPosition, 1 - Math.exp(-8 * dt));
  camera.position.set(
    cameraTarget.x,
    cameraTarget.y + Math.sin(CAMERA_PITCH) * CAMERA_DISTANCE,
    cameraTarget.z + Math.cos(CAMERA_PITCH) * CAMERA_DISTANCE,
  );
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld();
  worldView.update(body.x, body.y, body.z, camera.position, dt);
  sun.position.copy(cameraTarget).add(SUN_OFFSET);
  sun.target.position.copy(cameraTarget);

  // Face the cursor: project it onto a horizontal plane at chest height.
  aimPlane.constant = -(visualY + 1);
  raycaster.setFromCamera(input.mouse, camera);
  if (raycaster.ray.intersectPlane(aimPlane, aimPoint)) {
    const dx = aimPoint.x - body.x;
    const dz = aimPoint.z - body.z;
    if (Math.hypot(dx, dz) > 0.2) {
      const delta = Math.atan2(dx, dz) - yaw;
      yaw += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-18 * dt));
    }
  }

  if (robot) {
    robot.setPosition(body.x, visualY, body.z);
    robot.update(dt, yaw, moveX, moveZ, input.running);
  }

  renderer.render(scene, camera);
});
