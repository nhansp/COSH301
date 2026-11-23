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

/** Concourse lights on the far bowl: sparse warm and cool dots in bands. */
export function windowsTexture() {
  const texture = canvasTexture(512, 128, ctx => {
    ctx.fillStyle = '#0a0d26';
    ctx.fillRect(0, 0, 512, 128);
    for (let band = 0; band < 3; band++) {
      const y = 26 + band * 34;
      for (let x = 4; x < 512; x += 9) {
        if (Math.sin(x * 12.9898 + band * 78.233) > 0.15) continue;
        ctx.fillStyle = (x + band) % 5 === 0 ? 'rgba(255, 214, 160, 0.7)' : 'rgba(140, 160, 255, 0.55)';
        ctx.fillRect(x, y, 3, 2);
      }
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  return texture;
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
