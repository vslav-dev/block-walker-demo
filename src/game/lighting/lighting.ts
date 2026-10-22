import type { WorldLight } from '@game/world/light';
import { EYE_H, type World } from '@game/world/world';
import type { Readout } from '@game/core/readout';
import * as THREE from 'three';
import { nearestLights } from './light-choice';
import { LightFixtures } from './light-fixtures';
import { HAND, LIGHT_LOOKS, flicker } from './light-looks';
import { LIGHT_GROUP, type LightTuning } from './light-tuning';

// The lights that stand in the world and the one in the character's hand, as lights of the scene.
//
// A light with a shadow costs a shadow map of its own and a place in every shader, and the number of lights in a shader cannot
// change without a recompile and a stall. So the lights of the world share a pool of a few, fixed for the whole game: the
// ones that matter most for the player (see light-choice.ts) shine, the others are only seen as flames. When the choice
// changes, a light fades out in its place and the new one fades in in another, so nothing jumps.
// The shadow of a light that stands still is drawn once, when it takes its place: nothing in the world moves, and the
// character's body throws no shadow where there are lights (see BiomeRules). The light in the hand has no shadow: it would be
// drawn anew every frame, in six directions, and for what? It never goes past a wall (see below), and what the character
// does not see is blacked out (see Sight), so no light of it is seen where a shadow would have kept it out.
const SHINING = 4; // the lights of the world that shine at a time
const SPARE = 2; // places beyond that, for the lights that fade out while others fade in
const FADE_SECONDS = 0.5;
const SHADOW_MAP = 512;
const SHADOW_NEAR = 0.05; // the walls are a few hands away from a light that is held; nearer than this a wall does not throw a shadow
const SHADOW_BIAS = 0;
const SHADOW_NORMAL_BIAS = 0.03;
const DECAY = 2; // the physical fall-off of a point light
// The candle in the hand is before the character at the height of the chest, so that it lights him from the front. It never
// gets past a wall that he stands near, a doorway too: with no shadow, the room he is in would be lit from the other side of the
// wall. It goes out to its place at a quick pace, not in a jump, as he passes the doorway; it is taken in at once.
const HAND_HEIGHT = 1.45;
const HAND_FORWARD = 0.7;
const HAND_WALL_GAP = 0.15;
const HAND_OUT_SPEED = 25; // per second: the share of the way to its place that the candle covers

interface Slot {
  light: THREE.PointLight;
  source: WorldLight | null; // null = free, switched off
  phase: number; // sets the flicker of a light apart from the others
  level: number; // 0..1, how far it has faded in
}

function createPointLight(): THREE.PointLight {
  const light = new THREE.PointLight(0xffffff, 0, 0, DECAY);
  light.castShadow = true;
  light.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  light.shadow.camera.near = SHADOW_NEAR;
  light.shadow.bias = SHADOW_BIAS;
  light.shadow.normalBias = SHADOW_NORMAL_BIAS;
  light.shadow.autoUpdate = false; // drawn when it is asked for (see Lighting.take)
  light.shadow.needsUpdate = true; // once at the start, so that the map exists: a shader with a light that has none does not draw
  return light;
}

const approach = (value: number, target: number, step: number): number =>
  Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step;

export class Lighting {
  readonly readouts: Readout[] = [];
  private readonly slots: Slot[];
  private readonly hand: { light: THREE.PointLight; flame: THREE.Mesh } | null;
  private time = 0;
  private handReach = 0; // how far before the character the candle in the hand is

  // tuning = the values of LIGHT_TUNABLES, read on every use; carriesLight = the character holds a candle.
  constructor(
    private readonly world: World,
    scene: THREE.Scene,
    private readonly tuning: LightTuning,
    carriesLight: boolean,
  ) {
    const fixtures = new LightFixtures();
    for (const light of world.lights) scene.add(fixtures.create(light));

    const places = world.lights.length === 0 ? 0 : Math.min(world.lights.length, SHINING + SPARE);
    this.slots = Array.from({ length: places }, () => ({ light: createPointLight(), source: null, phase: 0, level: 0 }));
    for (const { light } of this.slots) scene.add(light);

    this.hand = carriesLight ? { light: createPointLight(), flame: fixtures.createFlame(HAND) } : null;
    if (this.hand) {
      this.hand.light.color.setHex(LIGHT_LOOKS[HAND].color);
      this.hand.light.castShadow = false; // see the note above
      scene.add(this.hand.light, this.hand.flame);
    }

    if (this.slots.length > 0 || this.hand) {
      const all = world.lights.length + (this.hand ? 1 : 0);
      this.readouts.push({ label: 'Lights shining', group: LIGHT_GROUP, read: () => `${this.shining()} / ${all}` });
    }
  }

  // Called every frame with the character's feet at (x, y, z) looking along yaw.
  update(dt: number, x: number, y: number, z: number, yaw: number): void {
    this.time += dt;
    this.updatePool(dt, x, z);
    this.updateHand(dt, x, y, z, yaw);
  }

  private shining(): number {
    return this.slots.filter((slot) => slot.source !== null && slot.level > 0).length + (this.hand ? 1 : 0);
  }

  private reachOf = (light: WorldLight): number => this.tuning[LIGHT_LOOKS[light.kind].reach];

  private updatePool(dt: number, x: number, z: number): void {
    if (this.slots.length === 0) return;
    const wanted = nearestLights(this.world.lights, x, z, SHINING, this.reachOf);
    for (const source of wanted) {
      if (!this.slots.some((slot) => slot.source === source)) this.take(this.placeFor(wanted), source);
    }

    for (const slot of this.slots) {
      const { source, light } = slot;
      if (source === null) continue;
      const look = LIGHT_LOOKS[source.kind];
      const isWanted = wanted.includes(source);
      slot.level = approach(slot.level, isWanted ? 1 : 0, dt / FADE_SECONDS);
      if (!isWanted && slot.level === 0) {
        this.release(slot);
        continue;
      }
      const reach = this.reachOf(source);
      light.intensity = this.tuning[look.intensity] * slot.level * flicker(look, this.time, slot.phase);
      light.distance = reach;
    }
  }

  // The place for a light that is to shine: a free one, or else the one that is fading out the furthest. There is always one,
  // as there are more places than lights that shine.
  private placeFor(wanted: readonly WorldLight[]): Slot {
    const free = this.slots.find((slot) => slot.source === null);
    if (free) return free;
    const leaving = this.slots.filter((slot) => !wanted.includes(slot.source!));
    return leaving.reduce((least, slot) => (slot.level < least.level ? slot : least));
  }

  private take(slot: Slot, source: WorldLight): void {
    slot.source = source;
    slot.phase = this.world.lights.indexOf(source);
    slot.level = 0;
    slot.light.color.setHex(LIGHT_LOOKS[source.kind].color);
    slot.light.position.set(source.x, source.y, source.z);
    slot.light.shadow.needsUpdate = true;
  }

  private release(slot: Slot): void {
    slot.source = null;
    slot.light.intensity = 0;
    slot.light.shadow.autoUpdate = false;
  }

  private updateHand(dt: number, x: number, y: number, z: number, yaw: number): void {
    if (!this.hand) return;
    const { light, flame } = this.hand;
    const look = LIGHT_LOOKS[HAND];
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    const free = this.world.castRay(x, y + EYE_H, z, dx, dz, HAND_FORWARD + HAND_WALL_GAP, false) - HAND_WALL_GAP;
    const place = Math.min(HAND_FORWARD, Math.max(0, free));
    // Out to its place gradually, but never past it: where a wall is it is at the wall at once.
    this.handReach = place < this.handReach ? place : this.handReach + (place - this.handReach) * (1 - Math.exp(-HAND_OUT_SPEED * dt));
    flame.position.set(x + dx * this.handReach, y + HAND_HEIGHT, z + dz * this.handReach);
    light.position.copy(flame.position);
    light.intensity = this.tuning[look.intensity] * flicker(look, this.time, 0);
    light.distance = this.tuning[look.reach];
  }
}
