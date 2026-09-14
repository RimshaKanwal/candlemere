import * as THREE from 'three';

// Deterministic, local material textures: no downloads and no per-frame work.
function canvasTexture(draw, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
export function createMaterials() {
  const cache = new Map();
  const textures = [];
  const grain = canvasTexture((ctx, size) => {
    ctx.fillStyle = '#ae8054'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) {
      ctx.strokeStyle = `rgba(51,25,9,${.04 + (y % 13) / 120})`;
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + Math.sin(y) * 9, 330, y - 3, size, y + 2); ctx.stroke();
    }
  });
  const parquet = canvasTexture((ctx, size) => {
    ctx.fillStyle = '#54331f'; ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const shade = 22 + ((row * 17 + col * 7) % 16);
      ctx.save(); ctx.translate(col * 64 + 32, row * 64 + 32);
      if ((row + col) % 2) ctx.rotate(Math.PI / 2);
      for (let plank = 0; plank < 4; plank++) {
        ctx.fillStyle = `hsl(29, 37%, ${shade + plank * 2}%)`;
        ctx.fillRect(-31, -31 + plank * 16, 62, 14);
        ctx.strokeStyle = '#e6b67920'; ctx.strokeRect(-30, -30 + plank * 16, 60, 12);
        ctx.fillStyle = '#1a0b051c'; ctx.fillRect(-25, -27 + plank * 16, 49, 1);
      }
      ctx.restore();
    }
  });
  const marble = canvasTexture((ctx, size) => {
    ctx.fillStyle = '#d2d0ba'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = i % 3 ? '#485d5010' : '#77796228'; ctx.lineWidth = i % 3 + 1;
      ctx.beginPath(); ctx.moveTo(i * 17 % size, 0);
      ctx.bezierCurveTo(i * 13 % size, 160, i * 31 % size, 280, i * 19 % size, size); ctx.stroke();
    }
    ctx.strokeStyle = '#303c3030'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, size, size);
  });
  const wallpaper = canvasTexture((ctx, size) => {
    ctx.fillStyle = '#d4c9a9'; ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 64) {
      ctx.fillStyle = '#f5e9c630'; ctx.fillRect(x, 0, 27, size);
      ctx.fillStyle = '#66593b36'; ctx.fillRect(x + 29, 0, 2, size);
      for (let y = 0; y < size; y += 64) {
        ctx.save(); ctx.translate(x + 14, y + 30); ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = '#67552d65'; ctx.lineWidth = 2; ctx.strokeRect(-6, -6, 12, 12); ctx.restore();
      }
    }
  });
  textures.push(grain, parquet, marble, wallpaper);
  function material(color, kind = 'plain') {
    const key = `${color}:${kind}`;
    if (!cache.has(key)) {
      cache.set(key, new THREE.MeshStandardMaterial({
        color, roughness: kind === 'metal' ? .28 : kind === 'wood' ? .5 : .8,
        metalness: kind === 'metal' ? .68 : 0,
        ...(kind === 'wood' ? { map: grain } : {}),
        ...(kind === 'parquet' ? { map: parquet } : {}),
        ...(kind === 'marble' ? { map: marble } : {}),
        ...(kind === 'wallpaper' ? { map: wallpaper } : {}),
        ...(kind === 'glow' ? { emissive: color, emissiveIntensity: .65 } : {}),
      }));
    }
    return cache.get(key);
  }
  function rug(color) {
    const key = `rug:${color}`;
    if (!cache.has(key)) {
      const texture = canvasTexture((ctx, size) => {
        ctx.fillStyle = color; ctx.fillRect(0, 0, size, size);
        for (const inset of [10, 18, 29, 55]) {
          ctx.strokeStyle = '#dfc891'; ctx.lineWidth = inset === 29 ? 12 : 3;
          ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
        }
        ctx.strokeStyle = '#dfc891'; ctx.lineWidth = 4;
        for (let i = 85; i < 440; i += 45) for (const side of [38, 474]) {
          ctx.beginPath(); ctx.moveTo(i, side - 10); ctx.lineTo(i + 12, side); ctx.lineTo(i, side + 10); ctx.lineTo(i - 12, side); ctx.closePath(); ctx.stroke();
        }
        ctx.save(); ctx.translate(256, 256); ctx.scale(.75, 1);
        for (let r = 90; r > 0; r -= 18) {
          ctx.rotate(Math.PI / 8); ctx.strokeStyle = r % 36 ? '#d8c795' : '#a98c56';
          ctx.strokeRect(-r, -r, r * 2, r * 2);
        }
        ctx.restore();
      });
      textures.push(texture);
      cache.set(key, new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
    }
    return cache.get(key);
  }
  return { material, rug, dispose() { cache.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); } };
}
