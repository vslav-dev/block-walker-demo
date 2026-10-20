import * as THREE from 'three';
import { generateWorld } from './generator.js';
import { WorldView } from './world-view.js';
import { PlayerBody, WALK_SPEED, RUN_SPEED } from './player.js';
import { loadRobot } from './robot.js';
import { Input } from './input.js';
import { AIM_TUNABLES, Aim } from './aim.js';
import { AimLine } from './aim-line.js';
import { CameraRig } from './camera-rig.js';
import { screenToWorld } from './angles.js';
import { Settings } from './settings.js';
import { SettingsScreen } from './settings-screen.js';
import { Tunables } from './tunables.js';
import { DebugPanel } from './debug-panel.js';
import { Sky } from './sky.js';
import { DAY_TUNABLES, advanceHour, formatHour, skyAt } from './day-cycle.js';
import { ZOOM_TUNABLES } from './zoom.js';

const status = document.querySelector('#status');
const seed = Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e6);

// --- scene ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const sky = new Sky(scene);

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
const settings = new Settings();
const input = new Input(renderer.domElement, settings);
const settingsScreen = new SettingsScreen(settings, { onOpen: () => input.reset(), onResume: () => input.resume() });
const aim = new Aim(settings);
const aimLine = new AimLine(world);
const tunables = new Tunables([...DAY_TUNABLES, ...ZOOM_TUNABLES, ...AIM_TUNABLES]);
const day = tunables.values; // all the tuned values: the time of day and how the light looks (the game moves the hour itself), the camera, the aim
const rig = new CameraRig(camera, body.x, body.y, body.z, tunables.values);
scene.add(aimLine.root);

addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && !settingsScreen.open) location.search = `?seed=${Math.floor(Math.random() * 1e6)}`;
});

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
const playerPosition = new THREE.Vector3();
let visualY = body.y;
let last = performance.now();
let fps = 60;

const degrees = (radians) => `${((radians * 180) / Math.PI).toFixed(1)}°`;
const debug = new DebugPanel(tunables);
let skyState = skyAt(day.hour, day);
debug.watch('FPS', () => fps.toFixed(0));
debug.watch('Time', () => formatHour(day.hour), 'Day and night');
debug.watch('Key light', () => (skyState.sun ? 'sun' : 'moon'), 'Day and night');
debug.watch('Light angle', () => degrees(Math.asin(skyState.direction.y)), 'Day and night');
debug.watch('Light strength', () => skyState.keyIntensity.toFixed(2), 'Day and night');
debug.watch('Shadow strength', () => skyState.shadow.toFixed(2), 'Day and night');
debug.watch('Zoom (0 close … 1 far)', () => rig.zoom.value.toFixed(3), 'Camera');
debug.watch('Camera distance', () => rig.zoom.distance.toFixed(2), 'Camera');
debug.watch('Camera pitch', () => degrees(rig.zoom.pitch), 'Camera');
debug.watch('Camera heading', () => degrees(rig.heading), 'Camera');
debug.watch('Aim mode', () => (aim.aiming ? 'on' : 'off'), 'Aim');
debug.watch('Aim yaw', () => degrees(aim.yaw), 'Aim');
debug.watch('Player x / y / z', () => [body.x, body.y, body.z].map((v) => v.toFixed(2)).join(' / '), 'Camera');

renderer.setAnimationLoop((time) => {
  const dt = Math.min((time - last) / 1000, 0.05);
  fps += (1000 / Math.max(time - last, 1) - fps) * 0.05;
  last = time;
  debug.update(dt);
  if (settingsScreen.open) {
    renderer.render(scene, camera); // the game stands still behind the settings
    return;
  }

  // Movement is relative to the camera: W = up the screen, which is north in the overview and the aim in the aim mode.
  const axis = input.moveAxis();
  const length = Math.hypot(axis.x, axis.z);
  const move = screenToWorld(length ? axis.x / length : 0, length ? axis.z / length : 0, rig.heading);
  const running = input.running && !robot?.steering.backpedal; // no running backwards
  const speed = running ? RUN_SPEED : WALK_SPEED;
  body.update(dt, move.x * speed, move.z * speed);
  visualY += (body.y - visualY) * (1 - Math.exp(-25 * dt)); // smooths stair steps

  // The camera follows the player and looks where the aim says (one frame late, which its own smoothing hides);
  // the light follows the camera's target.
  playerPosition.set(body.x, visualY, body.z);
  rig.update(dt, playerPosition, aim.heading, input.takeWheelY());
  worldView.update(body.x, body.y, body.z, camera, dt);
  day.hour = advanceHour(day.hour, dt, day.timeFlow);
  skyState = skyAt(day.hour, day);
  sky.update(skyState, rig.target);

  // The character looks at the cursor, or where the mouse has turned the view in the aim mode.
  aim.update(dt, input.aiming, input.takeLookX(), rig.cursorYaw(input.mouse, body.x, visualY, body.z));
  aimLine.update(aim.aiming && day.aimLine, aim.aiming && day.aimLineOverEverything, body.x, visualY, body.z, aim.yaw);

  if (robot) {
    robot.setPosition(body.x, visualY, body.z);
    robot.update(dt, aim.yaw, move.x, move.z, input.running);
  }

  renderer.render(scene, camera);
});
