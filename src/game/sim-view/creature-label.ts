import { RenderOrder } from '@game/render-order';
import * as THREE from 'three';

const WIDTH = 512; // pixels of the canvas
const HEIGHT = 96;
const FONT = 'bold 44px sans-serif';
const PIXELS_PER_BLOCK = 150; // how big the text is in the world
const ABOVE_FEET = 2.2; // blocks: over the head of a character, which is 1.7 high
const BACKGROUND = 'rgba(0, 0, 0, 0.6)';
const COLOR = '#ffffff';

// A line of text over the head of a creature, always facing the camera and drawn over everything. The picture is made again only
// when the text changes.
export class CreatureLabel {
  readonly sprite: THREE.Sprite;
  private readonly context: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private text = '';

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.context = canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false }));
    this.sprite.scale.set(WIDTH / PIXELS_PER_BLOCK, HEIGHT / PIXELS_PER_BLOCK, 1);
    this.sprite.position.y = ABOVE_FEET;
    this.sprite.renderOrder = RenderOrder.CreatureLabel;
  }

  set(text: string): void {
    if (text === this.text) return;
    this.text = text;
    const { context } = this;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = BACKGROUND;
    context.beginPath();
    context.roundRect(0, 0, WIDTH, HEIGHT, HEIGHT / 3);
    context.fill();
    context.fillStyle = COLOR;
    context.font = FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, WIDTH / 2, HEIGHT / 2);
    this.texture.needsUpdate = true;
  }
}
