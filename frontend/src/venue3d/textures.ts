import * as THREE from 'three';
import { PALETTE } from './geometry';

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Diagonal hatching for seats someone else holds: the colour-free cue from the system design. */
export function hatchTexture(base: string) {
  return canvasTexture(64, 64, ctx => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(40, 24, 0, 0.55)';
    ctx.lineWidth = 9;
    for (let x = -64; x < 128; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 64, 64);
      ctx.stroke();
    }
  });
}

/** LED wall: a slow blue-to-magenta wash seen through a dot-matrix grille. */
export function ledTexture() {
  return canvasTexture(512, 256, ctx => {
    const wash = ctx.createLinearGradient(0, 0, 512, 256);
    wash.addColorStop(0, '#0b1a5c');
    wash.addColorStop(0.45, '#3b1d8f');
    wash.addColorStop(1, '#8a1f78');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, 512, 256);
    // A soft horizon of light across the middle, like a show visual between songs.
    const glow = ctx.createRadialGradient(256, 150, 10, 256, 150, 220);
    glow.addColorStop(0, 'rgba(120, 170, 255, 0.55)');
    glow.addColorStop(1, 'rgba(120, 170, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = 'rgba(4, 6, 20, 0.55)';
    for (let x = 0; x < 512; x += 4) ctx.fillRect(x, 0, 1, 256);
    for (let y = 0; y < 256; y += 4) ctx.fillRect(0, y, 512, 1);
  });
}

/** White at the lamp, fading to nothing: multiplied by each beam's colour. */
export function beamTexture() {
  return canvasTexture(4, 128, ctx => {
    const fade = ctx.createLinearGradient(0, 0, 0, 128);
    fade.addColorStop(0, 'rgba(255,255,255,1)');
    fade.addColorStop(0.7, 'rgba(255,255,255,0.25)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 4, 128);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 4, 128);
  });
}

/** Haze lit from behind the stage. */
export function hazeTexture() {
  return canvasTexture(256, 128, ctx => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 128);
    const glow = ctx.createRadialGradient(128, 100, 4, 128, 100, 130);
    glow.addColorStop(0, 'rgba(139, 92, 246, 0.9)');
    glow.addColorStop(0.5, 'rgba(61, 123, 255, 0.25)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 128);
  });
}

/** Faint expansion-joint grid on the arena floor. */
export function floorTexture() {
  const texture = canvasTexture(128, 128, ctx => {
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(120, 130, 200, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 128, 128);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
