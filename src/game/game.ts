import { Aim } from '@game/aim/aim';
import { AimLine } from '@game/aim/aim-line';
import { CameraRig } from '@game/camera/camera-rig';
import { Body, RUN_SPEED, WALK_SPEED } from '@game/character/body';
import { Robot, loadRobotModel } from '@game/character/robot';
import {
  ANTIALIAS_BELOW_RATIO,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  FPS_SMOOTHING,
  FRAME_EARLY_MILLISECONDS,
  FRAME_MILLISECONDS,
  MAX_FRAME_SECONDS,
  MAX_PIXEL_RATIO,
  STAIRS_SMOOTHING_SPEED,
} from '@game/config';
import { screenToWorld } from '@game/core/angles';
import type { Readout } from '@game/core/readout';
import { Sky } from '@game/daylight/sky';
import type { GameHost } from '@game/game-host';
import { Input } from '@game/input/input';
import { Darkness, type Atmosphere } from '@game/lighting/atmosphere';
import { Lighting } from '@game/lighting/lighting';
import { createReadouts } from '@game/readouts';
import { ResolutionGovernor } from '@game/resolution-governor';
import { Sight } from '@game/sight/sight';
import { Simulation } from '@game/sim/simulation';
import { CreaturesView } from '@game/sim-view/creatures-view';
import { NodesView } from '@game/sim-view/nodes-view';
import type { GameTuning } from '@game/tuning';
import { BIOME_RULES, type Biome } from '@game/world/biome';
import { generateWorld, type SceneId } from '@game/world/generator';
import { WorldView } from '@game/world-view/world-view';
import * as THREE from 'three';

// Which world to play: the scene and the seed of its generator.
export interface GameOptions {
  scene: SceneId;
  seed: number;
}

// The game: it builds all the parts of a world and plays them frame after frame, in a fixed order.
// It knows nothing of the app around it: whatever it needs from there (the settings, the tuned numbers) comes in `host`,
// and it shows what it has to say (`readouts`) for the app to put on the screen.
export class Game {
  readonly tuning: GameTuning;
  readonly sim: Simulation; // the life of the world: creatures and what they live off; the views below only show it
  readonly body: Body;
  readonly aim: Aim;
  readonly rig: CameraRig;
  readonly readouts: Readout[];
  readonly biome: Biome;
  readonly atmosphere: Atmosphere;
  readonly lighting: Lighting;
  fps = 60;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly resolution: ResolutionGovernor;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly worldView: WorldView;
  private readonly nodesView: NodesView;
  private readonly creaturesView: CreaturesView;
  private readonly sight: Sight | null; // null where the whole picture is shown
  private readonly input: Input;
  private readonly aimLine: AimLine;
  private readonly listeners = new AbortController();
  private readonly playerPosition = new THREE.Vector3();
  private robot: Robot | null = null; // stays null if the model is not loaded (yet)
  private visualY: number; // the height the character is drawn at
  private last = performance.now();
  private nextFrameAt = 0; // the time before which the frames are left out, see FRAME_MILLISECONDS
  private paused = false;
  private disposed = false;

  // The canvas is put into `container`, which fills the window.
  constructor(container: HTMLElement, { scene, seed }: GameOptions, host: GameHost) {
    this.tuning = host.tuning;

    const { world, spawn, biome, population } = generateWorld(scene, seed);
    const rules = BIOME_RULES[biome];
    this.biome = biome;

    const pixelRatio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
    // The smoothing of the edges costs a third of a frame, and on a screen of such a density the pixels are too small to show the steps.
    this.renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio < ANTIALIAS_BELOW_RATIO, stencil: rules.limitedSight });
    this.renderer.setPixelRatio(pixelRatio);
    this.resolution = new ResolutionGovernor(pixelRatio, pixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = rules.softShadows ? THREE.PCFShadowMap : THREE.BasicShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, innerWidth / innerHeight, CAMERA_NEAR, CAMERA_FAR);
    addEventListener('resize', () => this.resize(), { signal: this.listeners.signal });

    this.atmosphere =rules.sky ? new Sky(this.scene, this.tuning) : new Darkness(this.scene, this.tuning);
    this.lighting = new Lighting(world, this.scene, this.tuning, rules.carriesLight);
    this.sight = rules.limitedSight ? new Sight(world, this.scene) : null;
    this.worldView = new WorldView(world, this.scene, { wallFade: rules.wallFade, sight: this.sight });
    this.sim = new Simulation(world, population, seed);
    this.nodesView = new NodesView(this.sim, this.scene);
    this.creaturesView = new CreaturesView(this.sim, this.scene, this.tuning, rules.bodyShadow);
    this.body = new Body(world, spawn.x, spawn.z);
    this.visualY = this.body.y;
    this.input = new Input(this.renderer.domElement, host.settings);
    this.aim = new Aim(host.settings);
    this.aimLine = new AimLine(world);
    this.rig = new CameraRig(this.camera, this.body.x, this.body.y, this.body.z, this.tuning);
    this.scene.add(this.aimLine.root);

    this.readouts = createReadouts(this);
  }

  // Starts the frames.
  start(): void {
    this.last = performance.now();
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  // The game stands still (the picture stays) and lets go of the keys and the pointer, until it is resumed.
  pause(): void {
    this.paused = true;
    this.input.reset();
  }

  // Takes back the pointer in the aim mode, so call it from a click or a key.
  resume(): void {
    this.paused = false;
    this.input.resume();
  }

  // Loads the character's model and puts it into the world. The game goes on without it if that fails.
  async loadCharacter(): Promise<void> {
    const model = await loadRobotModel();
    if (this.disposed) return;
    const robot = new Robot(model);
    robot.setCastsShadow(BIOME_RULES[this.biome].bodyShadow);
    this.scene.add(robot.root);
    this.robot = robot;
    this.creaturesView.show(model);
  }

  // Stops the frames and gives everything back: the listeners, the pointer, the canvas and the graphics memory.
  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.listeners.abort();
    this.input.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  private frame(time: number): void {
    if (time < this.nextFrameAt - FRAME_EARLY_MILLISECONDS) return; // a screen faster than the game needs
    this.nextFrameAt = Math.max(this.nextFrameAt, time - FRAME_MILLISECONDS) + FRAME_MILLISECONDS;
    const seconds = (time - this.last) / 1000;
    const dt = Math.min(seconds, MAX_FRAME_SECONDS);
    this.fps += (1000 / Math.max(time - this.last, 1) - this.fps) * FPS_SMOOTHING;
    this.last = time;
    if (!this.paused) this.step(dt); // paused: the picture stays as it is
    this.renderer.render(this.scene, this.camera);
    const ratio = this.resolution.update(seconds);
    if (ratio !== null) this.renderer.setPixelRatio(ratio);
  }

  // One step of the game. The order matters: the world lives on first, the camera follows the character where it has just
  // moved, the sky follows the camera, the aim reads the camera that has just turned, the light in the hand goes where the aim
  // says, and the character is drawn where the body is.
  private step(dt: number): void {
    this.updateLife(dt);
    const move = this.moveCharacter(dt);
    this.followWithCamera(dt);
    this.atmosphere.update(dt, this.rig.target);
    this.updateAim(dt);
    this.lighting.update(dt, this.body.x, this.visualY, this.body.z, this.aim.yaw);
    this.updateCharacter(dt, move);
  }

  // The simulation lives its time (as fast as the panel says), and the views show where it has got to.
  private updateLife(dt: number): void {
    this.sim.update(dt * this.tuning.simSpeed);
    this.nodesView.update();
    this.creaturesView.update(dt);
  }

  // Returns the direction of the movement: a unit vector, or (0, 0) if the character stands.
  private moveCharacter(dt: number): { x: number; z: number } {
    // Movement is relative to the camera: W = up the screen, which is north in the overview and the aim in the aim mode.
    const axis = this.input.moveAxis();
    const length = Math.hypot(axis.x, axis.z);
    const move = screenToWorld(length ? axis.x / length : 0, length ? axis.z / length : 0, this.rig.heading);
    const running = this.input.running && !this.robot?.steering.backpedal; // no running backwards
    const speed = running ? RUN_SPEED : WALK_SPEED;
    this.body.update(dt, move.x * speed, move.z * speed);
    this.visualY += (this.body.y - this.visualY) * (1 - Math.exp(-STAIRS_SMOOTHING_SPEED * dt)); // smooths stair steps
    return move;
  }

  // The camera follows the character and looks where the aim says (one frame late, which its own smoothing hides);
  // what the character sees is found, and the view of the world follows the camera and leaves out the rest.
  private followWithCamera(dt: number): void {
    const { body } = this;
    this.playerPosition.set(body.x, this.visualY, body.z);
    this.rig.update(dt, this.playerPosition, this.aim.heading, this.input.takeWheelY());
    this.sight?.update(body.x, body.y, body.z); // before the view: the view leaves out what he does not see
    this.worldView.update(body.x, body.y, body.z, this.camera, dt);
  }

  // The character looks at the cursor, or where the mouse has turned the view in the aim mode.
  private updateAim(dt: number): void {
    const { body, aim, tuning } = this;
    aim.update(dt, this.input.aiming, this.input.takeLookX(), this.rig.cursorYaw(this.input.mouse, body.x, this.visualY, body.z));
    this.aimLine.update(aim.aiming && tuning.aimLine, aim.aiming && tuning.aimLineOverEverything, body.x, this.visualY, body.z, aim.yaw);
  }

  private updateCharacter(dt: number, move: { x: number; z: number }): void {
    if (!this.robot) return;
    this.robot.setPosition(this.body.x, this.visualY, this.body.z);
    this.robot.update(dt, this.aim.yaw, move.x, move.z, this.input.running);
  }
}
