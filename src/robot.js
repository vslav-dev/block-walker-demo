import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Steering } from './steering.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/models/gltf/RobotExpressive/RobotExpressive.glb';
const HEIGHT = 1.7; // world units, the model is rescaled to it
const CLIPS = { idle: 'Idle', walk: 'Walking', run: 'Running' };
// Bones that twist the upper body towards the cursor, shares sum to 1.
const SPINE = [['Abdomen', 0.4], ['Torso', 0.4], ['Neck', 0.1], ['Head', 0.1]];
const FADE = 0.2; // seconds of cross-fade between animations
const UP = new THREE.Vector3(0, 1, 0);
const _parentQuat = new THREE.Quaternion();
const _twistQuat = new THREE.Quaternion();
const _deltaQuat = new THREE.Quaternion();

// GLTFLoader strips ":" and "." from names and suffixes duplicates with _1, _2, ...
const normalizeName = (name) => name.replace(/_\d+$/, '').replace(/[^A-Za-z0-9]/g, '');

// Bones and meshes may share a name (the robot has both a "Torso" bone and a "Torso" mesh), so meshes are skipped.
function findBone(root, name) {
  let found = null;
  root.traverse((o) => {
    if (!found && !o.isMesh && normalizeName(o.name) === normalizeName(name)) found = o;
  });
  if (!found) throw new Error(`Bone "${name}" not found in the robot model`);
  return found;
}

// Rigid (non-skinned) parts are measured as they are; fully skinned models need their skinned vertices.
function measure(model) {
  model.updateMatrixWorld(true);
  const rigid = new THREE.Box3();
  model.traverse((o) => {
    if (o.isMesh && !o.isSkinnedMesh) rigid.expandByObject(o);
  });
  return rigid.isEmpty() ? new THREE.Box3().setFromObject(model, true) : rigid;
}

export async function loadRobot() {
  return new Robot(await new GLTFLoader().loadAsync(MODEL_URL));
}

// The playable character: a Group (`root`) that the game positions, animated by the model's own clips,
// with the upper body twisted towards the cursor.
export class Robot {
  constructor(gltf) {
    this.root = new THREE.Group();
    this.steering = new Steering();

    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true; // in the shade of a roof or a wall the robot is dark, too
        o.frustumCulled = false; // skinned bounds are computed in the bind pose
      }
    });
    const bounds = measure(model);
    const scale = HEIGHT / (bounds.max.y - bounds.min.y);
    model.scale.setScalar(scale);
    model.position.y = -bounds.min.y * scale;
    this.root.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = Object.fromEntries(
      Object.entries(CLIPS).map(([role, name]) => {
        const clip = THREE.AnimationClip.findByName(gltf.animations, name);
        if (!clip) throw new Error(`Animation "${name}" not found in the robot model`);
        return [role, this.mixer.clipAction(clip)];
      }),
    );
    this.current = null;
    this.play('idle');

    // `clean` = the bone's rotation as the animation left it, before our twist.
    this.spine = SPINE.map(([name, share]) => {
      const bone = findBone(model, name);
      return { bone, share, clean: bone.quaternion.clone() };
    });
  }

  setPosition(x, y, z) {
    this.root.position.set(x, y, z);
  }

  // aimYaw: where the cursor is. moveX/moveZ: normalized movement direction (0, 0 = standing).
  update(dt, aimYaw, moveX, moveZ, running) {
    const twist = this.steering.update(dt, aimYaw, moveX, moveZ);
    this.root.rotation.y = this.steering.legsYaw;

    if (moveX === 0 && moveZ === 0) this.play('idle');
    else this.play(running && !this.steering.backpedal ? 'run' : 'walk', this.steering.backpedal ? -1 : 1); // no running backwards

    // The mixer skips bones whose animated value did not change, so our twist from the previous
    // frame must be undone first, otherwise it would pile up on such bones.
    for (const part of this.spine) part.bone.quaternion.copy(part.clean);
    this.mixer.update(dt);
    for (const part of this.spine) part.clean.copy(part.bone.quaternion);

    this.twistSpine(twist);
  }

  // timeScale < 0 plays the clip backwards.
  play(role, timeScale = 1) {
    const next = this.actions[role];
    next.timeScale = timeScale;
    if (next === this.current) return;
    next.reset().play();
    this.current?.crossFadeTo(next, FADE, false);
    this.current = next;
  }

  // Rotates the upper body by `angle` around the world's vertical axis, which in every bone's
  // local space is a different axis (the rig is rotated), hence the conjugation by the parent rotation.
  twistSpine(angle) {
    for (const { bone, share } of this.spine) {
      bone.parent.getWorldQuaternion(_parentQuat);
      _twistQuat.setFromAxisAngle(UP, angle * share);
      _deltaQuat.copy(_parentQuat).invert().multiply(_twistQuat).multiply(_parentQuat);
      bone.quaternion.premultiply(_deltaQuat);
    }
  }
}
